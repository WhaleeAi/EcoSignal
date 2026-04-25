<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

function buildUserFullName(?string $firstName, ?string $lastName, ?string $email): string
{
    $fullName = trim((string)$firstName . ' ' . (string)$lastName);
    return $fullName !== '' ? $fullName : (string)$email;
}

$user = requireAuth();
$appealId = (int)($_GET['appeal_id'] ?? 0);

if (!in_array(($user['role'] ?? ''), ['citizen', 'user'], true)) {
    jsonResponse(['message' => 'Доступ только для пользователя'], 403);
}

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

try {
    $pdo = getPDO();
    $userId = (int)$user['id'];

    $pdo->beginTransaction();

    $appealStmt = $pdo->prepare("
        SELECT
            a.id AS appeal_id,
            a.status,
            a.description,
            a.created_at,
            a.priority,
            a.latitude,
            a.longitude,
            c.name AS category_name,
            s.name AS subcategory_name,
            aa.id AS assignment_id,
            aa.assigned_at,
            aa.status AS assignment_status,
            aa.organization_id,
            aa.filial_id,
            aa.responsible_org_admin_id,
            o.name AS organization_name,
            f.name AS filial_name,
            f.region AS filial_region,
            oa.login AS responsible_org_admin_login
        FROM appeals a
        INNER JOIN categories c ON c.id = a.category_id
        LEFT JOIN subcategories s ON s.id = a.subcategory_id
        LEFT JOIN LATERAL (
            SELECT
                id,
                assigned_at,
                status,
                organization_id,
                filial_id,
                responsible_org_admin_id
            FROM appeal_assignments
            WHERE appeal_id = a.id
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ) aa ON TRUE
        LEFT JOIN organizations o ON o.id = aa.organization_id
        LEFT JOIN filials f ON f.id = aa.filial_id
        LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id
        WHERE a.id = :appeal_id
          AND a.user_id = :user_id
        LIMIT 1
    ");
    $appealStmt->execute([
        'appeal_id' => $appealId,
        'user_id' => $userId,
    ]);
    $row = $appealStmt->fetch();

    if (!$row) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка не найдена'], 404);
    }

    $markReadStmt = $pdo->prepare('
        UPDATE appeal_chats
        SET is_read = TRUE
        WHERE appeal_id = :appeal_id
          AND sender_org_admin_id IS NOT NULL
          AND is_read = FALSE
    ');
    $markReadStmt->execute(['appeal_id' => $appealId]);

    $imagesStmt = $pdo->prepare("
        SELECT
            id,
            content_type,
            encode(data, 'base64') AS data_base64
        FROM images
        WHERE appeal_id = :appeal_id
        ORDER BY uploaded_at ASC, id ASC
    ");
    $imagesStmt->execute(['appeal_id' => $appealId]);

    $images = [];
    foreach ($imagesStmt->fetchAll() as $imageRow) {
        if (count($images) >= 9) {
            break;
        }

        $contentType = (string)($imageRow['content_type'] ?: 'image/jpeg');
        $base64 = (string)$imageRow['data_base64'];
        $images[] = [
            'id' => (int)$imageRow['id'],
            'url' => 'data:' . $contentType . ';base64,' . $base64,
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
        static function (array $messageRow) use ($userId): array {
            $isUserMessage = $messageRow['sender_user_id'] !== null;

            return [
                'id' => (int)$messageRow['id'],
                'message' => (string)$messageRow['message'],
                'created_at' => (string)$messageRow['created_at'],
                'is_read' => (bool)$messageRow['is_read'],
                'sender_type' => $isUserMessage ? 'citizen' : 'agent',
                'sender_name' => $isUserMessage
                    ? buildUserFullName(
                        $messageRow['user_first_name'] ?? null,
                        $messageRow['user_last_name'] ?? null,
                        $messageRow['user_email'] ?? null
                    )
                    : (string)($messageRow['org_admin_login'] ?? 'Агент'),
                'is_own' => $isUserMessage && (int)$messageRow['sender_user_id'] === $userId,
            ];
        },
        $chatStmt->fetchAll()
    );

    $pdo->commit();

    jsonResponse([
        'appeal' => [
            'id' => (int)$row['appeal_id'],
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'priority' => (int)$row['priority'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'images' => $images,
            'assignment' => $row['assignment_id'] !== null ? [
                'id' => (int)$row['assignment_id'],
                'organization_id' => $row['organization_id'] !== null ? (int)$row['organization_id'] : null,
                'organization_name' => $row['organization_name'] !== null ? (string)$row['organization_name'] : null,
                'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
                'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
                'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
                'responsible_org_admin_id' => $row['responsible_org_admin_id'] !== null ? (int)$row['responsible_org_admin_id'] : null,
                'responsible_org_admin_login' => $row['responsible_org_admin_login'] !== null
                    ? (string)$row['responsible_org_admin_login']
                    : null,
                'status' => (string)$row['assignment_status'],
                'assigned_at' => (string)$row['assigned_at'],
            ] : null,
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
