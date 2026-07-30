<?php
// Quick test endpoint for kbd-bridge heartbeats. No auth (heartbeat client
// deliberately sends none — see kbd-bridge.py send_heartbeat()).
header('Content-Type: application/json');

$dataFile = __DIR__ . '/data/heartbeats.json';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);

if (!is_array($payload) || empty($payload['screenId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'missing screenId']);
    exit;
}

$screenId = (string) $payload['screenId'];

$entry = [
    'screenId'    => $screenId,
    'online'      => $payload['online'] ?? null,
    'hdmiActive'  => $payload['hdmiActive'] ?? null,
    'readerCount' => $payload['readerCount'] ?? null,
    'receivedAt'  => gmdate('Y-m-d\TH:i:s\Z'),
    'remoteAddr'  => $_SERVER['REMOTE_ADDR'] ?? '',
];

$fp = fopen($dataFile, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'cannot open data file']);
    exit;
}

flock($fp, LOCK_EX);
$size = filesize($dataFile);
$contents = $size > 0 ? fread($fp, $size) : '';
$all = json_decode($contents, true);
if (!is_array($all)) {
    $all = [];
}
$all[$screenId] = $entry;

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['ok' => true]);
