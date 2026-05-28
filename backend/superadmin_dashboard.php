<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

function requireSuperadmin(): array
{
    $user = requireAuth();

    if (($user['role'] ?? '') !== 'superadmin' || ($user['auth_source'] ?? '') !== 'superadmins') {
        jsonResponse(['message' => 'Доступ только для суперадмина'], 403);
    }

    return $user;
}

function fetchSuperadminPayload(PDO $pdo, array $user): array
{
    $organizations = $pdo->query('
        SELECT id, name, org_type, created_at
        FROM organizations
        ORDER BY name ASC
    ')->fetchAll();

    $filials = $pdo->query('
        SELECT
            id,
            organization_id,
            name,
            address,
            latitude,
            longitude,
            hotline_phone,
            email,
            region,
            is_active,
            created_at
        FROM filials
        ORDER BY organization_id ASC, name ASC
    ')->fetchAll();

    $admins = $pdo->query('
        SELECT
            oa.id,
            oa.organization_id,
            oa.filial_id,
            oa.login,
            oa.role,
            oa.is_active,
            oa.created_at,
            oa.last_login_at,
            o.name AS organization_name,
            o.org_type,
            f.name AS filial_name,
            f.region AS filial_region,
            f.latitude AS filial_latitude,
            f.longitude AS filial_longitude
        FROM org_admins oa
        INNER JOIN organizations o ON o.id = oa.organization_id
        LEFT JOIN filials f ON f.id = oa.filial_id
        ORDER BY oa.is_active DESC, o.name ASC, f.name ASC, oa.login ASC
    ')->fetchAll();

    return [
        'user' => [
            'id' => (int)$user['id'],
            'login' => (string)$user['login'],
            'name' => (string)($user['name'] ?? $user['login']),
            'role' => (string)$user['role'],
            'auth_source' => (string)$user['auth_source'],
        ],
        'organizations' => array_map(static fn(array $row): array => [
            'id' => (int)$row['id'],
            'name' => (string)$row['name'],
            'org_type' => (string)$row['org_type'],
            'created_at' => (string)$row['created_at'],
        ], $organizations),
        'filials' => array_map(static fn(array $row): array => [
            'id' => (int)$row['id'],
            'organization_id' => (int)$row['organization_id'],
            'name' => (string)$row['name'],
            'address' => (string)$row['address'],
            'latitude' => (float)$row['latitude'],
            'longitude' => (float)$row['longitude'],
            'hotline_phone' => $row['hotline_phone'] !== null ? (string)$row['hotline_phone'] : null,
            'email' => $row['email'] !== null ? (string)$row['email'] : null,
            'region' => $row['region'] !== null ? (string)$row['region'] : null,
            'is_active' => (bool)$row['is_active'],
            'created_at' => (string)$row['created_at'],
        ], $filials),
        'admins' => array_map(static fn(array $row): array => [
            'id' => (int)$row['id'],
            'organization_id' => (int)$row['organization_id'],
            'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
            'login' => (string)$row['login'],
            'role' => (string)$row['role'],
            'is_active' => (bool)$row['is_active'],
            'created_at' => (string)$row['created_at'],
            'last_login_at' => $row['last_login_at'] !== null ? (string)$row['last_login_at'] : null,
            'organization_name' => (string)$row['organization_name'],
            'organization_type' => (string)$row['org_type'],
            'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
            'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
            'filial_latitude' => $row['filial_latitude'] !== null ? (float)$row['filial_latitude'] : null,
            'filial_longitude' => $row['filial_longitude'] !== null ? (float)$row['filial_longitude'] : null,
        ], $admins),
    ];
}

function ensureFilialBelongsToOrganization(PDO $pdo, int $organizationId, int $filialId): void
{
    $stmt = $pdo->prepare('
        SELECT 1
        FROM filials
        WHERE id = :filial_id
          AND organization_id = :organization_id
        LIMIT 1
    ');
    $stmt->execute([
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
    ]);

    if (!$stmt->fetchColumn()) {
        jsonResponse(['message' => 'Филиал не принадлежит выбранному органу'], 422);
    }
}

function ensureOrganizationExists(PDO $pdo, int $organizationId): void
{
    $stmt = $pdo->prepare('SELECT 1 FROM organizations WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $organizationId]);

    if (!$stmt->fetchColumn()) {
        jsonResponse(['message' => 'Орган не найден'], 422);
    }
}

function ensureLoginIsAvailable(PDO $pdo, string $login, int $adminId): void
{
    $duplicateStmt = $pdo->prepare('
        SELECT id
        FROM org_admins
        WHERE login = :login
          AND id <> :id
        LIMIT 1
    ');
    $duplicateStmt->execute([
        'login' => $login,
        'id' => $adminId,
    ]);

    if ($duplicateStmt->fetch()) {
        jsonResponse(['message' => 'Агент с таким логином уже существует'], 409);
    }

    $superadminStmt = $pdo->prepare('
        SELECT id
        FROM superadmins
        WHERE login = :login
        LIMIT 1
    ');
    $superadminStmt->execute(['login' => $login]);

    if ($superadminStmt->fetch()) {
        jsonResponse(['message' => 'Этот логин занят суперадмином'], 409);
    }
}

$superadmin = requireSuperadmin();

try {
    $pdo = getPDO();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        jsonResponse(fetchSuperadminPayload($pdo, $superadmin));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['message' => 'Метод не поддерживается'], 405);
    }

    $data = getJsonInput();
    $action = (string)($data['action'] ?? 'save_admin');

    if ($action !== 'save_admin') {
        jsonResponse(['message' => 'Неизвестное действие'], 422);
    }

    $adminId = (int)($data['id'] ?? 0);
    $login = trim((string)($data['login'] ?? ''));
    $password = trim((string)($data['password'] ?? ''));
    $organizationId = (int)($data['organization_id'] ?? 0);
    $filialId = (int)($data['filial_id'] ?? 0);
    $isActive = (bool)($data['is_active'] ?? true);

    if ($login === '') {
        jsonResponse(['message' => 'Укажите логин агента'], 422);
    }

    if ($organizationId <= 0) {
        jsonResponse(['message' => 'Выберите орган'], 422);
    }

    if ($filialId <= 0) {
        jsonResponse(['message' => 'Выберите филиал'], 422);
    }

    if ($password !== '' && mb_strlen($password) < 6) {
        jsonResponse(['message' => 'Пароль должен быть не короче 6 символов'], 422);
    }

    if ($adminId <= 0 && $password === '') {
        jsonResponse(['message' => 'Укажите пароль для нового агента'], 422);
    }

    ensureOrganizationExists($pdo, $organizationId);
    ensureFilialBelongsToOrganization($pdo, $organizationId, $filialId);
    ensureLoginIsAvailable($pdo, $login, $adminId);

    if ($adminId > 0) {
        $existsStmt = $pdo->prepare('SELECT id FROM org_admins WHERE id = :id LIMIT 1');
        $existsStmt->execute(['id' => $adminId]);

        if (!$existsStmt->fetch()) {
            jsonResponse(['message' => 'Агент не найден'], 404);
        }

        $fields = [
            'organization_id = :organization_id',
            'filial_id = :filial_id',
            'login = :login',
            'role = :role',
            'is_active = :is_active',
        ];
        $params = [
            'id' => $adminId,
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'login' => $login,
            'role' => 'admin',
            'is_active' => $isActive ? 'true' : 'false',
        ];

        if ($password !== '') {
            $fields[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }

        $stmt = $pdo->prepare('UPDATE org_admins SET ' . implode(', ', $fields) . ' WHERE id = :id');
        $stmt->execute($params);
    } else {
        $stmt = $pdo->prepare('
            INSERT INTO org_admins (
                organization_id,
                filial_id,
                login,
                password_hash,
                role,
                is_active
            ) VALUES (
                :organization_id,
                :filial_id,
                :login,
                :password_hash,
                :role,
                :is_active
            )
        ');
        $stmt->execute([
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'login' => $login,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => 'admin',
            'is_active' => $isActive ? 'true' : 'false',
        ]);
    }

    jsonResponse([
        'message' => 'Настройки агента сохранены',
        ...fetchSuperadminPayload($pdo, $superadmin),
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
