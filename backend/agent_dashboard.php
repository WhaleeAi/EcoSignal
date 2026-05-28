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

function tableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare('SELECT to_regclass(:table_name) AS table_name');
    $stmt->execute(['table_name' => $tableName]);
    $row = $stmt->fetch();

    return !empty($row['table_name']);
}

$admin = requireAuth();

if (($admin['role'] ?? '') !== 'admin' || ($admin['auth_source'] ?? '') !== 'org_admins') {
    jsonResponse(['message' => 'Доступ только для admin из org_admins'], 403);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];

    $hasSubcategoriesTable = tableExists($pdo, 'subcategories');
    $hasAppealsSubcategoryColumn = columnExists($pdo, 'appeals', 'subcategory_id');

    $subcategorySelectSql = "NULL::text AS subcategory_name";
    $subcategoryJoinSql = "";

    if ($hasSubcategoriesTable && $hasAppealsSubcategoryColumn) {
        $subcategorySelectSql = "s.name AS subcategory_name";
        $subcategoryJoinSql = "LEFT JOIN subcategories s ON s.id = a.subcategory_id";
    }

    $appealsStmt = $pdo->prepare("
        SELECT
            a.id AS appeal_id,
            a.status,
            a.description,
            a.created_at,
            a.priority,
            a.latitude,
            a.longitude,
            aa.assigned_at AS assignment_assigned_at,
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.score,
            c.name AS category_name,
            {$subcategorySelectSql}
        FROM appeals a
        INNER JOIN users u ON u.id = a.user_id
        INNER JOIN categories c ON c.id = a.category_id
        {$subcategoryJoinSql}
        INNER JOIN LATERAL (
            SELECT
                responsible_org_admin_id,
                assigned_at
            FROM appeal_assignments
            WHERE appeal_id = a.id
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ) aa ON aa.responsible_org_admin_id = :admin_id
        WHERE a.status <> 'pending'
          AND aa.assigned_at >= (CURRENT_DATE - INTERVAL '6 days')
          AND aa.assigned_at < (CURRENT_DATE + INTERVAL '1 day')
        ORDER BY aa.assigned_at DESC, a.created_at DESC
    ");
    $appealsStmt->execute(['admin_id' => $adminId]);
    $appealRows = $appealsStmt->fetchAll();

    $appealIds = array_map(
        static fn(array $row): int => (int)$row['appeal_id'],
        $appealRows
    );

    $imagesByAppeal = [];
    if (!empty($appealIds) && tableExists($pdo, 'images')) {
        $placeholders = [];
        $imageParams = [];

        foreach ($appealIds as $index => $appealId) {
            $param = 'appeal_id_' . $index;
            $placeholders[] = ':' . $param;
            $imageParams[$param] = $appealId;
        }

        $hasImageUrlColumn = columnExists($pdo, 'images', 'url');
        $hasImageDataColumn = columnExists($pdo, 'images', 'data');
        $hasImageContentTypeColumn = columnExists($pdo, 'images', 'content_type');

        $imagesSql = '';
        if ($hasImageUrlColumn) {
            $imagesSql = "
                SELECT
                    appeal_id,
                    id,
                    url
                FROM images
                WHERE appeal_id IN (" . implode(', ', $placeholders) . ")
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ";
        } elseif ($hasImageDataColumn) {
            $contentTypeSql = $hasImageContentTypeColumn
                ? "content_type"
                : "'image/jpeg'::text AS content_type";

            $imagesSql = "
                SELECT
                    appeal_id,
                    id,
                    {$contentTypeSql},
                    encode(data, 'base64') AS data_base64
                FROM images
                WHERE appeal_id IN (" . implode(', ', $placeholders) . ")
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ";
        }

        if ($imagesSql !== '') {
            $imagesStmt = $pdo->prepare($imagesSql);
            $imagesStmt->execute($imageParams);

            foreach ($imagesStmt->fetchAll() as $imageRow) {
                $appealId = (int)$imageRow['appeal_id'];
                $existing = $imagesByAppeal[$appealId] ?? [];

                if (count($existing) >= 3) {
                    continue;
                }

                if ($hasImageUrlColumn) {
                    $url = (string)($imageRow['url'] ?? '');
                    if ($url !== '') {
                        $existing[] = [
                            'id' => (int)$imageRow['id'],
                            'url' => $url,
                        ];
                    }
                } else {
                    $contentType = (string)($imageRow['content_type'] ?: 'image/jpeg');
                    $base64 = (string)($imageRow['data_base64'] ?? '');
                    if ($base64 !== '') {
                        $existing[] = [
                            'id' => (int)$imageRow['id'],
                            'url' => 'data:' . $contentType . ';base64,' . $base64,
                        ];
                    }
                }

                $imagesByAppeal[$appealId] = $existing;
            }
        }
    }

    $chartStmt = $pdo->prepare("
        WITH days AS (
            SELECT generate_series(
                CURRENT_DATE - INTERVAL '6 days',
                CURRENT_DATE,
                INTERVAL '1 day'
            )::date AS day
        ),
        latest_assignments AS (
            SELECT
                aa.appeal_id,
                aa.assigned_at
            FROM appeal_assignments aa
            INNER JOIN (
                SELECT appeal_id, MAX(assigned_at) AS max_assigned_at
                FROM appeal_assignments
                GROUP BY appeal_id
            ) latest ON latest.appeal_id = aa.appeal_id
                    AND latest.max_assigned_at = aa.assigned_at
            WHERE aa.responsible_org_admin_id = :admin_id
        )
        SELECT
            to_char(d.day, 'YYYY-MM-DD') AS chart_date,
            COUNT(la.appeal_id)::int AS total
        FROM days d
        LEFT JOIN latest_assignments la
            ON la.assigned_at >= d.day
           AND la.assigned_at < (d.day + INTERVAL '1 day')
        GROUP BY d.day
        ORDER BY d.day ASC
    ");
    $chartStmt->execute(['admin_id' => $adminId]);
    $chartRows = $chartStmt->fetchAll();

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
            'assigned_at' => (string)$row['assignment_assigned_at'],
            'priority' => (int)$row['priority'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
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

    $chart = array_map(
        static fn(array $row): array => [
            'date' => (string)$row['chart_date'],
            'total' => (int)$row['total'],
        ],
        $chartRows
    );

    jsonResponse([
        'user' => [
            'id' => $adminId,
            'login' => (string)$admin['login'],
            'name' => (string)$admin['login'],
            'role' => (string)$admin['role'],
            'organization_name' => (string)$admin['organization_name'],
            'organization_type' => (string)$admin['organization_type'],
            'filial_name' => $admin['filial_name'] !== null ? (string)$admin['filial_name'] : null,
            'filial_region' => $admin['filial_region'] !== null ? (string)$admin['filial_region'] : null,
            'auth_source' => (string)$admin['auth_source'],
        ],
        'chart' => $chart,
        'appeals' => $appeals,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
