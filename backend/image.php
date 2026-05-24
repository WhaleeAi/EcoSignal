<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$imageId = (int)($_GET['id'] ?? 0);
if ($imageId <= 0) {
    jsonResponse(['message' => 'Некорректный идентификатор изображения'], 422);
}

try {
    $pdo = getPDO();
    $stmt = $pdo->prepare('
        SELECT data, content_type, filename, size
        FROM images
        WHERE id = :id
        LIMIT 1
    ');
    $stmt->execute(['id' => $imageId]);
    $image = $stmt->fetch();

    if (!$image) {
        jsonResponse(['message' => 'Изображение не найдено'], 404);
    }

    $contentType = (string)($image['content_type'] ?: 'image/jpeg');
    $filename = basename((string)($image['filename'] ?: ('image-' . $imageId)));
    $data = $image['data'];

    if (is_resource($data)) {
        $data = stream_get_contents($data);
    }

    if (!is_string($data) || $data === '') {
        jsonResponse(['message' => 'Изображение пустое'], 404);
    }

    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . strlen($data));
    header('Content-Disposition: inline; filename="' . addcslashes($filename, "\"\\") . '"');
    header('Cache-Control: public, max-age=86400');
    echo $data;
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
