<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

function requireAuth(): array
{
    $token = getBearerToken();

    if (!$token) {
        jsonResponse([
            'message' => 'Токен не передан'
        ], 401);
    }

    try {
        $decoded = decodeJwtToken($token);
        $userId = (int)($decoded->sub ?? 0);

        if ($userId <= 0) {
            jsonResponse([
                'message' => 'Некорректный токен'
            ], 401);
        }

        $pdo = getPDO();
        $stmt = $pdo->prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse([
                'message' => 'Пользователь не найден'
            ], 401);
        }

        return $user;
    } catch (Throwable $e) {
        jsonResponse([
            'message' => 'Недействительный или просроченный токен'
        ], 401);
    }
}