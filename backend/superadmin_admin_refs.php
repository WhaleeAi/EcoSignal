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

if (($user['auth_source'] ?? '') !== 'org_admins' || ($user['role'] ?? '') !== 'superadmin') {
    jsonResponse(['message' => 'Доступ только для superadmin надзорного органа'], 403);
}

try {
    $pdo = getPDO();
    $actorAdminId = (int)$user['id'];
    $organizationId = (int)$user['organization_id'];

    $adminsStmt = $pdo->prepare('
        SELECT
            t.id,
            t.login,
            t.filial_id,
            t.is_active,
            t.created_at,
            t.last_login_at,
            f.name AS filial_name,
            f.region AS filial_region,
            ap.appointed_at,
            la.action_type AS last_action,
            la.created_at AS last_action_at
        FROM org_admins t
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
        WHERE t.organization_id = :organization_id
          AND t.role = :role
        ORDER BY ap.appointed_at DESC, t.id DESC
    ');
    $adminsStmt->execute([
        'actor_admin_id' => $actorAdminId,
        'appointed_action' => 'appointed',
        'organization_id' => $organizationId,
        'role' => 'admin',
    ]);
    $admins = $adminsStmt->fetchAll();

    $activeCount = 0;
    foreach ($admins as $admin) {
        if ((bool)$admin['is_active']) {
            $activeCount++;
        }
    }

    jsonResponse([
        'message' => 'Список назначенных администраторов загружен',
        'user' => $user,
        'stats' => [
            'appointed_total' => count($admins),
            'appointed_active' => $activeCount,
        ],
        'admins' => $admins,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}