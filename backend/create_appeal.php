<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

function parsePhpSizeToBytes(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }

    $unit = strtolower($value[strlen($value) - 1]);
    $number = (float)$value;

    return match ($unit) {
        'g' => (int)($number * 1024 * 1024 * 1024),
        'm' => (int)($number * 1024 * 1024),
        'k' => (int)($number * 1024),
        default => (int)$number,
    };
}

function validateRequestBodySize(): void
{
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    $postMaxSize = parsePhpSizeToBytes((string)ini_get('post_max_size'));

    if ($postMaxSize > 0 && $contentLength > $postMaxSize) {
        jsonResponse([
            'message' => 'Файлы слишком большие для загрузки',
            'error' => 'Размер запроса превышает post_max_size=' . ini_get('post_max_size'),
        ], 413);
    }
}

function getUploadErrorMessage(int $errorCode): string
{
    return match ($errorCode) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файл превышает допустимый размер загрузки',
        UPLOAD_ERR_PARTIAL => 'Файл загрузился не полностью',
        UPLOAD_ERR_NO_TMP_DIR => 'На сервере не настроена временная папка для загрузки',
        UPLOAD_ERR_CANT_WRITE => 'Сервер не смог записать загруженный файл',
        UPLOAD_ERR_EXTENSION => 'PHP-расширение остановило загрузку файла',
        default => 'Ошибка загрузки файла',
    };
}

function normalizeUploadedImages(?array $imagesField): array
{
    if (!$imagesField || !isset($imagesField['name'])) {
        return [];
    }

    if (!is_array($imagesField['name'])) {
        return [[
            'name' => (string)$imagesField['name'],
            'type' => (string)$imagesField['type'],
            'tmp_name' => (string)$imagesField['tmp_name'],
            'error' => (int)$imagesField['error'],
            'size' => (int)$imagesField['size'],
        ]];
    }

    $normalized = [];
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

function detectUploadedImageType(string $tmpName, string $fallbackType): string
{
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedType = $finfo->file($tmpName);

        if (is_string($detectedType) && $detectedType !== '') {
            return $detectedType;
        }
    }

    $imageInfo = @getimagesize($tmpName);
    if (is_array($imageInfo) && isset($imageInfo['mime']) && is_string($imageInfo['mime'])) {
        return $imageInfo['mime'];
    }

    return $fallbackType;
}

