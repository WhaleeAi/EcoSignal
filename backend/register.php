<?php

declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$data = getJsonInput();

$fullName = trim($data['fullname'] ?? '');
$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');
$role = trim($data['role'] ?? 'citizen');

$allowedRoles = ['citizen', 'agency', 'admin'];

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

    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
    $checkStmt->execute(['email' => $email]);

    if ($checkStmt->fetch()) {
        jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES (:email, :password_hash, :first_name, :last_name, :role)
        RETURNING id, email, first_name, last_name, role, created_at
    ');

    $stmt->execute([
        'email' => $email,
        'password_hash' => $passwordHash,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'role' => $role,
    ]);

    $user = $stmt->fetch();
    $token = createJwtToken($user);

    jsonResponse([
        'message' => 'Регистрация успешна',
        'token' => $token,
        'user' => $user
    ], 201);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 500);
}