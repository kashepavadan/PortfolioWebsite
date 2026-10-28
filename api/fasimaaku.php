<?php
/**
 * Fasimāķu dictionary API (PHP 7.4+, MySQL 8 / MariaDB).
 *
 *   GET  ?action=words     everyone   → { words: [...] }
 *   GET  ?action=session   everyone   → { editor: bool, csrf: string|null }
 *   POST ?action=login     { password }                         → { editor: true, csrf }
 *   POST ?action=logout    (editor)                             → { editor: false }
 *   POST ?action=save      (editor) { id|null, fas, eng, pos, expl, derivs[] } → { id, words }
 *   POST ?action=delete    (editor) { id }                       → { deleted, words }
 *
 * Settings live in fasimaaku-config.php, which must sit OUTSIDE your public web folder
 * (e.g. /home/<cpanel-user>/fasimaaku-config.php). See database/SETUP.md.
 */

declare(strict_types=1);

const FAS_CONFIG_FILE      = 'fasimaaku-config.php';
const FAS_SESSION_IDLE     = 7200;  // sign out after 2 hours without activity
const FAS_LOCK_WINDOW_MIN  = 15;    // password lockout window (minutes)
const FAS_LOCK_PER_IP      = 5;     // failed tries per address per window
const FAS_LOCK_GLOBAL      = 30;    // failed tries from all addresses per window

// Fallbacks in case the mbstring extension is turned off (the page already lower-cases words).
if (!function_exists('mb_strtolower')) {
    function mb_strtolower(string $s): string { return strtolower($s); }
    function mb_strtoupper(string $s): string { return strtoupper($s); }
    function mb_strlen(string $s): int { return (int) preg_match_all('/./us', $s); }
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

final class ApiError extends Exception
{
    public $status;
    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function is_inside(string $path, string $dir): bool
{
    $dir = rtrim($dir, '/') . '/';
    return $dir !== '/' && strpos($path, $dir) === 0;
}

function load_config(): array
{
    // Look in this folder's parents, nearest first, e.g. /home/<user>/fasimaaku-config.php
    $found = null;
    $dir = __DIR__;
    while (true) {
        $candidate = $dir . '/' . FAS_CONFIG_FILE;
        if (is_file($candidate)) {
            $found = realpath($candidate);
            break;
        }
        $parent = dirname($dir);
        if ($parent === $dir) {
            break;
        }
        $dir = $parent;
    }
    if ($found === null) {
        throw new ApiError(500, 'Setup needed: ' . FAS_CONFIG_FILE . ' was not found. See database/SETUP.md.');
    }

    $docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
    if (($docRoot !== '' && is_inside($found, $docRoot)) || strpos($found, '/public_html/') !== false) {
        throw new ApiError(500, 'Setup problem: move ' . FAS_CONFIG_FILE .
            ' out of your public web folder (into your home folder, above public_html).');
    }

    $config = require $found;
    if (!is_array($config)) {
        throw new ApiError(500, 'Setup problem: ' . FAS_CONFIG_FILE . ' must return an array.');
    }
    foreach (['db_host', 'db_name', 'db_user', 'db_pass', 'editor_password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key])) {
            throw new ApiError(500, "Setup problem: '$key' is missing from " . FAS_CONFIG_FILE . '.');
        }
    }
    $pw = $config['editor_password'];
    if (strlen($pw) < 10 || stripos($pw, 'change-me') !== false) {
        throw new ApiError(500, 'Setup problem: choose an editor_password of at least 10 characters in ' .
            FAS_CONFIG_FILE . '.');
    }
    $config['require_https'] = $config['require_https'] ?? true;
    return $config;
}

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
                $config['db_user'],
                $config['db_pass'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            error_log('Fasimaaku API: database connection failed: ' . $e->getMessage());
            throw new ApiError(500, 'Could not connect to the database. Check the db_ settings in ' .
                FAS_CONFIG_FILE . '.');
        }
    }
    return $pdo;
}

// ---------------------------------------------------------------------------
// Sessions and security helpers
// ---------------------------------------------------------------------------

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function start_session(): void
{
    session_name('FASSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();

    if (!empty($_SESSION['editor'])) {
        if (time() - (int) ($_SESSION['last_seen'] ?? 0) > FAS_SESSION_IDLE) {
            $_SESSION = [];
        } else {
            $_SESSION['last_seen'] = time();
        }
    }
}

function is_editor(): bool
{
    return !empty($_SESSION['editor']);
}

function require_editor(): void
{
    if (!is_editor()) {
        throw new ApiError(401, 'Please sign in to edit.');
    }
    $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        throw new ApiError(403, 'Your editing session expired. Reload the page and sign in again.');
    }
}

