// Fasimāķu Toolbox — web port of https://github.com/kashepavadan/Fasimaak-u-Toolbox
// Dictionary browser/search + ASCII → Fasimāķu script converter.
// Add ?edit=1 to the URL to add, edit and delete words. Edits are kept in this
// browser (localStorage) until you export dictionary.txt and commit it to data/.

(function () {
    "use strict";

    const DICT_URL = "data/dictionary.txt";
    const STORAGE_KEY = "fasimaaku-dictionary";
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

    // ---------- Data (Dictionary.open / Dictionary.save) ----------

    let storage = [];   // every word
    let words = [];     // current view: all words or search results
    let current = 0;
    let draft = null;   // unsaved new word in edit mode

    function parse(text) {
        return text.split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .map(line => {
                const [fas = "", eng = "", pos = "", expl = "", ...derivs] = line.split(SEP);
                return { fas, eng, pos, expl, derivs: derivs.filter(d => d !== "") };
            });
    }

    function serialize() {
        return storage
            .map(w => [w.fas, w.eng, w.pos, w.expl, ...w.derivs].join(SEP) + SEP)
            .join("\n") + "\n";
    }

    function readLocal() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function writeLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, serialize());
            return true;
        } catch (e) {
            return false;
        }
    }

    async function load() {
        let text = EDIT_MODE ? readLocal() : null;
        if (text === null) {
            const res = await fetch(DICT_URL);
            if (!res.ok) throw new Error("HTTP " + res.status);
            text = await res.text();
        }
        storage = parse(text);
        words = storage;
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
    function message(text, isError) {
        const box = $("fas-message");
        box.textContent = text;
        box.classList.toggle("fas-error", !!isError);
        box.hidden = !text;
        clearTimeout(messageTimer);
        if (text) messageTimer = setTimeout(() => { box.hidden = true; }, 5000);
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
        words = storage;
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

        if (EDIT_MODE) {
            fillEditor(w);
        } else {
            $("fas-word").textContent = w.fas;
            $("fas-eng").textContent = w.eng.split("/").join(" · ");
            $("fas-pos").textContent = w.pos;
            $("fas-expl").textContent = w.expl;
        }

        // Words this one is built from
        const builtFrom = $("fas-built-from");
        builtFrom.replaceChildren(...w.derivs.map(d => wordChip(d, () => goToWord(d))));
        $("fas-built-from-row").hidden = !w.derivs.length;

        // Words built from this one (new: not in the Java version)
        const usedIn = storage.filter(o => o.derivs.includes(w.fas));
        $("fas-used-in").replaceChildren(...usedIn.map(o => wordChip(o.fas, () => goToWord(o.fas))));
        $("fas-used-in-row").hidden = !usedIn.length;

        history.replaceState(null, "", "#" + encodeURIComponent(w.fas));
    }

    // ---------- Searching (Dictionary.searchDict) ----------

    function search() {
        if (draft) return message("Save or discard the new word first.", true);
        const fasMode = $("fas-search-fas").checked;
        const broad = $("fas-search-broad").checked;
        const term = formatWord($("fas-search").value, fasMode);
        if (!term) return goHome();

        const hits = storage.filter(w => fasMode
            ? w.fas === term || (broad && w.fas.includes(term))
            : w.eng.split("/").includes(term) || (broad && w.expl.toLowerCase().includes(term)));

        if (!hits.length) {
            message("No results for “" + term + "”." +
                (broad ? "" : " Try ticking “Broad search”."), true);
            return;
        }
        message("");
        words = hits;
        show(0);
    }

    function goHome() {
        if (draft) return message("Save or discard the new word first.", true);
        words = storage;
        show(0);
    }

    function updateSearchPreview() {
        const fasMode = $("fas-search-fas").checked;
        const raw = $("fas-search").value;
        const converted = formatWord(raw, true);
        const preview = $("fas-search-preview");
        preview.textContent = fasMode && raw && converted !== raw.trim().toLowerCase()
            ? "Searching for: " + converted : "";
        $("fas-search").placeholder = fasMode ? "Fasimāķu word (ASCII ok: aa, sh, k'…)" : "English word";
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
        if (draft) return;
        draft = { fas: "", eng: "", pos: "", expl: "", derivs: [] };
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

    function saveWord() {
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
        if (fas !== (existing && existing.fas) && byFas(fas)) {
            return message("“" + fas + "” already exists.", true);
        }
        const missing = derivs.filter(d => !byFas(d) && d !== fas);

        const record = existing || {};
        const oldFas = record.fas;
        Object.assign(record, { fas, eng, pos, expl, derivs });

        if (draft) {
            storage.push(record);
            draft = null;
            setNavDisabled(false);
            words = storage;
            current = storage.length - 1;
        } else if (oldFas && oldFas !== fas) {
            // Keep links pointing at a renamed word.
            storage.forEach(w => { w.derivs = w.derivs.map(d => (d === oldFas ? fas : d)); });
        }

        const persisted = writeLocal();
        show(words.indexOf(record));
        message((persisted ? "Saved in this browser. Export to publish." : "Saved for this session only (browser storage unavailable). Export to keep it.") +
            (missing.length ? " Note: " + missing.join(", ") + " not in dictionary yet." : ""), !persisted);
    }

    function deleteWord() {
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
                dependants.map(d => d.fas).join(", ") + ")" : "") + "?";
        if (!confirm(prompt)) return;

        // The Java version also removed derived words, but skipped some by mutating the list while looping.
        const doomed = new Set([w, ...dependants]);
        storage = storage.filter(o => !doomed.has(o));
        words = storage;
        writeLocal();
        show(0);
        message("Deleted " + doomed.size + " word(s).");
    }

    function exportDictionary() {
        const blob = new Blob([serialize()], { type: "text/plain;charset=utf-8" });
        const a = el("a", { href: URL.createObjectURL(blob), download: "dictionary.txt" });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    async function resetLocal() {
        if (!confirm("Discard all local edits and reload the published dictionary?")) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        draft = null;
        setNavDisabled(false);
        await load();
        show(0);
        message("Local edits discarded.");
    }

    // ---------- Converter UI ----------

    function setupConverter() {
        const input = $("fas-conv-in");
        const output = $("fas-conv-out");
        const run = () => { output.value = convertText(input.value); };
        input.addEventListener("input", run);
        $("fas-conv-copy").addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(output.value);
                $("fas-conv-copy-label").textContent = "Copied!";
            } catch (e) {
                output.select();
                $("fas-conv-copy-label").textContent = "Press Ctrl+C";
            }
            setTimeout(() => { $("fas-conv-copy-label").textContent = "Copy"; }, 1500);
        });
        run();
    }

    // ---------- Startup ----------

    async function init() {
        setupConverter();
        document.body.classList.toggle("fas-editing", EDIT_MODE);

        $("fas-search-form").addEventListener("submit", e => { e.preventDefault(); search(); });
        $("fas-search").addEventListener("input", updateSearchPreview);
        $("fas-search-fas").addEventListener("change", updateSearchPreview);
        $("fas-prev").addEventListener("click", () => show(current - 1));
        $("fas-next").addEventListener("click", () => show(current + 1));
        $("fas-home").addEventListener("click", goHome);

        if (EDIT_MODE) {
            $("fas-new").addEventListener("click", newWord);
            $("fas-save").addEventListener("click", saveWord);
            $("fas-delete").addEventListener("click", deleteWord);
            $("fas-export").addEventListener("click", exportDictionary);
            $("fas-reset").addEventListener("click", resetLocal);
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
            message("Couldn't load the dictionary (" + e.message + ").", true);
            return;
        }

        const linked = decodeURIComponent(location.hash.slice(1));
        const start = storage.findIndex(w => w.fas === linked);
        show(start >= 0 ? start : 0);

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
