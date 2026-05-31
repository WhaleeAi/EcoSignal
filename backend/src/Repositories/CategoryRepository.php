<?php

declare(strict_types=1);

namespace EcoSignal\Repositories;

use EcoSignal\Core\SchemaInspector;
use PDO;

final class CategoryRepository
{
    private SchemaInspector $schema;

    public function __construct(private readonly PDO $pdo)
    {
        $this->schema = new SchemaInspector($pdo);
    }

    public function allWithSubcategories(): array
    {
        $hasSubcategories = $this->schema->tableExists('subcategories');

        $stmt = $hasSubcategories
            ? $this->pdo->query('
                SELECT
                    c.id AS category_id,
                    c.name AS category_name,
                    s.id AS subcategory_id,
                    s.name AS subcategory_name
                FROM categories c
                LEFT JOIN subcategories s ON s.category_id = c.id
                ORDER BY c.name ASC, s.name ASC
            ')
            : $this->pdo->query('
                SELECT
                    c.id AS category_id,
                    c.name AS category_name,
                    NULL::int AS subcategory_id,
                    NULL::text AS subcategory_name
                FROM categories c
                ORDER BY c.name ASC
            ');

        $categories = [];
        foreach ($stmt->fetchAll() as $row) {
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

        return array_values($categories);
    }

    public function categoryExists(int $categoryId): bool
    {
        $stmt = $this->pdo->prepare('SELECT id FROM categories WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $categoryId]);

        return (bool)$stmt->fetch();
    }

    public function subcategoryBelongsToCategory(int $subcategoryId, int $categoryId): bool
    {
        $stmt = $this->pdo->prepare('
            SELECT id
            FROM subcategories
            WHERE id = :id AND category_id = :category_id
            LIMIT 1
        ');
        $stmt->execute([
            'id' => $subcategoryId,
            'category_id' => $categoryId,
        ]);

        return (bool)$stmt->fetch();
    }
}

