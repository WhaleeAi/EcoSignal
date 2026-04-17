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
    $organizationId = (int)$user['organization_id'];
    $actorAdminId = (int)$user['id'];

    $filialsStmt = $pdo->prepare('
        SELECT
            id,
            name,
            address,
            hotline_phone,
            email,
            region,
            is_active,
            created_at
        FROM filials
        WHERE organization_id = :organization_id
        ORDER BY is_active DESC, name ASC
    ');
    $filialsStmt->execute(['organization_id' => $organizationId]);
    $filials = $filialsStmt->fetchAll();

    $adminsStmt = $pdo->prepare('
        SELECT
            oa.id,
            oa.login,
            oa.role,
            oa.filial_id,
            oa.is_active,
            oa.created_at,
            oa.last_login_at,
            f.name AS filial_name,
            f.region AS filial_region
        FROM org_admins oa
        LEFT JOIN filials f ON f.id = oa.filial_id
        WHERE oa.organization_id = :organization_id
          AND oa.role = :role
        ORDER BY oa.is_active DESC, oa.created_at DESC
    ');
    $adminsStmt->execute([
        'organization_id' => $organizationId,
        'role' => 'admin',
    ]);
    $admins = $adminsStmt->fetchAll();

    $refsStmt = $pdo->prepare('
        SELECT
            r.id,
            r.action_type,
            r.created_at,
            r.comment,
            t.id AS target_admin_id,
            t.login AS target_login,
            t.is_active AS target_is_active,
            t.created_at AS target_created_at,
            f.name AS filial_name,
            f.region AS filial_region
        FROM org_adm_refs r
        INNER JOIN org_admins t ON t.id = r.target_admin_id
        LEFT JOIN filials f ON f.id = t.filial_id
        WHERE r.actor_admin_id = :actor_admin_id
        ORDER BY r.created_at DESC
        LIMIT 20
    ');
    $refsStmt->execute(['actor_admin_id' => $actorAdminId]);
    $recentRefs = $refsStmt->fetchAll();

    $activeAdminsCount = 0;
    foreach ($admins as $adminRow) {
        if ((bool)$adminRow['is_active']) {
            $activeAdminsCount++;
        }
    }

    jsonResponse([
        'message' => 'Данные панели superadmin загружены',
        'user' => $user,
        'organization' => [
            'id' => $organizationId,
            'name' => (string)$user['organization_name'],
            'type' => (string)$user['organization_type'],
        ],
        'stats' => [
            'filials_total' => count($filials),
            'admins_total' => count($admins),
            'admins_active' => $activeAdminsCount,
            'my_actions_total' => count($recentRefs),
        ],
        'filials' => $filials,
        'admins' => $admins,
        'recent_refs' => $recentRefs,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
