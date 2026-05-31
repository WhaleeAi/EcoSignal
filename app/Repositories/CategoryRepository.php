<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Contracts\CategoryRepositoryInterface;
use App\Core\Repository;
use App\Models\Category;

final class CategoryRepository extends Repository implements CategoryRepositoryInterface
{
    public function tree(): array
    {
        if ($this->tableExists('subcategories')) {
            $stmt = $this->db->query('
                SELECT
                    c.id AS category_id,
                    c.name AS category_name,
                    s.id AS subcategory_id,
                    s.name AS subcategory_name
                FROM categories c
                LEFT JOIN subcategories s ON s.category_id = c.id
                ORDER BY c.name ASC, s.name ASC
            ');
        } else {
            $stmt = $this->db->query('
                SELECT
                    c.id AS category_id,
                    c.name AS category_name,
                    NULL::int AS subcategory_id,
                    NULL::text AS subcategory_name
                FROM categories c
                ORDER BY c.name ASC
            ');
        }

        $categories = [];

        foreach ($stmt->fetchAll() as $row) {
            $categoryId = (int)$row['category_id'];

            if (!isset($categories[$categoryId])) {
                $categories[$categoryId] = [
                    'id' => $categoryId,
                    'name' => (string)$row['category_name'],
                    'subcategories' => [],
                ];
            }

            if ($row['subcategory_id'] !== null) {
                $categories[$categoryId]['subcategories'][] = [
                    'id' => (int)$row['subcategory_id'],
                    'name' => (string)$row['subcategory_name'],
                ];
            }
        }

        return array_map(
            static fn(array $category): array => (new Category(
                (int)$category['id'],
                (string)$category['name'],
                $category['subcategories']
            ))->toArray(),
            array_values($categories)
        );
    }

    public function exists(int $categoryId): bool
    {
        $stmt = $this->db->prepare('
            SELECT id
            FROM categories
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $categoryId]);

        return (bool)$stmt->fetch();
    }

    public function subcategoryBelongsToCategory(int $subcategoryId, int $categoryId): bool
    {
        $stmt = $this->db->prepare('
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
