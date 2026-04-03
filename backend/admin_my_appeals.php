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

if (($admin['role'] ?? '') !== 'admin') {
    jsonResponse(['message' => 'Доступ только для администраторов'], 403);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];

    $appealsStmt = $pdo->prepare("
        SELECT
            a.id AS appeal_id,
            a.status,
            a.description,
            a.created_at,
            a.priority,
            a.assigned_admin_id,
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
        WHERE a.assigned_admin_id = :admin_id
          AND a.status <> 'pending'
        ORDER BY a.created_at DESC
    ");
    $appealsStmt->execute(['admin_id' => $adminId]);
    $appealRows = $appealsStmt->fetchAll();

    $appealIds = array_map(
        static fn(array $row): int => (int)$row['appeal_id'],
        $appealRows
    );

    $imagesByAppeal = [];
    if (!empty($appealIds)) {
        $placeholders = [];
        $imageParams = [];

        foreach ($appealIds as $index => $appealId) {
            $param = 'appeal_id_' . $index;
            $placeholders[] = ':' . $param;
            $imageParams[$param] = $appealId;
        }

        $imagesSql = "
            SELECT
                appeal_id,
                id,
                content_type,
                encode(data, 'base64') AS data_base64
            FROM images
            WHERE appeal_id IN (" . implode(', ', $placeholders) . ")
            ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
        ";

        $imagesStmt = $pdo->prepare($imagesSql);
        $imagesStmt->execute($imageParams);

        foreach ($imagesStmt->fetchAll() as $imageRow) {
            $appealId = (int)$imageRow['appeal_id'];
            $existing = $imagesByAppeal[$appealId] ?? [];

            if (count($existing) >= 3) {
                continue;
            }

            $contentType = (string)($imageRow['content_type'] ?: 'image/jpeg');
            $base64 = (string)$imageRow['data_base64'];

            $existing[] = [
                'id' => (int)$imageRow['id'],
                'url' => 'data:' . $contentType . ';base64,' . $base64,
            ];

            $imagesByAppeal[$appealId] = $existing;
        }
    }

    $appeals = [];
    foreach ($appealRows as $row) {
        $appealId = (int)$row['appeal_id'];
        $reporterName = buildFullName(
            $row['first_name'] ?? null,
            $row['last_name'] ?? null,
            $row['email'] ?? null
        );

        $appeals[] = [
            'id' => $appealId,
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'priority' => (int)$row['priority'],
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
            'images' => $imagesByAppeal[$appealId] ?? [],
        ];
    }

    $adminName = buildFullName(
        $admin['first_name'] ?? null,
        $admin['last_name'] ?? null,
        $admin['email'] ?? null
    );

    jsonResponse([
        'user' => [
            'id' => $adminId,
            'name' => $adminName,
            'role' => (string)$admin['role'],
        ],
        'appeals' => $appeals,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