function prepareUploadedImages(array $uploadedImages): array
{
    $prepared = [];
    $maxImageSize = 5 * 1024 * 1024;
    $allowedTypes = ['image/jpeg', 'image/png'];
    $allowedExtensions = ['jpg', 'jpeg', 'png'];

    foreach ($uploadedImages as $image) {
        if ((int)$image['error'] === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        if ((int)$image['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['message' => getUploadErrorMessage((int)$image['error'])], 422);
        }

        if ((int)$image['size'] > $maxImageSize) {
            jsonResponse(['message' => 'Размер каждого фото не должен превышать 5 МБ'], 422);
        }

        $extension = strtolower(pathinfo((string)$image['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExtensions, true)) {
            jsonResponse(['message' => 'Допустимы только файлы PNG, JPG и JPEG'], 422);
        }

        $tmpName = (string)$image['tmp_name'];
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            jsonResponse(['message' => 'Некорректный загруженный файл'], 422);
        }

        $binaryData = file_get_contents($tmpName);
        if ($binaryData === false) {
            jsonResponse(['message' => 'Не удалось прочитать файл'], 422);
        }

        $detectedType = detectUploadedImageType($tmpName, (string)$image['type']);
        $contentType = in_array($detectedType, $allowedTypes, true)
            ? $detectedType
            : (string)$image['type'];

        if (!in_array($contentType, $allowedTypes, true)) {
            jsonResponse(['message' => 'Допустимы только файлы PNG, JPG и JPEG'], 422);
        }

        $prepared[] = [
            'filename' => basename((string)$image['name']),
            'content_type' => $contentType,
            'size' => strlen($binaryData),
            'data_base64' => base64_encode($binaryData),
        ];
    }

    return $prepared;
}

function insertSystemAppealChatMessage(PDO $pdo, int $appealId, string $message): void
{
    $stmt = $pdo->prepare('
        INSERT INTO appeal_chats (
            appeal_id,
            sender_user_id,
            sender_org_admin_id,
            message
        ) VALUES (
            :appeal_id,
            NULL,
            NULL,
            :message
        )
    ');
    $stmt->execute([
        'appeal_id' => $appealId,
        'message' => $message,
    ]);
}

validateRequestBodySize();

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

try {
    $pdo = getPDO();
    $preparedImages = prepareUploadedImages($uploadedImages);

    if (($user['auth_source'] ?? 'users') !== 'users') {
        jsonResponse(['message' => 'Создавать заявки может только пользователь'], 403);
    }

    $categoryStmt = $pdo->prepare('
        SELECT id
        FROM categories
        WHERE id = :id
        LIMIT 1
    ');
    $categoryStmt->execute(['id' => $categoryId]);

    if (!$categoryStmt->fetch()) {
        jsonResponse(['message' => 'Категория не найдена'], 422);
    }

    if ($subcategoryId !== null) {
        $subcategoryStmt = $pdo->prepare('
            SELECT id
            FROM subcategories
            WHERE id = :id AND category_id = :category_id
            LIMIT 1
        ');
        $subcategoryStmt->execute([
            'id' => $subcategoryId,
            'category_id' => $categoryId,
        ]);

        if (!$subcategoryStmt->fetch()) {
            jsonResponse(['message' => 'Подкатегория не принадлежит выбранной категории'], 422);
        }
    }

    $pdo->beginTransaction();

    $appealStmt = $pdo->prepare('
        INSERT INTO appeals (
            user_id,
            category_id,
            subcategory_id,
            status,
            description,
            latitude,
            longitude,
            priority
        )
        VALUES (
            :user_id,
            :category_id,
            :subcategory_id,
            :status,
            :description,
            :latitude,
            :longitude,
            :priority
        )
        RETURNING
            id,
            user_id,
            category_id,
            subcategory_id,
            status,
            description,
            latitude,
            longitude,
            priority,
            created_at
    ');

    $appealStmt->execute([
        'user_id' => (int)$user['id'],
        'category_id' => $categoryId,
        'subcategory_id' => $subcategoryId,
        'status' => 'pending',
        'description' => $description,
        'latitude' => $latitude,
        'longitude' => $longitude,
        'priority' => 0,
    ]);

    $appeal = $appealStmt->fetch();
    $appealId = (int)$appeal['id'];
    $savedImages = [];

    if ($preparedImages) {
        $imageStmt = $pdo->prepare('
            INSERT INTO images (appeal_id, data, content_type, filename, size)
            VALUES (:appeal_id, decode(:data_base64, \'base64\'), :content_type, :filename, :size)
            RETURNING id, content_type, filename, size, uploaded_at
        ');

        foreach ($preparedImages as $image) {
            $imageStmt->execute([
                'appeal_id' => $appealId,
                'data_base64' => $image['data_base64'],
                'content_type' => $image['content_type'],
                'filename' => $image['filename'],
                'size' => $image['size'],
            ]);

            $savedImages[] = $imageStmt->fetch();
        }
    }

    insertSystemAppealChatMessage(
        $pdo,
        $appealId,
        'Заявка отправлена на автоматическую проверку. EcoSignal AI анализирует описание, категорию и прикрепленные фотографии.'
    );

    $pdo->commit();

    jsonResponse([
        'message' => 'Заявка создана и отправлена на автоматическую AI-проверку.',
        'appeal' => $appeal,
        'images' => $savedImages,
        'ai_processing_required' => true,
    ], 201);
} catch (Throwable $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка создания заявки',
        'error' => $e->getMessage(),
    ], 500);
}
