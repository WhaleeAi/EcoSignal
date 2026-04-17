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
$adminId = (int)($data['admin_id'] ?? 0);
$comment = trim((string)($data['comment'] ?? ''));

if ($adminId <= 0) {
    jsonResponse(['message' => 'Некорректный ID администратора'], 422);
}

try {
    $pdo = getPDO();
    $pdo->beginTransaction();

    $actorAdminId = (int)$user['id'];
    $organizationId = (int)$user['organization_id'];

    $targetStmt = $pdo->prepare('
        SELECT id, organization_id, role, is_active, login
        FROM org_admins
        WHERE id = :id
        FOR UPDATE
    ');
    $targetStmt->execute(['id' => $adminId]);
    $targetAdmin = $targetStmt->fetch();

    if (!$targetAdmin) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Администратор не найден'], 404);
    }

    if ((int)$targetAdmin['organization_id'] !== $organizationId || (string)$targetAdmin['role'] !== 'admin') {
        $pdo->rollBack();
        jsonResponse(['message' => 'Недостаточно прав для удаления администратора'], 403);
    }

    $appointedByActorStmt = $pdo->prepare('
        SELECT 1
        FROM org_adm_refs
        WHERE actor_admin_id = :actor_admin_id
          AND target_admin_id = :target_admin_id
          AND action_type = :appointed_action
        LIMIT 1
    ');
    $appointedByActorStmt->execute([
        'actor_admin_id' => $actorAdminId,
        'target_admin_id' => $adminId,
        'appointed_action' => 'appointed',
    ]);

    if (!$appointedByActorStmt->fetchColumn()) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Можно удалять только администраторов, которых назначили вы'], 403);
    }

    if (!(bool)$targetAdmin['is_active']) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Администратор уже деактивирован'], 409);
    }

    $deactivateStmt = $pdo->prepare('
        UPDATE org_admins
        SET is_active = FALSE
        WHERE id = :id
        RETURNING id, login, is_active, created_at, last_login_at
    ');
    $deactivateStmt->execute(['id' => $adminId]);
    $updatedAdmin = $deactivateStmt->fetch();

    $refStmt = $pdo->prepare('
        INSERT INTO org_adm_refs (
            actor_admin_id,
            target_admin_id,
            action_type,
            comment
        ) VALUES (
            :actor_admin_id,
            :target_admin_id,
            :action_type,
            :comment
        )
    ');
    $refStmt->execute([
        'actor_admin_id' => $actorAdminId,
        'target_admin_id' => $adminId,
        'action_type' => 'revoked',
        'comment' => $comment !== '' ? $comment : null,
    ]);

    $pdo->commit();

    jsonResponse([
        'message' => 'Администратор удален',
        'admin' => $updatedAdmin,
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