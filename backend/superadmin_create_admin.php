<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$user = requireAuth();

if (($user['role'] ?? null) !== 'superadmin') {
    jsonResponse(['message' => 'Доступ только для superadmin'], 403);
}

$data = getJsonInput();

$fullName = trim($data['fullname'] ?? '');
$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if ($fullName === '' || $email === '' || $password === '') {
    jsonResponse(['message' => 'Заполните все поля'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['message' => 'Некорректный email'], 422);
}

if (mb_strlen($password) < 6) {
    jsonResponse(['message' => 'Пароль должен содержать минимум 6 символов'], 422);
}

[$firstName, $lastName] = splitFullName($fullName);
if ($firstName === '') {
    jsonResponse(['message' => 'Укажите ФИО'], 422);
}

try {
    $pdo = getPDO();

    $existingUserStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existingUserStmt->execute(['email' => $email]);
    if ($existingUserStmt->fetch()) {
        jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
    }

    $existingPendingStmt = $pdo->prepare("SELECT id FROM admin_registration_requests WHERE email = :email AND status = 'pending' LIMIT 1");
    $existingPendingStmt->execute(['email' => $email]);
    if ($existingPendingStmt->fetch()) {
        jsonResponse(['message' => 'Для этого email уже есть заявка на проверке'], 409);
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
        'role' => 'admin',
    ]);

    $admin = $stmt->fetch();

    jsonResponse([
        'message' => 'Администратор добавлен',
        'admin' => $admin,
    ], 201);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
