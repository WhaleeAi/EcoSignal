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
if (($user['role'] ?? '') !== 'superadmin') {
    jsonResponse(['message' => 'Доступ только для superadmin надзорного органа'], 403);
}

try {
    $pdo = getPDO();
    $actorAdminId = (int)$user['id'];

    $organizationsStmt = $pdo->query('
        SELECT id, name, org_type, created_at
        FROM organizations
        ORDER BY name ASC
    ');
    $organizations = $organizationsStmt->fetchAll();

    $filialsStmt = $pdo->query('
        SELECT
            id,
            organization_id,
            name,
            address,
            hotline_phone,
            email,
            region,
            is_active,
            created_at
        FROM filials
        ORDER BY organization_id ASC, name ASC
    ');
    $filials = $filialsStmt->fetchAll();

    $adminsStmt = $pdo->query('
        SELECT
            oa.id,
            oa.login,
            oa.role,
            oa.organization_id,
            oa.filial_id,
            oa.is_active,
            oa.created_at,
            oa.last_login_at,
            o.name AS organization_name,
            o.org_type AS organization_type,
            f.name AS filial_name,
            f.region AS filial_region
        FROM org_admins oa
        INNER JOIN organizations o ON o.id = oa.organization_id
        LEFT JOIN filials f ON f.id = oa.filial_id
        ORDER BY oa.created_at DESC
    ');
    $admins = $adminsStmt->fetchAll();

    $recentRefsStmt = $pdo->prepare('
        SELECT
            r.id,
            r.action_type,
            r.created_at,
            r.comment,
            t.id AS target_admin_id,
            t.login AS target_login,
            t.role AS target_role,
            t.is_active AS target_is_active,
            o.name AS target_organization_name,
            f.name AS filial_name,
            f.region AS filial_region
        FROM org_adm_refs r
        INNER JOIN org_admins t ON t.id = r.target_admin_id
        INNER JOIN organizations o ON o.id = t.organization_id
        LEFT JOIN filials f ON f.id = t.filial_id
        WHERE r.actor_admin_id = :actor_admin_id
        ORDER BY r.created_at DESC
        LIMIT 20
    ');
    $recentRefsStmt->execute(['actor_admin_id' => $actorAdminId]);
    $recentRefs = $recentRefsStmt->fetchAll();

    $statsStmt = $pdo->query("
        SELECT
            (SELECT COUNT(*) FROM organizations) AS organizations_total,
            (SELECT COUNT(*) FROM filials) AS filials_total,
            (SELECT COUNT(*) FROM org_admins WHERE role = 'admin') AS admins_total,
            (SELECT COUNT(*) FROM org_admins WHERE role = 'superadmin') AS superadmins_total
    ");
    $stats = $statsStmt->fetch() ?: [];

    jsonResponse([
        'message' => 'Данные панели superadmin загружены',
        'user' => $user,
        'stats' => [
            'organizations_total' => (int)($stats['organizations_total'] ?? 0),
            'filials_total' => (int)($stats['filials_total'] ?? 0),
            'admins_total' => (int)($stats['admins_total'] ?? 0),
            'superadmins_total' => (int)($stats['superadmins_total'] ?? 0),
        ],
        'organizations' => $organizations,
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
