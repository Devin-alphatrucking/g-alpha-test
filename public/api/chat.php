<?php
// DVN Haul – memory-aware AI customer lines.
// The API key lives server-side only (../../config.php or env). The client sends gameplay
// FACTS only (numbers, enums, whitelisted tags) – never free text – so nothing the player
// types can reach the model, and no personal data is sent.
header('Content-Type: application/json');

$personas = [
    'maple' => 'Granny Maple, a warm grandmother who bakes pies and loves gossip',
    'rex'   => 'Rex the Builder, a cheerful, always-in-a-hurry Australian construction foreman',
    'pixel' => 'Pixel, a quirky teenage streamer who talks in playful (but clean) slang',
    'doc'   => 'Dr. Whiskers, a cat veterinarian who makes gentle cat puns',
    'cap'   => 'Captain Nemo, a retired sea captain who tells tiny sea stories',
];

// tag => fact about the player, mirrored from src/story.ts
$facts = [
    'kind' => "said they're always happy to help", 'joker' => 'suggested laminating the recipe card',
    'apple' => 'voted for the apple pie', 'cherry' => 'voted cherry over apple pie',
    'secret' => 'promised to keep the secret ingredient', 'tease' => 'teased about telling Rex the secret',
    'library' => 'promised to come to the library opening', 'shed' => 'joked that a shed would be fine',
    'hat' => 'wore the hard hat proudly', 'fashion' => 'said the hard hat clashes with the truck',
    'door' => 'laid the ceremonial brick by the library door', 'hidden' => 'hid their brick as a secret',
    'hi_chat' => 'said hi to her stream chat', 'toaster' => 'defended the old toaster-sounding mic',
    'confetti' => 'voted for a confetti cannon', 'thanks' => 'suggested a quiet thank-you',
    'golden' => "named the stream 'Golden Hour Delivery Run'", 'lost' => "named the stream 'Pixel Gets Lost'",
    'mittens' => 'named the rescue kitten Mittens', 'floof' => 'named the kitten Captain Floof',
    'calm' => 'kept calm during the pup emergency', 'lights' => 'raced over with lights on for the pup',
    'pat' => 'said goodbye to the kitten with a gentle pat', 'selfie' => 'took a selfie on adoption day',
    'story' => 'asked to hear the sea story', 'fish' => 'said the sea chest smells like fish',
    'gold' => 'guessed the treasure was gold', 'better' => 'said the treasure is better than gold',
    'square' => 'hung the lighthouse lamp in the town square', 'house' => "wanted the lamp on the captain's house",
];

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$id = $in['customer'] ?? '';
if (!isset($personas[$id])) { http_response_code(400); echo '{"error":"bad customer"}'; exit; }

// Simple per-session rate limit (cost + abuse protection): 30 calls / 10 min.
session_start();
$now = time();
$_SESSION['hits'] = array_values(array_filter($_SESSION['hits'] ?? [], fn($t) => $t > $now - 600));
if (count($_SESSION['hits']) >= 30) { http_response_code(429); echo '{"error":"slow down"}'; exit; }
$_SESSION['hits'][] = $now;

$cfg = @include __DIR__ . '/../../config.php';
$key = getenv('ANTHROPIC_API_KEY') ?: ($cfg['ANTHROPIC_API_KEY'] ?? '');
if (!$key) { http_response_code(503); echo '{"error":"no key"}'; exit; }

// ---- sanitise everything the client sent ----
$int = fn($v, $lo, $hi) => max($lo, min($hi, (int)$v));
$stars   = $int($in['stars'] ?? 2, 1, 3);
$weather = in_array($in['weather'] ?? '', ['clear', 'rain', 'fog'], true) ? $in['weather'] : 'clear';
$night   = !empty($in['night']);
$crashed = !empty($in['crashed']);
$m       = is_array($in['mem'] ?? null) ? $in['mem'] : [];
$met = $int($m['met'] ?? 1, 0, 9999);  $aff = $int($m['aff'] ?? 0, 0, 100);
$fast = $int($m['fast'] ?? 0, 0, 9999); $late = $int($m['late'] ?? 0, 0, 9999);
$crashes = $int($m['crashes'] ?? 0, 0, 9999); $rain = $int($m['rain'] ?? 0, 0, 9999); $nights = $int($m['night'] ?? 0, 0, 9999);
$tags = [];
foreach (array_slice(is_array($m['tags'] ?? null) ? $m['tags'] : [], -4) as $t) {
    if (is_string($t) && isset($facts[$t])) $tags[] = 'The driver once ' . $facts[$t] . '.';
}

$bond = $aff >= 70 ? 'a very close friend' : ($aff >= 35 ? 'a friend' : ($aff >= 10 ? 'a friendly acquaintance' : 'still a stranger'));
$mem = [];
$mem[] = $met <= 1 ? 'This is the first time you have met the driver.' : "The driver has delivered to you $met times; you consider them $bond.";
if ($fast >= 3) $mem[] = "They are often very fast ($fast speedy deliveries).";
if ($late >= 2) $mem[] = "They have been late $late times.";
if ($crashes >= 1) $mem[] = "They have bumped into other cars $crashes time(s) on the way to you.";
if ($rain >= 2) $mem[] = "They have delivered through rain $rain times.";
if ($nights >= 2) $mem[] = "They have made $nights night deliveries.";
$mem = array_merge($mem, $tags);

$now_ctx = [];
$now_ctx[] = $stars === 3 ? 'This delivery was very fast.' : ($stars === 2 ? 'This delivery was on time.' : 'This delivery was late.');
if ($weather === 'rain') $now_ctx[] = 'It is raining right now.';
if ($weather === 'fog') $now_ctx[] = 'It is foggy right now.';
if ($night) $now_ctx[] = 'It is night time.';
if ($crashed) $now_ctx[] = 'The driver bumped a car on the way here.';

$system = "You play {$personas[$id]} in DVN Haul, a cozy all-ages delivery game. "
        . "Reply with ONE short in-character sentence (max 22 words) reacting to the delivery that just arrived. "
        . "You may naturally refer to AT MOST ONE remembered detail about the driver, only if it fits; otherwise just react. "
        . "Family-friendly, warm, no real brands, never ask for personal information, never break character.";

$payload = json_encode([
    'model' => 'claude-haiku-5-5',
    'max_tokens' => 90,
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => "What you remember about the driver:\n- " . implode("\n- ", $mem) . "\n\nRight now:\n- " . implode("\n- ", $now_ctx)]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['content-type: application/json', "x-api-key: $key", 'anthropic-version: 2023-06-01'],
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode((string)$res, true);
$line = $data['content'][0]['text'] ?? '';
if ($code !== 200 || $line === '') { http_response_code(502); echo '{"error":"upstream"}'; exit; }
echo json_encode(['line' => trim($line)]);