function read_json_body(): array
{
    $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (strpos($type, 'application/json') !== 0) {
        throw new ApiError(415, 'Expected a JSON request.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 100000);
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        throw new ApiError(400, 'Invalid JSON.');
    }
    return $data;
}

function password_matches(string $expected, string $given): bool
{
    // editor_password may be the password itself or a password_hash() hash.
    if (strpos($expected, '$2y$') === 0 || strpos($expected, '$argon2') === 0) {
        return password_verify($given, $expected);
    }
    return hash_equals($expected, $given);
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

function row_to_word(array $row): array
{
    $derivs = json_decode((string) $row['derivs'], true);
    return [
        'id'     => (int) $row['id'],
        'fas'    => $row['fas'],
        'eng'    => $row['eng'],
        'pos'    => $row['pos'],
        'expl'   => $row['expl'],
        'derivs' => is_array($derivs) ? array_values(array_filter($derivs, 'is_string')) : [],
    ];
}

function all_words(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, fas, eng, pos, expl, derivs FROM fas_words ORDER BY id')->fetchAll();
    return array_map('row_to_word', $rows);
}

function text_field(array $in, string $key, int $max, string $label): string
{
    $value = $in[$key] ?? '';
    if (!is_string($value)) {
        throw new ApiError(400, "$label must be text.");
    }
    $value = trim($value);
    if ($value === '') {
        throw new ApiError(422, 'Fasimāķu, English, part of speech and explanation are all required.');
    }
    if (mb_strlen($value) > $max) {
        throw new ApiError(422, "$label is too long (max $max characters).");
    }
    return $value;
}

function save_word(PDO $pdo, array $in): int
{
    $id   = isset($in['id']) && $in['id'] !== null ? (int) $in['id'] : null;
    $fas  = mb_strtolower(text_field($in, 'fas', 100, 'Fasimāķu word'));
    $eng  = mb_strtolower(text_field($in, 'eng', 255, 'English'));
    $pos  = mb_strtoupper(text_field($in, 'pos', 100, 'Part of speech'));
    $expl = text_field($in, 'expl', 5000, 'Explanation');

    $derivs = [];
    foreach ((array) ($in['derivs'] ?? []) as $d) {
        if (!is_string($d)) {
            throw new ApiError(400, 'Root words must be text.');
        }
        $d = mb_strtolower(trim($d));
        if ($d !== '' && $d !== $fas && !in_array($d, $derivs, true)) {
            if (mb_strlen($d) > 100) {
                throw new ApiError(422, 'A root word is too long.');
            }
            $derivs[] = $d;
        }
    }
    if (count($derivs) > 20) {
        throw new ApiError(422, 'Too many root words (max 20).');
    }
    $derivsJson = json_encode($derivs, JSON_UNESCAPED_UNICODE);

    $pdo->beginTransaction();
    try {
        if ($id === null) {
            $stmt = $pdo->prepare('INSERT INTO fas_words (fas, eng, pos, expl, derivs) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$fas, $eng, $pos, $expl, $derivsJson]);
            $id = (int) $pdo->lastInsertId();
        } else {
            $stmt = $pdo->prepare('SELECT fas FROM fas_words WHERE id = ? FOR UPDATE');
            $stmt->execute([$id]);
            $oldFas = $stmt->fetchColumn();
            if ($oldFas === false) {
                throw new ApiError(404, 'That word no longer exists. Reload the page.');
            }
            $stmt = $pdo->prepare('UPDATE fas_words SET fas = ?, eng = ?, pos = ?, expl = ?, derivs = ? WHERE id = ?');
            $stmt->execute([$fas, $eng, $pos, $expl, $derivsJson, $id]);

            // Renamed: point every word built from it at the new spelling.
            if ($oldFas !== $fas) {
                $update = $pdo->prepare('UPDATE fas_words SET derivs = ? WHERE id = ?');
                foreach (all_words($pdo) as $w) {
                    if (in_array($oldFas, $w['derivs'], true)) {
                        $new = array_values(array_unique(array_map(function ($d) use ($oldFas, $fas) {
                            return $d === $oldFas ? $fas : $d;
                        }, $w['derivs'])));
                        $update->execute([json_encode($new, JSON_UNESCAPED_UNICODE), $w['id']]);
                    }
                }
            }
        }
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') {
            throw new ApiError(409, "\u{201C}$fas\u{201D} already exists.");
        }
        throw $e;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return $id;
}

// Deletes a word and every word built from it, as the original app did.
function delete_word(PDO $pdo, int $id): int
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT fas FROM fas_words WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $fas = $stmt->fetchColumn();
        if ($fas === false) {
            throw new ApiError(404, 'That word no longer exists. Reload the page.');
        }
        $ids = [$id];
        foreach (all_words($pdo) as $w) {
            if (in_array($fas, $w['derivs'], true)) {
                $ids[] = $w['id'];
            }
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("DELETE FROM fas_words WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        $count = $stmt->rowCount();
        $pdo->commit();
        return $count;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function login(PDO $pdo, array $config, array $in): void
{
    if ($config['require_https'] && !is_https()) {
        throw new ApiError(403, 'For safety, signing in only works over https://. Open the page with https:// and try again.');
    }
    $ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
    $since = date('Y-m-d H:i:s', time() - FAS_LOCK_WINDOW_MIN * 60);

    $pdo->prepare('DELETE FROM fas_login_attempts WHERE attempted_at < ?')
        ->execute([date('Y-m-d H:i:s', time() - 86400)]);

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM fas_login_attempts WHERE ip = ? AND attempted_at >= ?');
    $stmt->execute([$ip, $since]);
    $mine = (int) $stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM fas_login_attempts WHERE attempted_at >= ?');
    $stmt->execute([$since]);
    $everyone = (int) $stmt->fetchColumn();
    if ($mine >= FAS_LOCK_PER_IP || $everyone >= FAS_LOCK_GLOBAL) {
        throw new ApiError(429, 'Too many wrong passwords. Try again in ' . FAS_LOCK_WINDOW_MIN . ' minutes.');
    }

    $given = $in['password'] ?? '';
    if (!is_string($given) || !password_matches($config['editor_password'], $given)) {
        $pdo->prepare('INSERT INTO fas_login_attempts (ip, attempted_at) VALUES (?, ?)')
            ->execute([$ip, date('Y-m-d H:i:s')]);
        usleep(500000);
        $left = FAS_LOCK_PER_IP - $mine - 1;
        throw new ApiError(401, 'Wrong password.' . ($left > 0 ? '' : ' Signing in is now locked for ' .
            FAS_LOCK_WINDOW_MIN . ' minutes.'));
    }

    $pdo->prepare('DELETE FROM fas_login_attempts WHERE ip = ?')->execute([$ip]);
    session_regenerate_id(true);
    $_SESSION = [
        'editor'    => true,
        'csrf'      => bin2hex(random_bytes(32)),
        'last_seen' => time(),
    ];
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

try {
    $action = (string) ($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $config = load_config();
    $pdo = db($config);

    if ($method === 'GET' && $action === 'words') {
        header('Cache-Control: no-cache');
        respond(['words' => all_words($pdo)]);
    }

    start_session();

    if ($method === 'GET' && $action === 'session') {
        respond(['editor' => is_editor(), 'csrf' => is_editor() ? $_SESSION['csrf'] : null]);
    }
    if ($method !== 'POST') {
        throw new ApiError(405, 'Unknown request.');
    }

    switch ($action) {
        case 'login':
            login($pdo, $config, read_json_body());
            respond(['editor' => true, 'csrf' => $_SESSION['csrf']]);
            break;
        case 'logout':
            require_editor();
            $_SESSION = [];
            session_regenerate_id(true);
            respond(['editor' => false]);
            break;
        case 'save':
            require_editor();
            $id = save_word($pdo, read_json_body());
            respond(['id' => $id, 'words' => all_words($pdo)]);
            break;
        case 'delete':
            require_editor();
            $in = read_json_body();
            $deleted = delete_word($pdo, (int) ($in['id'] ?? 0));
            respond(['deleted' => $deleted, 'words' => all_words($pdo)]);
            break;
        default:
            throw new ApiError(404, 'Unknown request.');
    }
} catch (ApiError $e) {
    respond(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('Fasimaaku API: ' . $e);
    respond(['error' => 'Something went wrong on the server. Try again in a moment.'], 500);
}
