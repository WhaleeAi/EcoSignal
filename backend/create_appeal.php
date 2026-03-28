<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

function normalizeUploadedImages(?array $imagesField): array
{
    if (!$imagesField || !isset($imagesField['name'])) {
        return [];
    }

    $normalized = [];
    $isMultiple = is_array($imagesField['name']);

    if (!$isMultiple) {
        return [[
            'name' => (string)$imagesField['name'],
            'type' => (string)$imagesField['type'],
            'tmp_name' => (string)$imagesField['tmp_name'],
            'error' => (int)$imagesField['error'],
            'size' => (int)$imagesField['size'],
        ]];
    }

    $total = count($imagesField['name']);

    for ($i = 0; $i < $total; $i++) {
        $normalized[] = [
            'name' => (string)$imagesField['name'][$i],
            'type' => (string)$imagesField['type'][$i],
            'tmp_name' => (string)$imagesField['tmp_name'][$i],
            'error' => (int)$imagesField['error'][$i],
            'size' => (int)$imagesField['size'][$i],
        ];
    }

    return $normalized;
}

$user = requireAuth();
$contentType = (string)($_SERVER['CONTENT_TYPE'] ?? '');
$data = stripos($contentType, 'application/json') !== false ? getJsonInput() : $_POST;
$uploadedImages = normalizeUploadedImages($_FILES['images'] ?? null);

$categoryId = (int)($data['category_id'] ?? 0);
$subcategoryRaw = $data['subcategory_id'] ?? null;
$subcategoryId = ($subcategoryRaw === null || $subcategoryRaw === '') ? null : (int)$subcategoryRaw;
$description = trim((string)($data['description'] ?? ''));
$latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
$longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;
$priority = isset($data['priority']) ? (int)$data['priority'] : 0;

if ($categoryId <= 0) {
    jsonResponse(['message' => 'Выберите категорию'], 422);
}

if ($description === '') {
    jsonResponse(['message' => 'Добавьте описание проблемы'], 422);
}

if ($latitude === null || $latitude < -90 || $latitude > 90) {
    jsonResponse(['message' => 'Некорректная широта'], 422);
}

if ($longitude === null || $longitude < -180 || $longitude > 180) {
    jsonResponse(['message' => 'Некорректная долгота'], 422);
}

if ($priority < 0 || $priority > 5) {
    jsonResponse(['message' => 'Приоритет должен быть от 0 до 5'], 422);
}

try {
    $pdo = getPDO();
    $pdo->beginTransaction();

    $categoryCheck = $pdo->prepare('SELECT id FROM categories WHERE id = :id');
    $categoryCheck->execute(['id' => $categoryId]);

    if (!$categoryCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Категория не найдена'], 422);
    }

    if ($subcategoryId !== null) {
        $subcategoryCheck = $pdo->prepare('
            SELECT id
            FROM subcategories
            WHERE id = :id AND category_id = :category_id
        ');
        $subcategoryCheck->execute([
            'id' => $subcategoryId,
            'category_id' => $categoryId,
        ]);

        if (!$subcategoryCheck->fetch()) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Подкатегория не принадлежит выбранной категории'], 422);
        }
    }

    $appealStmt = $pdo->prepare('
        INSERT INTO appeals (
            user_id,
            category_id,
            subcategory_id,
            description,
            latitude,
            longitude,
            priority
        )
        VALUES (
            :user_id,
            :category_id,
            :subcategory_id,
            :description,
            :latitude,
            :longitude,
            :priority
        )
        RETURNING id, user_id, category_id, subcategory_id, status, description, latitude, longitude, priority, created_at
    ');

    $appealStmt->execute([
        'user_id' => (int)$user['id'],
        'category_id' => $categoryId,
        'subcategory_id' => $subcategoryId,
        'description' => $description,
        'latitude' => $latitude,
        'longitude' => $longitude,
        'priority' => $priority,
    ]);

    $appeal = $appealStmt->fetch();
    $appealId = (int)$appeal['id'];

    $savedImages = [];
    if (!empty($uploadedImages)) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $imageStmt = $pdo->prepare("
            INSERT INTO images (appeal_id, data, content_type, filename, size)
            VALUES (:appeal_id, decode(:data_base64, 'base64'), :content_type, :filename, :size)
            RETURNING id, content_type, filename, size, uploaded_at
        ");

        foreach ($uploadedImages as $image) {
            if ((int)$image['error'] === UPLOAD_ERR_NO_FILE) {
                continue;
            }

            if ((int)$image['error'] !== UPLOAD_ERR_OK) {
                $pdo->rollBack();
                jsonResponse(['message' => 'Ошибка загрузки файла'], 422);
            }

            $tmpName = (string)$image['tmp_name'];
            if ($tmpName === '' || !is_uploaded_file($tmpName)) {
                $pdo->rollBack();
                jsonResponse(['message' => 'Некорректный загруженный файл'], 422);
            }

            $binaryData = file_get_contents($tmpName);
            if ($binaryData === false) {
                $pdo->rollBack();
                jsonResponse(['message' => 'Не удалось прочитать файл'], 422);
            }

            $detectedType = (string)$finfo->file($tmpName);
            $contentTypeValue = in_array($detectedType, $allowedTypes, true)
                ? $detectedType
                : (string)$image['type'];

            if (!in_array($contentTypeValue, $allowedTypes, true)) {
                $pdo->rollBack();
                jsonResponse(['message' => 'Допустимы только изображения JPEG/PNG/WEBP/GIF'], 422);
            }

            $filename = basename((string)$image['name']);
            $size = strlen($binaryData);

            $imageStmt->execute([
                'appeal_id' => $appealId,
                'data_base64' => base64_encode($binaryData),
                'content_type' => $contentTypeValue,
                'filename' => $filename,
                'size' => $size,
            ]);

            $savedImages[] = $imageStmt->fetch();
        }
    }

    $pdo->commit();

    jsonResponse([
        'message' => 'Заявка создана',
        'appeal' => $appeal,
        'images' => $savedImages,
    ], 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
