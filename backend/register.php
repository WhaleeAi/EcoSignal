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

if ($role === 'admin' || $role === 'superadmin') {
    jsonResponse(['message' => 'Регистрация этой роли недоступна'], 403);
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

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    if ($role === 'admin') {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS admin_registration_requests (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100),
                    status VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP,
                    processed_by INT REFERENCES users(id) ON DELETE SET NULL
                )
            ");

            $existingRequestStmt = $pdo->prepare('
                SELECT id, status
                FROM admin_registration_requests
                WHERE email = :email
                LIMIT 1
            ');
            $existingRequestStmt->execute(['email' => $email]);
            $existingRequest = $existingRequestStmt->fetch();

            if ($existingRequest && ($existingRequest['status'] ?? '') === 'pending') {
                jsonResponse([
                    'message' => 'Заявка на регистрацию администратора уже отправлена и ожидает проверки'
                ], 409);
            }

            if ($existingRequest) {
                $requestStmt = $pdo->prepare('
                    UPDATE admin_registration_requests
                    SET password_hash = :password_hash,
                        first_name = :first_name,
                        last_name = :last_name,
                        status = :status,
                        requested_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                    RETURNING id, email, first_name, last_name, status, requested_at
                ');
                $requestStmt->execute([
                    'id' => (int)$existingRequest['id'],
                    'password_hash' => $passwordHash,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'status' => 'pending',
                ]);
            } else {
                $requestStmt = $pdo->prepare('
                    INSERT INTO admin_registration_requests (email, password_hash, first_name, last_name, status)
                    VALUES (:email, :password_hash, :first_name, :last_name, :status)
                    RETURNING id, email, first_name, last_name, status, requested_at
                ');
                $requestStmt->execute([
                    'email' => $email,
                    'password_hash' => $passwordHash,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'status' => 'pending',
                ]);
            }

            $request = $requestStmt->fetch();
        } catch (PDOException $e) {
            jsonResponse([
                'message' => 'Не удалось создать заявку администратора. Проверьте структуру таблицы admin_registration_requests.',
                'error' => $e->getMessage(),
            ], 500);
        }

        jsonResponse([
            'message' => 'Заявка на роль администратора отправлена супер-администратору',
            'requires_approval' => true,
            'request' => $request,
        ], 202);
    }

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
