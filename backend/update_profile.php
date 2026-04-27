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

if (($user['auth_source'] ?? 'users') !== 'users' || !in_array(($user['role'] ?? ''), ['citizen', 'user'], true)) {
    jsonResponse(['message' => 'Редактирование профиля доступно только пользователю'], 403);
}

$data = getJsonInput();
$fullName = trim((string)($data['fullname'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$about = trim((string)($data['about'] ?? ''));

if ($fullName === '') {
    jsonResponse(['message' => 'Укажите ФИО'], 422);
}

if ($email === '') {
    jsonResponse(['message' => 'Укажите email'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['message' => 'Некорректный email'], 422);
}

[$firstName, $lastName] = splitFullName($fullName);

if ($firstName === '') {
    jsonResponse(['message' => 'Укажите ФИО'], 422);
}

if (mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100) {
    jsonResponse(['message' => 'ФИО слишком длинное'], 422);
}

if (mb_strlen($about) > 1000) {
    jsonResponse(['message' => 'Поле «О себе» слишком длинное'], 422);
}

try {
    $pdo = getPDO();
    $userId = (int)$user['id'];

    $duplicateStmt = $pdo->prepare('
        SELECT id
        FROM users
        WHERE email = :email
          AND id <> :id
        LIMIT 1
    ');
    $duplicateStmt->execute([
        'email' => $email,
        'id' => $userId,
    ]);

    if ($duplicateStmt->fetch()) {
        jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
    }

    $updateStmt = $pdo->prepare('
        UPDATE users
        SET
            first_name = :first_name,
            last_name = :last_name,
            email = :email,
            about = :about
        WHERE id = :id
    ');
    $updateStmt->execute([
        'id' => $userId,
        'first_name' => $firstName,
        'last_name' => $lastName !== '' ? $lastName : null,
        'email' => $email,
        'about' => $about !== '' ? $about : null,
    ]);

    $userStmt = $pdo->prepare('
        SELECT id, email, first_name, last_name, about, role, created_at
        FROM users
        WHERE id = :id
        LIMIT 1
    ');
    $userStmt->execute(['id' => $userId]);
    $updatedUser = $userStmt->fetch();

    if (!$updatedUser) {
        jsonResponse(['message' => 'Пользователь не найден'], 404);
    }

    $updatedUser['auth_source'] = 'users';

    jsonResponse([
        'message' => 'Профиль обновлен',
        'user' => $updatedUser,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
