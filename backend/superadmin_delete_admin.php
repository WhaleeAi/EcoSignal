<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Method is not supported'], 405);
}

$user = requireAuth();
if (($user['auth_source'] ?? '') !== 'org_admins' || ($user['role'] ?? '') !== 'superadmin') {
    jsonResponse(['message' => 'Only superadmin has access'], 403);
}

$data = getJsonInput();
$adminId = (int)($data['admin_id'] ?? 0);
$comment = trim((string)($data['comment'] ?? ''));

if ($adminId <= 0) {
    jsonResponse(['message' => 'Invalid admin id'], 422);
}

try {
    $pdo = getPDO();
    $pdo->beginTransaction();

    $actorAdminId = (int)$user['id'];

    if ($adminId === $actorAdminId) {
        $pdo->rollBack();
        jsonResponse(['message' => 'You cannot deactivate yourself'], 409);
    }

    $targetStmt = $pdo->prepare('
        SELECT id, role, is_active
        FROM org_admins
        WHERE id = :id
        FOR UPDATE
    ');
    $targetStmt->execute(['id' => $adminId]);
    $targetAdmin = $targetStmt->fetch();

    if (!$targetAdmin) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Admin not found'], 404);
    }

    if (!in_array((string)$targetAdmin['role'], ['admin', 'superadmin'], true)) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Target role cannot be deactivated'], 403);
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
        jsonResponse(['message' => 'You can deactivate only admins appointed by you'], 403);
    }

    if (!(bool)$targetAdmin['is_active']) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Admin is already inactive'], 409);
    }

    $deactivateStmt = $pdo->prepare('
        UPDATE org_admins
        SET is_active = FALSE
        WHERE id = :id
        RETURNING id, login, role, organization_id, filial_id, is_active, created_at, last_login_at
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
        'message' => 'Admin deactivated',
        'admin' => $updatedAdmin,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Server error',
        'error' => $e->getMessage(),
    ], 500);
}