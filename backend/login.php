<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$data = getJsonInput();

$email = trim((string)($data['email'] ?? ''));
$password = trim((string)($data['password'] ?? ''));

if ($email === '' || $password === '') {
    jsonResponse(['message' => 'Введите email и пароль'], 422);
}

try {
    $pdo = getPDO();

    $userStmt = $pdo->prepare('
        SELECT id, email, password_hash, first_name, last_name, role, created_at
        FROM users
        WHERE email = :email
        LIMIT 1
    ');
    $userStmt->execute(['email' => $email]);
    $appUser = $userStmt->fetch();

    $orgAdmin = null;
    $hasOrgAdmins = (bool)$pdo->query("SELECT to_regclass('public.org_admins') IS NOT NULL")->fetchColumn();
    $hasOrganizations = (bool)$pdo->query("SELECT to_regclass('public.organizations') IS NOT NULL")->fetchColumn();
    $hasFilials = (bool)$pdo->query("SELECT to_regclass('public.filials') IS NOT NULL")->fetchColumn();

    if ($hasOrgAdmins && $hasOrganizations) {
        $orgSql = '
            SELECT
                oa.id,
                oa.organization_id,
                oa.filial_id,
                oa.login,
                oa.password_hash,
                oa.role,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                o.name AS organization_name,
                o.org_type,';

        if ($hasFilials) {
            $orgSql .= '
                f.name AS filial_name,
                f.region AS filial_region';
        } else {
            $orgSql .= '
                NULL::varchar AS filial_name,
                NULL::varchar AS filial_region';
        }

        $orgSql .= '
            FROM org_admins oa
            INNER JOIN organizations o ON o.id = oa.organization_id';

        if ($hasFilials) {
            $orgSql .= '
            LEFT JOIN filials f ON f.id = oa.filial_id';
        }

        $orgSql .= '
            WHERE oa.login = :login
            LIMIT 1
        ';

        $orgStmt = $pdo->prepare($orgSql);
        $orgStmt->execute(['login' => $email]);
        $orgAdmin = $orgStmt->fetch();
    }

    if ($appUser && password_verify($password, (string)$appUser['password_hash'])) {
        $token = createJwtToken($appUser, 'users');
        unset($appUser['password_hash']);
        $appUser['auth_source'] = 'users';

        jsonResponse([
            'message' => 'Вход выполнен успешно',
            'token' => $token,
            'user' => $appUser,
        ]);
    }

    if ($orgAdmin && password_verify($password, (string)$orgAdmin['password_hash'])) {
        if (!(bool)$orgAdmin['is_active']) {
            jsonResponse(['message' => 'Учетная запись деактивирована'], 403);
        }

        $updateLastLoginStmt = $pdo->prepare('
            UPDATE org_admins
            SET last_login_at = NOW()
            WHERE id = :id
        ');
        $updateLastLoginStmt->execute(['id' => (int)$orgAdmin['id']]);

        $token = createJwtToken(
            [
                'id' => (int)$orgAdmin['id'],
                'login' => (string)$orgAdmin['login'],
                'role' => (string)$orgAdmin['role'],
            ],
            'org_admins'
        );

        jsonResponse([
            'message' => 'Вход выполнен успешно',
            'token' => $token,
            'user' => [
                'id' => (int)$orgAdmin['id'],
                'login' => (string)$orgAdmin['login'],
                'email' => (string)$orgAdmin['login'],
                'role' => (string)$orgAdmin['role'],
                'organization_id' => (int)$orgAdmin['organization_id'],
                'organization_name' => (string)$orgAdmin['organization_name'],
                'organization_type' => (string)$orgAdmin['org_type'],
                'filial_id' => $orgAdmin['filial_id'] !== null ? (int)$orgAdmin['filial_id'] : null,
                'filial_name' => $orgAdmin['filial_name'] !== null ? (string)$orgAdmin['filial_name'] : null,
                'filial_region' => $orgAdmin['filial_region'] !== null ? (string)$orgAdmin['filial_region'] : null,
                'created_at' => (string)$orgAdmin['created_at'],
                'last_login_at' => $orgAdmin['last_login_at'] !== null ? (string)$orgAdmin['last_login_at'] : null,
                'auth_source' => 'org_admins',
            ],
        ]);
    }

    jsonResponse(['message' => 'Неверный email или пароль'], 401);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
