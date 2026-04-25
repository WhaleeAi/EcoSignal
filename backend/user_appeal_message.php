<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$user = requireAuth();

if (!in_array(($user['role'] ?? ''), ['citizen', 'user'], true)) {
    jsonResponse(['message' => 'Доступ только для пользователя'], 403);
}

$data = getJsonInput();
$appealId = (int)($data['appeal_id'] ?? 0);
$message = trim((string)($data['message'] ?? ''));

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

if ($message === '') {
    jsonResponse(['message' => 'Введите сообщение'], 422);
}

try {
    $pdo = getPDO();
    $userId = (int)$user['id'];

    $appealStmt = $pdo->prepare('
        SELECT id
        FROM appeals
        WHERE id = :appeal_id
          AND user_id = :user_id
        LIMIT 1
    ');
    $appealStmt->execute([
        'appeal_id' => $appealId,
        'user_id' => $userId,
    ]);

    if (!$appealStmt->fetch()) {
        jsonResponse(['message' => 'Заявка не найдена'], 404);
    }

    $insertStmt = $pdo->prepare('
        INSERT INTO appeal_chats (
            appeal_id,
            sender_user_id,
            message
        ) VALUES (
            :appeal_id,
            :sender_user_id,
            :message
        )
    ');
    $insertStmt->execute([
        'appeal_id' => $appealId,
        'sender_user_id' => $userId,
        'message' => $message,
    ]);

    jsonResponse([
        'message' => 'Сообщение отправлено',
        'chat_message' => [
            'appeal_id' => $appealId,
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
