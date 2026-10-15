<?php
// DVN Haul – Play Rooms (up to 6 drivers). Works on plain PHP hosting: clients poll ~6x/second.
// Safety by design: no free text ever. Names are generated here, emotes come from a whitelist,
// numbers are clamped, and each request needs the id+token issued on join.
header('Content-Type: application/json');
header('Cache-Control: no-store');

const MAX_PLAYERS = 6;
const STALE_SECS = 15;      // a driver silent this long is dropped
const ROOM_TTL = 1800;      // empty rooms vanish after 30 minutes
const GOAL = 20;            // team deliveries for the convoy reward
const EMOTES = ['hi', 'gg', 'wait', 'thanks', 'go'];
const SKINS = ['classic', 'outback', 'midnight', 'pie', 'hardhat', 'stream', 'vet', 'captain'];
const ADJ = ['Happy', 'Speedy', 'Sunny', 'Brave', 'Cosy', 'Lucky', 'Jolly', 'Zippy', 'Mighty', 'Chill'];
const ANI = ['Koala', 'Wombat', 'Kookaburra', 'Quokka', 'Emu', 'Dingo', 'Platypus', 'Roo', 'Echidna', 'Possum'];

// (no return types: keeps this file compatible with PHP 7.4+)
function out(array $d, int $code = 200) { http_response_code($code); echo json_encode($d); exit; }
function fail(string $m, int $code = 400) { out(['error' => $m], $code); }

$dir = sys_get_temp_dir() . '/dvn-haul-rooms';
if (!is_dir($dir)) @mkdir($dir, 0700, true);

$in = json_decode(file_get_contents('php://input'), true);
$in = is_array($in) ? $in : [];
$a = $_GET['a'] ?? '';
$now = microtime(true);

// ---- tiny per-IP rate limit (creating rooms is the only expensive thing) ----
function rate(string $dir, string $key, int $max, int $window): void {
    $f = $dir . '/rl_' . md5($key . '|' . $_SERVER['REMOTE_ADDR']) . '.json';
    $h = is_file($f) ? json_decode((string)file_get_contents($f), true) : [];
    $t = time();
    $h = array_values(array_filter(is_array($h) ? $h : [], fn($x) => $x > $t - $window));
    if (count($h) >= $max) fail('slow down', 429);
    $h[] = $t;
    file_put_contents($f, json_encode($h), LOCK_EX);
}

// ---- cleanup of dead rooms (cheap, runs on create/join) ----
function sweep(string $dir): void {
    foreach (glob($dir . '/room_*.json') ?: [] as $f) if (filemtime($f) < time() - ROOM_TTL) @unlink($f);
    foreach (glob($dir . '/rl_*.json') ?: [] as $f) if (filemtime($f) < time() - 3600) @unlink($f);
}

function roomFile(string $dir, string $code): string { return $dir . '/room_' . $code . '.json'; }
function validCode(string $c): bool { return (bool)preg_match('/^[A-HJ-NP-Z]{4}$/', $c); }

/** Runs $fn(&$room) while holding an exclusive lock on the room file; saves the result. */
function withRoom(string $dir, string $code, callable $fn) {
    if (!validCode($code)) fail('bad code');
    $f = roomFile($dir, $code);
    if (!is_file($f)) fail('room not found', 404);
    $fh = fopen($f, 'c+');
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $room = json_decode((string)$raw, true);
    if (!is_array($room)) { flock($fh, LOCK_UN); fclose($fh); fail('room not found', 404); }
    $res = $fn($room);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($room));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $res;
}

function prune(array &$room, float $now): void {
    foreach ($room['players'] as $id => $p) if ($now - $p['t'] > STALE_SECS) unset($room['players'][$id]);
}

function num($v, float $lo, float $hi): float { return max($lo, min($hi, is_numeric($v) ? (float)$v : 0)); }

function snapshot(array $room, string $me): array {
    $others = [];
    foreach ($room['players'] as $id => $p) {
        if ($id === $me) continue;
        $others[] = ['id' => $id, 'name' => $p['name'], 'x' => $p['x'], 'y' => $p['y'], 'a' => $p['a'], 'v' => $p['v'], 'skin' => $p['skin'], 'del' => $p['del']];
    }
    return $others;
}

