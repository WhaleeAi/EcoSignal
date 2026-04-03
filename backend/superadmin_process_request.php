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
$requestId = (int)($data['request_id'] ?? 0);
$action = trim((string)($data['action'] ?? ''));

if ($requestId <= 0 || !in_array($action, ['approve', 'reject'], true)) {
    jsonResponse(['message' => 'Некорректные параметры'], 422);
}

try {
    $pdo = getPDO();
    $pdo->beginTransaction();

    $requestStmt = $pdo->prepare('
        SELECT id, email, password_hash, first_name, last_name, status
        FROM admin_registration_requests
        WHERE id = :id
        FOR UPDATE
    ');
    $requestStmt->execute(['id' => $requestId]);
    $request = $requestStmt->fetch();

    if (!$request) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка не найдена'], 404);
    }

    if (($request['status'] ?? '') !== 'pending') {
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка уже обработана'], 409);
    }

    if ($action === 'approve') {
        $checkUserStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkUserStmt->execute(['email' => $request['email']]);

        if ($checkUserStmt->fetch()) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
        }

        $insertAdminStmt = $pdo->prepare('
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (:email, :password_hash, :first_name, :last_name, :role)
            RETURNING id, email, first_name, last_name, role, created_at
        ');
        $insertAdminStmt->execute([
            'email' => $request['email'],
            'password_hash' => $request['password_hash'],
            'first_name' => $request['first_name'],
            'last_name' => $request['last_name'] ?: null,
            'role' => 'admin',
        ]);
        $admin = $insertAdminStmt->fetch();

        $updateRequestStmt = $pdo->prepare('
            UPDATE admin_registration_requests
            SET status = :status,
                processed_at = CURRENT_TIMESTAMP,
                processed_by = :processed_by
            WHERE id = :id
            RETURNING id, email, first_name, last_name, status, requested_at, processed_at
        ');
        $updateRequestStmt->execute([
            'status' => 'approved',
            'processed_by' => (int)$user['id'],
            'id' => $requestId,
        ]);

        $processedRequest = $updateRequestStmt->fetch();

        $pdo->commit();

        jsonResponse([
            'message' => 'Заявка одобрена, администратор создан',
            'request' => $processedRequest,
            'admin' => $admin,
        ]);
    }

    $rejectStmt = $pdo->prepare('
        UPDATE admin_registration_requests
        SET status = :status,
            processed_at = CURRENT_TIMESTAMP,
            processed_by = :processed_by
        WHERE id = :id
        RETURNING id, email, first_name, last_name, status, requested_at, processed_at
    ');
    $rejectStmt->execute([
        'status' => 'rejected',
        'processed_by' => (int)$user['id'],
        'id' => $requestId,
    ]);

    $processedRequest = $rejectStmt->fetch();

    $pdo->commit();

    jsonResponse([
        'message' => 'Заявка отклонена',
        'request' => $processedRequest,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
