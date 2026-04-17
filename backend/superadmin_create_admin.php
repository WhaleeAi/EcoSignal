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

if (($user['auth_source'] ?? '') !== 'org_admins' || ($user['role'] ?? '') !== 'superadmin') {
    jsonResponse(['message' => 'Доступ только для superadmin надзорного органа'], 403);
}

$data = getJsonInput();

$login = trim((string)($data['login'] ?? ''));
$password = trim((string)($data['password'] ?? ''));
$filialIdRaw = $data['filial_id'] ?? null;
$comment = trim((string)($data['comment'] ?? ''));

$filialId = null;
if ($filialIdRaw !== null && $filialIdRaw !== '') {
    $filialId = (int)$filialIdRaw;
}

if ($login === '' || $password === '') {
    jsonResponse(['message' => 'Заполните логин и пароль'], 422);
}

if (mb_strlen($password) < 6) {
    jsonResponse(['message' => 'Пароль должен содержать минимум 6 символов'], 422);
}

if ($filialId !== null && $filialId <= 0) {
    jsonResponse(['message' => 'Некорректный филиал'], 422);
}

try {
    $pdo = getPDO();
    $pdo->beginTransaction();

    $actorAdminId = (int)$user['id'];
    $organizationId = (int)$user['organization_id'];

    $existingAdminStmt = $pdo->prepare('
        SELECT id
        FROM org_admins
        WHERE login = :login
        LIMIT 1
    ');
    $existingAdminStmt->execute(['login' => $login]);
    if ($existingAdminStmt->fetch()) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Администратор с таким логином уже существует'], 409);
    }

    if ($filialId !== null) {
        $filialStmt = $pdo->prepare('
            SELECT id
            FROM filials
            WHERE id = :id
              AND organization_id = :organization_id
              AND is_active = TRUE
            LIMIT 1
        ');
        $filialStmt->execute([
            'id' => $filialId,
            'organization_id' => $organizationId,
        ]);

        if (!$filialStmt->fetch()) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Филиал не найден или недоступен'], 404);
        }
    }

    $createAdminStmt = $pdo->prepare('
        INSERT INTO org_admins (
            organization_id,
            filial_id,
            login,
            password_hash,
            role,
            is_active
        )
        VALUES (
            :organization_id,
            :filial_id,
            :login,
            :password_hash,
            :role,
            TRUE
        )
        RETURNING id, organization_id, filial_id, login, role, is_active, created_at, last_login_at
    ');
    $createAdminStmt->execute([
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
        'login' => $login,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => 'admin',
    ]);
    $admin = $createAdminStmt->fetch();

    $refStmt = $pdo->prepare('
        INSERT INTO org_adm_refs (
            actor_admin_id,
            target_admin_id,
            action_type,
            comment
        )
        VALUES (
            :actor_admin_id,
            :target_admin_id,
            :action_type,
            :comment
        )
    ');
    $refStmt->execute([
        'actor_admin_id' => $actorAdminId,
        'target_admin_id' => (int)$admin['id'],
        'action_type' => 'appointed',
        'comment' => $comment !== '' ? $comment : null,
    ]);

    $pdo->commit();

    jsonResponse([
        'message' => 'Администратор добавлен',
        'admin' => $admin,
    ], 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
