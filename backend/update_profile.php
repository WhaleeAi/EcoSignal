<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

function buildOrgAdminResponse(PDO $pdo, int $adminId): array
{
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
    $stmt->execute(['id' => $adminId]);
    $row = $stmt->fetch();

    if (!$row) {
      jsonResponse(['message' => 'Администратор не найден'], 404);
    }

    $firstName = $row['first_name'] !== null ? (string)$row['first_name'] : '';
    $lastName = $row['last_name'] !== null ? (string)$row['last_name'] : '';
    $fullName = trim($firstName . ' ' . $lastName);

    return [
        'id' => (int)$row['id'],
        'organization_id' => (int)$row['organization_id'],
        'organization_name' => (string)$row['organization_name'],
        'organization_type' => (string)$row['org_type'],
        'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
        'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
        'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
        'login' => (string)$row['login'],
        'email' => $row['email'] !== null ? (string)$row['email'] : (string)$row['login'],
        'first_name' => $firstName !== '' ? $firstName : null,
        'last_name' => $lastName !== '' ? $lastName : null,
        'about' => $row['about'] !== null ? (string)$row['about'] : null,
        'name' => $fullName !== '' ? $fullName : (string)$row['login'],
        'role' => (string)$row['role'],
        'created_at' => (string)$row['created_at'],
        'last_login_at' => $row['last_login_at'] !== null ? (string)$row['last_login_at'] : null,
        'auth_source' => 'org_admins',
    ];
}

$user = requireAuth();
$data = getJsonInput();

$fullName = trim((string)($data['fullname'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$login = trim((string)($data['login'] ?? ''));
$about = trim((string)($data['about'] ?? ''));
$password = trim((string)($data['password'] ?? ''));

if ($password !== '' && mb_strlen($password) < 6) {
    jsonResponse(['message' => 'Пароль должен содержать минимум 6 символов'], 422);
}

try {
    $pdo = getPDO();

    if (($user['auth_source'] ?? 'users') === 'org_admins') {
        $adminId = (int)$user['id'];
        $effectiveLogin = $login !== '' ? $login : $email;

        if ($effectiveLogin === '') {
            jsonResponse(['message' => 'Укажите логин'], 422);
        }

        $hasFirstName = columnExists($pdo, 'org_admins', 'first_name');
        $hasLastName = columnExists($pdo, 'org_admins', 'last_name');
        $hasAbout = columnExists($pdo, 'org_admins', 'about');
        $hasEmail = columnExists($pdo, 'org_admins', 'email');

        $duplicateStmt = $pdo->prepare('
            SELECT id
            FROM org_admins
            WHERE login = :login
              AND id <> :id
            LIMIT 1
        ');
        $duplicateStmt->execute([
            'login' => $effectiveLogin,
            'id' => $adminId,
        ]);

        if ($duplicateStmt->fetch()) {
            jsonResponse(['message' => 'Администратор с таким логином уже существует'], 409);
        }

        $fields = ['login = :login'];
        $params = [
            'id' => $adminId,
            'login' => $effectiveLogin,
        ];

        if ($hasFirstName || $hasLastName) {
            [$firstName, $lastName] = splitFullName($fullName);
            if ($hasFirstName) {
                $fields[] = 'first_name = :first_name';
                $params['first_name'] = $firstName !== '' ? $firstName : null;
            }
            if ($hasLastName) {
                $fields[] = 'last_name = :last_name';
                $params['last_name'] = $lastName !== '' ? $lastName : null;
            }
        }

        if ($hasEmail) {
            $effectiveEmail = $email !== '' ? $email : $effectiveLogin;
            $fields[] = 'email = :email';
            $params['email'] = $effectiveEmail;
        }

        if ($hasAbout) {
            $fields[] = 'about = :about';
            $params['about'] = $about !== '' ? $about : null;
        }

        if ($password !== '') {
            $fields[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }

        $sql = 'UPDATE org_admins SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $updateStmt = $pdo->prepare($sql);
        $updateStmt->execute($params);

        jsonResponse([
            'message' => 'Профиль обновлён',
            'user' => buildOrgAdminResponse($pdo, $adminId),
        ]);
    }

    if ($fullName === '') {
        jsonResponse(['message' => 'Укажите ФИО'], 422);
    }

    if ($email === '') {
        jsonResponse(['message' => 'Укажите email'], 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['message' => 'Некорректный email'], 422);
    }

    [$firstName, $lastName] = splitFullName($fullName);

    if ($firstName === '') {
        jsonResponse(['message' => 'Укажите ФИО'], 422);
    }

    if (mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100) {
        jsonResponse(['message' => 'ФИО слишком длинное'], 422);
    }

    if (mb_strlen($about) > 1000) {
        jsonResponse(['message' => 'Поле «О себе» слишком длинное'], 422);
    }

    $userId = (int)$user['id'];

    $duplicateStmt = $pdo->prepare('
        SELECT id
        FROM users
        WHERE email = :email
          AND id <> :id
        LIMIT 1
    ');
    $duplicateStmt->execute([
        'email' => $email,
        'id' => $userId,
    ]);

    if ($duplicateStmt->fetch()) {
        jsonResponse(['message' => 'Пользователь с таким email уже существует'], 409);
    }

    $fields = [
        'first_name = :first_name',
        'last_name = :last_name',
        'email = :email',
        'about = :about',
    ];
    $params = [
        'id' => $userId,
        'first_name' => $firstName,
        'last_name' => $lastName !== '' ? $lastName : null,
        'email' => $email,
        'about' => $about !== '' ? $about : null,
    ];

    if ($password !== '') {
        $fields[] = 'password_hash = :password_hash';
        $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    $updateStmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id');
    $updateStmt->execute($params);

    $userStmt = $pdo->prepare('
        SELECT id, email, first_name, last_name, about, role, created_at
        FROM users
        WHERE id = :id
        LIMIT 1
    ');
    $userStmt->execute(['id' => $userId]);
    $updatedUser = $userStmt->fetch();

    if (!$updatedUser) {
        jsonResponse(['message' => 'Пользователь не найден'], 404);
    }

    $updatedUser['auth_source'] = 'users';

    jsonResponse([
        'message' => 'Профиль обновлён',
        'user' => $updatedUser,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
