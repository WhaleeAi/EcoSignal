<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

requireAuth();

try {
    $pdo = getPDO();

    $stmt = $pdo->query('
        SELECT
            c.id AS category_id,
            c.name AS category_name,
            s.id AS subcategory_id,
            s.name AS subcategory_name
        FROM categories c
        LEFT JOIN subcategories s ON s.category_id = c.id
        ORDER BY c.name ASC, s.name ASC
    ');

    $rows = $stmt->fetchAll();
    $categories = [];

    foreach ($rows as $row) {
        $categoryId = (int)$row['category_id'];

        if (!isset($categories[$categoryId])) {
            $categories[$categoryId] = [
                'id' => $categoryId,
                'name' => $row['category_name'],
                'subcategories' => [],
            ];
        }

        if ($row['subcategory_id'] !== null) {
            $categories[$categoryId]['subcategories'][] = [
                'id' => (int)$row['subcategory_id'],
                'name' => $row['subcategory_name'],
            ];
        }
    }

    jsonResponse([
        'categories' => array_values($categories),
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
