// Fasimāķu Toolbox — web port of https://github.com/kashepavadan/Fasimaak-u-Toolbox
// Dictionary browser/search + ASCII → Fasimāķu script converter.
//
// Words come from the MySQL database through api/fasimaaku.php. If that can't be
// reached, the page falls back to the read-only copy in data/dictionary.txt.
// Open the page with ?edit=1 and sign in with your editor password to add, edit and
// delete words.

(function () {
    "use strict";

    const API_URL = "api/fasimaaku.php";
    const FALLBACK_URL = "data/dictionary.txt";
    const SEP = "¶"; // ¶ — field separator used by dictionary.txt
    const EDIT_MODE = new URLSearchParams(location.search).has("edit");

    // ---------- Script conversion (ScriptConverter.convertText / Dictionary.formatWord) ----------

    // Order matters: same order as the original Java.
    const LETTER_RULES = [
        ["nh", "ñ"], // ñ
        ["t'", "ţ"], // ţ
        ["k'", "ķ"], // ķ
        ["th", "ð"], // ð
        ["sh", "š"], // š
        ["ii", "ī"], // ī
        ["aa", "ā"], // ā
        ["ee", "ē"], // ē
        ["uu", "ū"], // ū
    ];

    function convertLetters(s) {
        for (const [from, to] of LETTER_RULES) {
            const upper = to.toUpperCase();
            s = s.split(from).join(to)
                 .split(from.toUpperCase()).join(upper)
                 // Title case at the start of a word ("Sh" → "Š"); the Java version skipped this.
                 .split(from[0].toUpperCase() + from.slice(1)).join(upper);
        }
        return s;
    }

    // Full converter, including the original's straight-quote → «guillemet» rules.
    function convertText(s) {
        return convertLetters(s)
            .replace(/^"/gm, "«")
            .replace(/ "/g, " «")
            .replace(/"$/gm, "»")
            .replace(/" /g, "» ");
    }

    // Normalises dictionary input: lower case, and Fasimāķu digraphs converted.
    function formatWord(s, isFas) {
        s = s.trim().toLowerCase();
        return isFas ? convertLetters(s) : s;
    }

    // ---------- Data ----------

    let storage = [];     // every word: { id, fas, eng, pos, expl, derivs }
    let words = [];       // current view: all words or search results
    let current = 0;
    let draft = null;     // unsaved new word in edit mode
    let lastSearch = null;
    let csrf = null;      // set once signed in
    let offline = false;  // true when showing data/dictionary.txt instead of the database
    let busy = false;

    function parse(text) {
        return text.split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .map((line, i) => {
                const [fas = "", eng = "", pos = "", expl = "", ...derivs] = line.split(SEP);
                return { id: i + 1, fas, eng, pos, expl, derivs: derivs.filter(d => d !== "") };
            });
    }

    function serialize() {
        return storage
            .map(w => [w.fas, w.eng, w.pos, w.expl, ...w.derivs].join(SEP) + SEP)
            .join("\n") + "\n";
    }

    class ApiError extends Error {
        constructor(status, message) {
            super(message);
            this.status = status;
        }
    }

    async function api(action, body) {
        const opts = { credentials: "same-origin", headers: {} };
        if (body !== undefined) {
            opts.method = "POST";
            opts.headers["Content-Type"] = "application/json";
            if (csrf) opts.headers["X-CSRF-Token"] = csrf;
            opts.body = JSON.stringify(body);
        }
        let res, data;
        try {
            res = await fetch(API_URL + "?action=" + action, opts);
        } catch (e) {
            throw new ApiError(0, "Couldn't reach the server. Check your connection.");
        }
        try {
            data = await res.json();
        } catch (e) {
            throw new ApiError(res.status, "The server sent an unexpected reply (HTTP " + res.status + ").");
        }
        if (!res.ok) throw new ApiError(res.status, data.error || "Request failed (HTTP " + res.status + ").");
        return data;
    }

    async function load() {
        try {
            storage = (await api("words")).words;
            offline = false;
        } catch (e) {
            // Database unavailable: show the bundled copy so the page still works.
            const res = await fetch(FALLBACK_URL);
            if (!res.ok) throw e;
            storage = parse(await res.text());
            offline = true;
            console.warn("Fasimāķu: using " + FALLBACK_URL + " because the API failed:", e.message);
        }
        words = storage;
    }

    // Replace the word list after a change, keeping any active search.
    function replaceWords(newWords) {
        storage = newWords;
        words = storage;
        if (lastSearch) {
            const hits = filterWords(lastSearch);
            if (hits.length) words = hits;
            else lastSearch = null;
        }
    }

    const byFas = fas => storage.find(w => w.fas === fas);

    // ---------- DOM helpers ----------

    const $ = id => document.getElementById(id);

    function el(tag, props, children) {
        const node = document.createElement(tag);
        Object.assign(node, props || {});
        (children || []).forEach(c => node.append(c));
        return node;
    }

    let messageTimer;
    function message(text, isError, sticky) {
        const box = $("fas-message");
        box.textContent = text;
        box.classList.toggle("fas-error", !!isError);
        box.hidden = !text;
        clearTimeout(messageTimer);
        if (text && !sticky) messageTimer = setTimeout(() => { box.hidden = true; }, 6000);
    }

    // ---------- Viewing (Dictionary.changeRecord) ----------

    function wordChip(fas, onClick) {
        const target = byFas(fas);
        const btn = el("button", { type: "button", className: "fas-chip" }, [
            el("span", { className: "fas-chip-word", textContent: fas }),
            el("span", { className: "fas-chip-eng", textContent: target ? target.eng.split("/").join(", ") : "not in dictionary" }),
        ]);
        if (target) btn.addEventListener("click", onClick);
        else btn.disabled = true;
        return btn;
    }

    function goToWord(fas) {
        if (draft) return;
        words = storage;
        lastSearch = null;
        const i = storage.findIndex(w => w.fas === fas);
        if (i >= 0) show(i);
    }

    function show(index) {
        if (draft) return;
        if (!words.length) words = storage;
        if (!words.length) {
            $("fas-counter").textContent = "0 of 0";
            return;
        }
        current = ((index % words.length) + words.length) % words.length; // wraps, as in the original
        const w = words[current];

        $("fas-counter").textContent = (current + 1) + " of " + words.length +
            (words !== storage ? " results" : "");
        $("fas-home").disabled = words === storage;

        $("fas-word").textContent = w.fas;
        $("fas-eng").textContent = w.eng.split("/").join(" · ");
        $("fas-pos").textContent = w.pos;
        $("fas-expl").textContent = w.expl;
        if (csrf) fillEditor(w);

        // Words this one is built from
        $("fas-built-from").replaceChildren(...w.derivs.map(d => wordChip(d, () => goToWord(d))));
        $("fas-built-from-row").hidden = !w.derivs.length;

        // Words built from this one (new: not in the Java version)
        const usedIn = storage.filter(o => o.derivs.includes(w.fas));
        $("fas-used-in").replaceChildren(...usedIn.map(o => wordChip(o.fas, () => goToWord(o.fas))));
        $("fas-used-in-row").hidden = !usedIn.length;

        history.replaceState(null, "", location.pathname + location.search + "#" + encodeURIComponent(w.fas));
    }

    // ---------- Searching (Dictionary.searchDict) ----------

    function filterWords(q) {
        return storage.filter(w => q.fasMode
            ? w.fas === q.term || (q.broad && w.fas.includes(q.term))
            : w.eng.split("/").includes(q.term) || (q.broad && w.expl.toLowerCase().includes(q.term)));
    }

    function search() {
        if (draft) return message("Save or discard the new word first.", true);
        const fasMode = $("fas-search-fas").checked;
        const broad = $("fas-search-broad").checked;
        const term = formatWord($("fas-search").value, fasMode);
        if (!term) return goHome();

        const q = { term, fasMode, broad };
        const hits = filterWords(q);
        if (!hits.length) {
            message("No results for “" + term + "”." +
                (broad ? "" : " Try ticking “Broad search”."), true);
            return;
        }
        message("");
        lastSearch = q;
        words = hits;
        show(0);
    }

    function goHome() {
        if (draft) return message("Save or discard the new word first.", true);
        lastSearch = null;
        words = storage;
        show(0);
    }

    function updateSearchPreview() {
        const fasMode = $("fas-search-fas").checked;
        const raw = $("fas-search").value;
        const converted = formatWord(raw, true);
        $("fas-search-preview").textContent = fasMode && raw && converted !== raw.trim().toLowerCase()
            ? "Searching for: " + converted : "";
        $("fas-search").placeholder = fasMode ? "Fasimāķu word (ASCII ok: aa, sh, k'…)" : "English word";
    }

    // ---------- Signing in ----------

    function setSignedIn(signedIn) {
        document.body.classList.toggle("fas-editing", signedIn);
        if (!signedIn) {
            csrf = null;
            if (draft) {
                draft = null;
                setNavDisabled(false);
            }
        }
        if (words.length) show(current);
    }

    async function checkSession() {
        if (offline) {
            document.body.classList.remove("fas-edit-mode");
            message("Editing is unavailable: the dictionary database can't be reached right now.", true, true);
            return;
        }
        try {
            const s = await api("session");
            csrf = s.editor ? s.csrf : null;
            setSignedIn(!!s.editor);
        } catch (e) {
            message(e.message, true, true);
        }
    }

    async function signIn(e) {
        e.preventDefault();
        if (busy) return;
        const field = $("fas-password");
        if (!field.value) return field.focus();
        busy = true;
        $("fas-login-go").disabled = true;
        try {
            const s = await api("login", { password: field.value });
            csrf = s.csrf;
            field.value = "";
            message("Signed in. You can edit now.");
            setSignedIn(true);
        } catch (err) {
            message(err.message, true);
            field.select();
        } finally {
            busy = false;
            $("fas-login-go").disabled = false;
        }
    }

    async function signOut() {
        try { await api("logout", {}); } catch (e) { /* signed out either way */ }
        setSignedIn(false);
        message("Signed out.");
    }

    // A 401/403 from the server means the sign-in has lapsed.
    function handleEditError(err) {
        if (err.status === 401 || err.status === 403) {
            setSignedIn(false);
            message(err.message + " Your changes weren't saved.", true, true);
        } else {
            message(err.message, true);
        }
    }

    // ---------- Editing (Dictionary.actionPerformed: new / enter / delete) ----------

    function fillEditor(w) {
        $("fas-edit-fas").value = w.fas;
        $("fas-edit-eng").value = w.eng;
        $("fas-edit-pos").value = w.pos;
        $("fas-edit-expl").value = w.expl;
        $("fas-edit-derivs").value = w.derivs.join("/");
    }

    function newWord() {
        if (draft || busy) return;
        draft = { id: null, fas: "", eng: "", pos: "", expl: "", derivs: [] };
        fillEditor(draft);
        $("fas-counter").textContent = "New word";
        $("fas-built-from-row").hidden = true;
        $("fas-used-in-row").hidden = true;
        setNavDisabled(true);
        $("fas-edit-fas").focus();
    }

    function setNavDisabled(disabled) {
        ["fas-prev", "fas-next", "fas-home", "fas-new", "fas-search-go"].forEach(id => { $(id).disabled = disabled; });
        $("fas-delete").textContent = disabled ? "Discard" : "Delete";
    }

    function setBusy(isBusy) {
        busy = isBusy;
        ["fas-save", "fas-delete"].forEach(id => { $(id).disabled = isBusy; });
    }

    async function saveWord() {
        if (busy) return;
        const fas = formatWord($("fas-edit-fas").value, true);
        const eng = formatWord($("fas-edit-eng").value, false);
        const pos = $("fas-edit-pos").value.trim().toUpperCase();
        const expl = $("fas-edit-expl").value.trim();
        const derivs = formatWord($("fas-edit-derivs").value, true)
            .split("/").map(d => d.trim()).filter(Boolean);

        if (!fas || !eng || !pos || !expl) {
            return message("Fasimāķu, English, part of speech and explanation are all required.", true);
        }
        const existing = draft ? null : words[current];
        const clash = byFas(fas);
        if (clash && (!existing || clash.id !== existing.id)) {
            return message("“" + fas + "” already exists.", true);
        }

        setBusy(true);
        try {
            const res = await api("save", { id: existing ? existing.id : null, fas, eng, pos, expl, derivs });
            if (draft) {
                draft = null;
                setNavDisabled(false);
            }
            replaceWords(res.words);
            let i = words.findIndex(w => w.id === res.id);
            if (i < 0) {
                words = storage;
                lastSearch = null;
                i = storage.findIndex(w => w.id === res.id);
            }
            show(i);
            const missing = derivs.filter(d => !byFas(d));
            message("Saved." + (missing.length ? " Note: " + missing.join(", ") + " isn't in the dictionary yet." : ""));
        } catch (err) {
            handleEditError(err);
        } finally {
            setBusy(false);
        }
    }

    async function deleteWord() {
        if (busy) return;
        if (draft) {
            draft = null;
            setNavDisabled(false);
            show(current);
            return;
        }
        const w = words[current];
        const dependants = storage.filter(o => o.derivs.includes(w.fas));
        const prompt = "Delete “" + w.fas + "”" +
            (dependants.length ? " and the " + dependants.length + " word(s) built from it (" +
                dependants.map(d => d.fas).join(", ") + ")" : "") + "?\n\nThis can't be undone.";
        if (!confirm(prompt)) return;

        setBusy(true);
        try {
            const res = await api("delete", { id: w.id });
            replaceWords(res.words);
            show(Math.min(current, words.length - 1));
            message("Deleted " + res.deleted + " word(s).");
        } catch (err) {
            handleEditError(err);
        } finally {
            setBusy(false);
        }
    }

    // Downloads the whole dictionary in the original file format, as a backup
    // (or to refresh data/dictionary.txt, the offline fallback).
    function exportDictionary() {
        const blob = new Blob([serialize()], { type: "text/plain;charset=utf-8" });
        const a = el("a", { href: URL.createObjectURL(blob), download: "dictionary.txt" });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // ---------- Converter UI ----------

    function setupConverter() {
        const input = $("fas-conv-in");
        const output = $("fas-conv-out");
        const label = $("fas-conv-copy-label");
        const run = () => { output.value = convertText(input.value); };
        input.addEventListener("input", run);
        $("fas-conv-copy").addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(output.value);
                label.textContent = "Copied!";
            } catch (e) {
                output.select();
                label.textContent = "Press Ctrl+C";
            }
            setTimeout(() => { label.textContent = "Copy"; }, 1500);
        });
        run();
    }

    // ---------- Startup ----------

    async function init() {
        setupConverter();
        document.body.classList.toggle("fas-edit-mode", EDIT_MODE);

        $("fas-search-form").addEventListener("submit", e => { e.preventDefault(); search(); });
        $("fas-search").addEventListener("input", updateSearchPreview);
        $("fas-search-fas").addEventListener("change", updateSearchPreview);
        $("fas-prev").addEventListener("click", () => show(current - 1));
        $("fas-next").addEventListener("click", () => show(current + 1));
        $("fas-home").addEventListener("click", goHome);

        if (EDIT_MODE) {
            $("fas-login").addEventListener("submit", signIn);
            $("fas-logout").addEventListener("click", signOut);
            $("fas-new").addEventListener("click", newWord);
            $("fas-save").addEventListener("click", saveWord);
            $("fas-delete").addEventListener("click", deleteWord);
            $("fas-export").addEventListener("click", exportDictionary);
        }

        document.addEventListener("keydown", e => {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
            if (typing || draft) return;
            if (e.key === "ArrowLeft") show(current - 1);
            if (e.key === "ArrowRight") show(current + 1);
        });

        updateSearchPreview();

        try {
            await load();
        } catch (e) {
            message("Couldn't load the dictionary. Try reloading the page.", true, true);
            $("fas-counter").textContent = "";
            return;
        }

        const linked = decodeURIComponent(location.hash.slice(1));
        const start = storage.findIndex(w => w.fas === linked);
        show(start >= 0 ? start : 0);

        if (EDIT_MODE) await checkSession();

        // Links like fasimaaku.html#xaxa jump straight to a word.
        window.addEventListener("hashchange", () => {
            const fas = decodeURIComponent(location.hash.slice(1));
            if (byFas(fas) && (!words[current] || words[current].fas !== fas)) goToWord(fas);
        });
    }

    // Exposed for testing in the console.
    window.Fasimaaku = { convertText, formatWord, parse, serialize };

    document.addEventListener("DOMContentLoaded", init);
})();
