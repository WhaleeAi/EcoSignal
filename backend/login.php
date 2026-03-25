<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$data = getJsonInput();

$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if ($email === '' || $password === '') {
    jsonResponse(['message' => 'Введите email и пароль'], 422);
}

try {
    $pdo = getPDO();

    $stmt = $pdo->prepare('
        SELECT id, email, password_hash, first_name, last_name, role, created_at
        FROM users
        WHERE email = :email
    ');
    $stmt->execute(['email' => $email]);

    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['message' => 'Неверный email или пароль'], 401);
    }

    $token = createJwtToken($user);

    unset($user['password_hash']);

    jsonResponse([
        'message' => 'Вход выполнен успешно',
        'token' => $token,
        'user' => $user
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage()
    ], 500);
}