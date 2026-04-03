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

$user = requireAuth();

if (($user['role'] ?? '') === 'admin' || ($user['role'] ?? '') === 'superadmin') {
    jsonResponse(['message' => 'Доступ запрещен для выбранной роли'], 403);
}

try {
    $pdo = getPDO();
    $hasSubcategoriesTable = tableExists($pdo, 'subcategories');
    $hasAppealsSubcategoryColumn = columnExists($pdo, 'appeals', 'subcategory_id');

    $subcategorySelectSql = "NULL::text AS subcategory_name";
    $subcategoryJoinSql = "";

    if ($hasSubcategoriesTable && $hasAppealsSubcategoryColumn) {
        $subcategorySelectSql = "s.name AS subcategory_name";
        $subcategoryJoinSql = "LEFT JOIN subcategories s ON s.id = a.subcategory_id";
    }

    $appealsSql = "
        SELECT
            a.id AS appeal_id,
            a.status,
            a.description,
            a.created_at,
            a.priority,
            a.latitude,
            a.longitude,
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
        WHERE a.status <> 'rejected'
        ORDER BY a.created_at DESC
    ";

    $appealsStmt = $pdo->query($appealsSql);

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

        if ($imagesSql === '') {
            $imageParams = [];
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
            'latitude' => (float)$row['latitude'],
            'longitude' => (float)$row['longitude'],
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

    jsonResponse([
        'appeals' => $appeals,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
