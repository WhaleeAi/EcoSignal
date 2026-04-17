<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

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

            return [
                'id' => (int)$orgAdmin['id'],
                'organization_id' => (int)$orgAdmin['organization_id'],
                'organization_name' => (string)$orgAdmin['organization_name'],
                'organization_type' => (string)$orgAdmin['org_type'],
                'filial_id' => $orgAdmin['filial_id'] !== null ? (int)$orgAdmin['filial_id'] : null,
                'filial_name' => $orgAdmin['filial_name'] !== null ? (string)$orgAdmin['filial_name'] : null,
                'filial_region' => $orgAdmin['filial_region'] !== null ? (string)$orgAdmin['filial_region'] : null,
                'login' => (string)$orgAdmin['login'],
                'email' => (string)$orgAdmin['login'],
                'role' => (string)$orgAdmin['role'],
                'created_at' => (string)$orgAdmin['created_at'],
                'last_login_at' => $orgAdmin['last_login_at'] !== null ? (string)$orgAdmin['last_login_at'] : null,
                'auth_source' => 'org_admins',
            ];
        }

        $stmt = $pdo->prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = :id');
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
