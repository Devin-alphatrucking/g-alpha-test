<?php
// Optional real-world tie-in: exposes Alpha Trucking's "today" numbers to the game.
// The site owner maintains ../data/live.json (e.g. a nightly/hourly export from the dispatch system).
// Missing, disabled or malformed file => {"enabled":false} and the game simply hides the feature.
header('Content-Type: application/json');
header('Cache-Control: public, max-age=60');

$file = __DIR__ . '/../data/live.json';
$out = ['enabled' => false];

if (is_readable($file)) {
    $d = json_decode((string)file_get_contents($file), true);
    if (is_array($d) && !empty($d['enabled'])) {
        $out = [
            'enabled'    => true,
            'date'       => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($d['date'] ?? '')) ? $d['date'] : null,
            'deliveries' => max(0, min(100000, (int)($d['deliveries'] ?? 0))),
            'onTimePct'  => max(0, min(100, (float)($d['onTimePct'] ?? 0))),
        ];
    }
}
echo json_encode($out);
