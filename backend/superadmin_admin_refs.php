<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Method is not supported'], 405);
}

$user = requireAuth();
if (($user['auth_source'] ?? '') !== 'org_admins' || ($user['role'] ?? '') !== 'superadmin') {
    jsonResponse(['message' => 'Only superadmin has access'], 403);
}

try {
    $pdo = getPDO();
    $actorAdminId = (int)$user['id'];

    $adminsStmt = $pdo->prepare('
        SELECT
            t.id,
            t.login,
            t.role,
            t.organization_id,
            t.filial_id,
            t.is_active,
            t.created_at,
            t.last_login_at,
            o.name AS organization_name,
            o.org_type AS organization_type,
            f.name AS filial_name,
            f.region AS filial_region,
            ap.appointed_at,
            la.action_type AS last_action,
            la.created_at AS last_action_at
        FROM org_admins t
        INNER JOIN organizations o ON o.id = t.organization_id
        INNER JOIN (
            SELECT
                target_admin_id,
                MAX(created_at) AS appointed_at
            FROM org_adm_refs
            WHERE actor_admin_id = :actor_admin_id
              AND action_type = :appointed_action
            GROUP BY target_admin_id
        ) ap ON ap.target_admin_id = t.id
        LEFT JOIN LATERAL (
            SELECT action_type, created_at
            FROM org_adm_refs r
            WHERE r.actor_admin_id = :actor_admin_id
              AND r.target_admin_id = t.id
            ORDER BY r.created_at DESC
            LIMIT 1
        ) la ON TRUE
        LEFT JOIN filials f ON f.id = t.filial_id
        ORDER BY ap.appointed_at DESC, t.id DESC
    ');
    $adminsStmt->execute([
        'actor_admin_id' => $actorAdminId,
        'appointed_action' => 'appointed',
    ]);
    $admins = $adminsStmt->fetchAll();

    $activeCount = 0;
    foreach ($admins as $admin) {
        if ((bool)$admin['is_active']) {
            $activeCount++;
        }
    }

    jsonResponse([
        'message' => 'Assigned admins loaded',
        'user' => $user,
        'stats' => [
            'appointed_total' => count($admins),
            'appointed_active' => $activeCount,
            'appointed_inactive' => count($admins) - $activeCount,
        ],
        'admins' => $admins,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Server error',
        'error' => $e->getMessage(),
    ], 500);
}