<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$user = requireAuth();

if (($user['role'] ?? null) !== 'superadmin') {
    jsonResponse(['message' => 'Доступ только для superadmin'], 403);
}

try {
    $pdo = getPDO();

    $requestsStmt = $pdo->query("
        SELECT id, email, first_name, last_name, status, requested_at
        FROM admin_registration_requests
        WHERE status = 'pending'
        ORDER BY requested_at DESC
    ");
    $requests = $requestsStmt->fetchAll();

    $adminsStmt = $pdo->query("
        SELECT id, email, first_name, last_name, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at DESC
    ");
    $admins = $adminsStmt->fetchAll();

    jsonResponse([
        'message' => 'Данные панели superadmin загружены',
        'user' => $user,
        'pending_requests' => $requests,
        'admins' => $admins,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