switch ($a) {
    case 'create': {
        rate($dir, 'create', 6, 60);
        sweep($dir);
        $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        for ($i = 0; $i < 30; $i++) {
            $code = '';
            for ($k = 0; $k < 4; $k++) $code .= $letters[random_int(0, strlen($letters) - 1)];
            if (!is_file(roomFile($dir, $code))) break;
            $code = '';
        }
        if ($code === '') fail('try again', 503);
        file_put_contents(roomFile($dir, $code), json_encode(['code' => $code, 'created' => $now, 'players' => [], 'team' => 0, 'rewarded' => false, 'emotes' => [], 'seq' => 0]), LOCK_EX);
        out(['code' => $code]);
    }

    case 'join': {
        rate($dir, 'join', 30, 60);
        sweep($dir);
        $code = strtoupper(substr((string)($in['code'] ?? ''), 0, 4));
        $skin = in_array($in['skin'] ?? '', SKINS, true) ? $in['skin'] : 'classic';
        $res = withRoom($dir, $code, function (&$room) use ($now, $skin) {
            prune($room, $now);
            if (count($room['players']) >= MAX_PLAYERS) fail('room is full', 409);
            $id = bin2hex(random_bytes(4));
            $token = bin2hex(random_bytes(8));
            $name = ADJ[random_int(0, 9)] . ' ' . ANI[random_int(0, 9)] . ' ' . random_int(10, 99);
            $room['players'][$id] = ['name' => $name, 'token' => $token, 'x' => 960, 'y' => 900, 'a' => -1.57, 'v' => 0, 'skin' => $skin, 'del' => 0, 't' => $now];
            $room['emotes'][] = ['seq' => ++$room['seq'], 'id' => $id, 'e' => 'join'];
            return ['id' => $id, 'token' => $token, 'name' => $name, 'seq' => $room['seq']];
        });
        out(['code' => $code] + $res + ['goal' => GOAL]);
    }

    case 'sync': {
        $code = strtoupper(substr((string)($in['code'] ?? ''), 0, 4));
        $id = (string)($in['id'] ?? '');
        $since = (int)($in['since'] ?? 0);
        $res = withRoom($dir, $code, function (&$room) use ($in, $id, $now, $since) {
            if (!isset($room['players'][$id]) || !hash_equals($room['players'][$id]['token'], (string)($in['token'] ?? ''))) fail('not in room', 403);
            $p = &$room['players'][$id];
            $p['x'] = round(num($in['x'] ?? 0, 0, 1920), 1);
            $p['y'] = round(num($in['y'] ?? 0, 0, 1280), 1);
            $p['a'] = round(num($in['a'] ?? 0, -7, 7), 3);
            $p['v'] = round(num($in['v'] ?? 0, -400, 400), 1);
            if (in_array($in['skin'] ?? '', SKINS, true)) $p['skin'] = $in['skin'];
            // `del` = deliveries finished since joining. Growth is capped per sync so a tampered client can't fake a huge jump.
            $del = (int)num($in['del'] ?? 0, 0, 1000000);
            $gain = max(0, min(3, $del - $p['del']));
            $p['del'] += $gain;
            $room['team'] += $gain;
            $p['t'] = $now;
            prune($room, $now);
            $goalNow = false;
            if (!$room['rewarded'] && $room['team'] >= GOAL) { $room['rewarded'] = true; $room['emotes'][] = ['seq' => ++$room['seq'], 'id' => $id, 'e' => 'goal']; $goalNow = true; }
            $room['emotes'] = array_slice($room['emotes'], -30);
            $ev = array_values(array_filter($room['emotes'], fn($e) => $e['seq'] > $since));
            return ['players' => snapshot($room, $id), 'team' => $room['team'], 'goal' => GOAL, 'rewarded' => $room['rewarded'], 'events' => $ev, 'seq' => $room['seq'], 'count' => count($room['players'])];
        });
        out($res);
    }

    case 'emote': {
        $code = strtoupper(substr((string)($in['code'] ?? ''), 0, 4));
        $id = (string)($in['id'] ?? '');
        $e = (string)($in['e'] ?? '');
        if (!in_array($e, EMOTES, true)) fail('bad emote');
        withRoom($dir, $code, function (&$room) use ($in, $id, $e) {
            if (!isset($room['players'][$id]) || !hash_equals($room['players'][$id]['token'], (string)($in['token'] ?? ''))) fail('not in room', 403);
            $room['emotes'][] = ['seq' => ++$room['seq'], 'id' => $id, 'e' => $e];
        });
        out(['ok' => true]);
    }

    case 'leave': {
        $code = strtoupper(substr((string)($in['code'] ?? ''), 0, 4));
        $id = (string)($in['id'] ?? '');
        if (validCode($code) && is_file(roomFile($dir, $code))) {
            withRoom($dir, $code, function (&$room) use ($in, $id) {
                if (isset($room['players'][$id]) && hash_equals($room['players'][$id]['token'], (string)($in['token'] ?? ''))) unset($room['players'][$id]);
            });
        }
        out(['ok' => true]);
    }

    default:
        fail('unknown action', 404);
}
