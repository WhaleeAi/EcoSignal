<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$data = getJsonInput();

$fullName = trim((string)($data['fullname'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$password = trim((string)($data['password'] ?? ''));
$role = trim((string)($data['role'] ?? 'citizen'));

$allowedRoles = ['citizen', 'agency'];

if ($fullName === '' || $email === '' || $password === '' || $role === '') {
    jsonResponse(['message' => 'Заполните все поля'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['message' => 'Некорректный email'], 422);
}

if (mb_strlen($password) < 6) {
    jsonResponse(['message' => 'Пароль должен содержать минимум 6 символов'], 422);
}

if (!in_array($role, $allowedRoles, true)) {
    jsonResponse(['message' => 'Некорректная роль'], 422);
}

[$firstName, $lastName] = splitFullName($fullName);

if ($firstName === '') {
    jsonResponse(['message' => 'Укажите ФИО'], 422);
}

try {
    $pdo = getPDO();

    $checkUserStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
    $checkUserStmt->execute(['email' => $email]);

    if ($checkUserStmt->fetch()) {
        jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
    }

    $stmt = $pdo->prepare('
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES (:email, :password_hash, :first_name, :last_name, :role)
        RETURNING id, email, first_name, last_name, role, created_at
    ');

    $stmt->execute([
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'first_name' => $firstName,
        'last_name' => $lastName,
        'role' => $role,
    ]);

    $user = $stmt->fetch();
    $token = createJwtToken($user);

    jsonResponse([
        'message' => 'Регистрация успешна',
        'token' => $token,
        'user' => $user,
    ], 201);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], 500);
}
