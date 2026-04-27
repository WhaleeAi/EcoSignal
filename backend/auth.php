<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

function columnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare('
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = :table_name
          AND column_name = :column_name
        LIMIT 1
    ');
    $stmt->execute([
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);

    return (bool)$stmt->fetchColumn();
}

function requireAuth(): array
{
    $token = getBearerToken();

    if (!$token) {
        jsonResponse([
            'message' => 'Токен не передан',
        ], 401);
    }

    try {
        $decoded = decodeJwtToken($token);
        $subjectId = (int)($decoded->sub ?? 0);
        $authSource = (string)($decoded->auth_source ?? 'users');

        if ($subjectId <= 0 || !in_array($authSource, ['users', 'org_admins'], true)) {
            jsonResponse([
                'message' => 'Некорректный токен',
            ], 401);
        }

        $pdo = getPDO();

        if ($authSource === 'org_admins') {
            $hasFirstName = columnExists($pdo, 'org_admins', 'first_name');
            $hasLastName = columnExists($pdo, 'org_admins', 'last_name');
            $hasAbout = columnExists($pdo, 'org_admins', 'about');
            $hasEmail = columnExists($pdo, 'org_admins', 'email');

            $stmt = $pdo->prepare('
                SELECT
                    oa.id,
                    oa.organization_id,
                    oa.filial_id,
                    oa.login,
                    oa.role,
                    oa.is_active,
                    oa.created_at,
                    oa.last_login_at,
                    ' . ($hasFirstName ? 'oa.first_name' : 'NULL::varchar') . ' AS first_name,
                    ' . ($hasLastName ? 'oa.last_name' : 'NULL::varchar') . ' AS last_name,
                    ' . ($hasAbout ? 'oa.about' : 'NULL::text') . ' AS about,
                    ' . ($hasEmail ? 'oa.email' : 'NULL::varchar') . ' AS email,
                    o.name AS organization_name,
                    o.org_type,
                    f.name AS filial_name,
                    f.region AS filial_region
                FROM org_admins oa
                INNER JOIN organizations o ON o.id = oa.organization_id
                LEFT JOIN filials f ON f.id = oa.filial_id
                WHERE oa.id = :id
                LIMIT 1
            ');
            $stmt->execute(['id' => $subjectId]);
            $orgAdmin = $stmt->fetch();

            if (!$orgAdmin || !(bool)$orgAdmin['is_active']) {
                jsonResponse([
                    'message' => 'Пользователь не найден',
                ], 401);
            }

            $firstName = $orgAdmin['first_name'] !== null ? (string)$orgAdmin['first_name'] : '';
            $lastName = $orgAdmin['last_name'] !== null ? (string)$orgAdmin['last_name'] : '';
            $fullName = trim($firstName . ' ' . $lastName);

            return [
                'id' => (int)$orgAdmin['id'],
                'organization_id' => (int)$orgAdmin['organization_id'],
                'organization_name' => (string)$orgAdmin['organization_name'],
                'organization_type' => (string)$orgAdmin['org_type'],
                'filial_id' => $orgAdmin['filial_id'] !== null ? (int)$orgAdmin['filial_id'] : null,
                'filial_name' => $orgAdmin['filial_name'] !== null ? (string)$orgAdmin['filial_name'] : null,
                'filial_region' => $orgAdmin['filial_region'] !== null ? (string)$orgAdmin['filial_region'] : null,
                'login' => (string)$orgAdmin['login'],
                'email' => $orgAdmin['email'] !== null ? (string)$orgAdmin['email'] : (string)$orgAdmin['login'],
                'first_name' => $firstName !== '' ? $firstName : null,
                'last_name' => $lastName !== '' ? $lastName : null,
                'about' => $orgAdmin['about'] !== null ? (string)$orgAdmin['about'] : null,
                'name' => $fullName !== '' ? $fullName : (string)$orgAdmin['login'],
                'role' => (string)$orgAdmin['role'],
                'created_at' => (string)$orgAdmin['created_at'],
                'last_login_at' => $orgAdmin['last_login_at'] !== null ? (string)$orgAdmin['last_login_at'] : null,
                'auth_source' => 'org_admins',
            ];
        }

        $stmt = $pdo->prepare('SELECT id, email, first_name, last_name, about, role, created_at FROM users WHERE id = :id');
        $stmt->execute(['id' => $subjectId]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse([
                'message' => 'Пользователь не найден',
            ], 401);
        }

        $user['auth_source'] = 'users';
        return $user;
    } catch (Throwable $e) {
        jsonResponse([
            'message' => 'Недействительный или просроченный токен',
        ], 401);
    }
}
