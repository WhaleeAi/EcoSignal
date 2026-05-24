<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

function buildFullName(?string $firstName, ?string $lastName, ?string $email): string
{
    $fullName = trim((string)$firstName . ' ' . (string)$lastName);
    if ($fullName !== '') {
        return $fullName;
    }

    return (string)$email;
}

$admin = requireAuth();

if (($admin['role'] ?? '') !== 'admin' || ($admin['auth_source'] ?? '') !== 'org_admins') {
    jsonResponse(['message' => 'Доступ только для агента'], 403);
}

$appealId = (int)($_GET['appeal_id'] ?? 0);
if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];

    $pdo->beginTransaction();

    $markReadStmt = $pdo->prepare('
        UPDATE appeal_chats
        SET is_read = TRUE
        WHERE appeal_id = :appeal_id
          AND sender_user_id IS NOT NULL
          AND is_read = FALSE
    ');
    $markReadStmt->execute([
        'appeal_id' => $appealId,
    ]);

    $appealStmt = $pdo->prepare("
        SELECT
            a.id AS appeal_id,
            a.status,
            a.description,
            a.created_at,
            a.priority,
            a.latitude,
            a.longitude,
            a.assigned_admin_id,
            aa.id AS assignment_id,
            aa.assigned_at,
            aa.status AS assignment_status,
            aa.organization_id,
            aa.filial_id,
            aa.responsible_org_admin_id,
            o.name AS organization_name,
            f.name AS filial_name,
            f.region AS filial_region,
            oa.login AS responsible_org_admin_login,
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.score,
            c.name AS category_name,
            s.name AS subcategory_name
        FROM appeals a
        INNER JOIN users u ON u.id = a.user_id
        INNER JOIN categories c ON c.id = a.category_id
        LEFT JOIN subcategories s ON s.id = a.subcategory_id
        INNER JOIN LATERAL (
            SELECT
                id,
                responsible_org_admin_id,
                assigned_at,
                status,
                organization_id,
                filial_id
            FROM appeal_assignments
            WHERE appeal_id = a.id
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ) aa ON aa.responsible_org_admin_id = :admin_id
        LEFT JOIN organizations o ON o.id = aa.organization_id
        LEFT JOIN filials f ON f.id = aa.filial_id
        LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id
        WHERE a.id = :appeal_id
          AND a.status <> 'pending'
        LIMIT 1
    ");
    $appealStmt->execute([
        'admin_id' => $adminId,
        'appeal_id' => $appealId,
    ]);
    $row = $appealStmt->fetch();

    if (!$row) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка не найдена или недоступна агенту'], 404);
    }

    $imagesStmt = $pdo->prepare("
        SELECT
            id,
            content_type
        FROM images
        WHERE appeal_id = :appeal_id
        ORDER BY uploaded_at ASC, id ASC
    ");
    $imagesStmt->execute(['appeal_id' => $appealId]);

    $images = [];
    foreach ($imagesStmt->fetchAll() as $imageRow) {
        if (count($images) >= 3) {
            break;
        }

        $images[] = [
            'id' => (int)$imageRow['id'],
            'url' => 'backend/image.php?id=' . (int)$imageRow['id'],
            'content_type' => (string)($imageRow['content_type'] ?: 'image/jpeg'),
        ];
    }

    $chatStmt = $pdo->prepare("
        SELECT
            ac.id,
            ac.message,
            ac.created_at,
            ac.is_read,
            ac.sender_user_id,
            ac.sender_org_admin_id,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.email AS user_email,
            oa.login AS org_admin_login
        FROM appeal_chats ac
        LEFT JOIN users u ON u.id = ac.sender_user_id
        LEFT JOIN org_admins oa ON oa.id = ac.sender_org_admin_id
        WHERE ac.appeal_id = :appeal_id
        ORDER BY ac.created_at ASC, ac.id ASC
    ");
    $chatStmt->execute(['appeal_id' => $appealId]);

    $messages = array_map(
        static function (array $messageRow) use ($adminId): array {
            $isAgentMessage = $messageRow['sender_org_admin_id'] !== null;

            return [
                'id' => (int)$messageRow['id'],
                'message' => (string)$messageRow['message'],
                'created_at' => (string)$messageRow['created_at'],
                'is_read' => (bool)$messageRow['is_read'],
                'sender_type' => $isAgentMessage ? 'agent' : 'citizen',
                'sender_name' => $isAgentMessage
                    ? (string)($messageRow['org_admin_login'] ?? 'Агент')
                    : buildFullName(
                        $messageRow['user_first_name'] ?? null,
                        $messageRow['user_last_name'] ?? null,
                        $messageRow['user_email'] ?? null
                    ),
                'is_own' => $isAgentMessage && (int)$messageRow['sender_org_admin_id'] === $adminId,
            ];
        },
        $chatStmt->fetchAll()
    );

    $pdo->commit();

    $reporterName = buildFullName(
        $row['first_name'] ?? null,
        $row['last_name'] ?? null,
        $row['email'] ?? null
    );

    jsonResponse([
        'appeal' => [
            'id' => (int)$row['appeal_id'],
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'assigned_at' => (string)$row['assigned_at'],
            'priority' => (int)$row['priority'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'assigned_admin_id' => $row['assigned_admin_id'] !== null
                ? (int)$row['assigned_admin_id']
                : null,
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'user' => [
                'id' => (int)$row['user_id'],
                'name' => $reporterName,
                'level' => (int)($row['score'] ?? 0),
                'email' => (string)$row['email'],
            ],
            'images' => $images,
            'assignment' => [
                'id' => (int)$row['assignment_id'],
                'organization_id' => (int)$row['organization_id'],
                'organization_name' => (string)$row['organization_name'],
                'filial_id' => (int)$row['filial_id'],
                'filial_name' => (string)$row['filial_name'],
                'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
                'responsible_org_admin_id' => $row['responsible_org_admin_id'] !== null
                    ? (int)$row['responsible_org_admin_id']
                    : null,
                'responsible_org_admin_login' => $row['responsible_org_admin_login'] !== null
                    ? (string)$row['responsible_org_admin_login']
                    : null,
                'status' => (string)$row['assignment_status'],
            ],
        ],
        'chat' => $messages,
    ]);
} catch (Throwable $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
