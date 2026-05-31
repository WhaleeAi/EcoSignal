<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Contracts\AppealRepositoryInterface;
use App\Core\Repository;
use App\Models\Appeal;
use PDO;
use Throwable;

final class AppealRepository extends Repository implements AppealRepositoryInterface
{
    public function createWithImages(Appeal $appeal, array $images, string $systemMessage): array
    {
        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare('
                INSERT INTO appeals (
                    user_id,
                    category_id,
                    subcategory_id,
                    status,
                    description,
                    latitude,
                    longitude,
                    priority
                )
                VALUES (
                    :user_id,
                    :category_id,
                    :subcategory_id,
                    :status,
                    :description,
                    :latitude,
                    :longitude,
                    :priority
                )
                RETURNING
                    id,
                    user_id,
                    category_id,
                    subcategory_id,
                    status,
                    description,
                    latitude,
                    longitude,
                    priority,
                    created_at
            ');

            $stmt->execute([
                'user_id' => $appeal->userId(),
                'category_id' => $appeal->categoryId(),
                'subcategory_id' => $appeal->subcategoryId(),
                'status' => 'pending',
                'description' => $appeal->description(),
                'latitude' => $appeal->latitude(),
                'longitude' => $appeal->longitude(),
                'priority' => 0,
            ]);

            $createdAppeal = $stmt->fetch();
            $appealId = (int)$createdAppeal['id'];
            $savedImages = $this->insertImages($appealId, $images);
            $this->insertSystemMessage($appealId, $systemMessage);

            $this->db->commit();

            return [
                'appeal' => $createdAppeal,
                'images' => $savedImages,
            ];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $error;
        }
    }

    public function findForUser(int $userId): array
    {
        $hasSubcategoriesTable = $this->tableExists('subcategories');
        $hasAppealsSubcategoryColumn = $this->columnExists('appeals', 'subcategory_id');

        $subcategorySelectSql = 'NULL::text AS subcategory_name';
        $subcategoryJoinSql = '';

        if ($hasSubcategoriesTable && $hasAppealsSubcategoryColumn) {
            $subcategorySelectSql = 's.name AS subcategory_name';
            $subcategoryJoinSql = 'LEFT JOIN subcategories s ON s.id = a.subcategory_id';
        }

        $stmt = $this->db->prepare("
            SELECT
                a.id AS appeal_id,
                a.status,
                a.description,
                a.created_at,
                a.priority,
                a.latitude,
                a.longitude,
                c.name AS category_name,
                {$subcategorySelectSql}
            FROM appeals a
            INNER JOIN categories c ON c.id = a.category_id
            {$subcategoryJoinSql}
            WHERE a.user_id = :user_id
            ORDER BY a.created_at DESC
        ");
        $stmt->execute(['user_id' => $userId]);
        $appealRows = $stmt->fetchAll();

        $imagesByAppeal = $this->loadImagesByAppeal($appealRows);
        $appeals = [];

        foreach ($appealRows as $row) {
            $appealId = (int)$row['appeal_id'];

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
                'images' => $imagesByAppeal[$appealId] ?? [],
            ];
        }

        return $appeals;
    }

    private function insertImages(int $appealId, array $images): array
    {
        if (!$images) {
            return [];
        }

        $stmt = $this->db->prepare('
            INSERT INTO images (appeal_id, data, content_type, filename, size)
            VALUES (:appeal_id, decode(:data_base64, \'base64\'), :content_type, :filename, :size)
            RETURNING id, content_type, filename, size, uploaded_at
        ');

        $savedImages = [];
        foreach ($images as $image) {
            $stmt->execute([
                'appeal_id' => $appealId,
                'data_base64' => $image['data_base64'],
                'content_type' => $image['content_type'],
                'filename' => $image['filename'],
                'size' => $image['size'],
            ]);

            $savedImages[] = $stmt->fetch();
        }

        return $savedImages;
    }

    private function insertSystemMessage(int $appealId, string $message): void
    {
        $stmt = $this->db->prepare('
            INSERT INTO appeal_chats (
                appeal_id,
                sender_user_id,
                sender_org_admin_id,
                message
            ) VALUES (
                :appeal_id,
                NULL,
                NULL,
                :message
            )
        ');
        $stmt->execute([
            'appeal_id' => $appealId,
            'message' => $message,
        ]);
    }

    private function loadImagesByAppeal(array $appealRows): array
    {
        $appealIds = array_map(
            static fn(array $row): int => (int)$row['appeal_id'],
            $appealRows
        );

        if (!$appealIds || !$this->tableExists('images')) {
            return [];
        }

        $placeholders = [];
        $params = [];

        foreach ($appealIds as $index => $appealId) {
            $param = 'appeal_id_' . $index;
            $placeholders[] = ':' . $param;
            $params[$param] = $appealId;
        }

        $hasImageUrlColumn = $this->columnExists('images', 'url');
        $hasImageDataColumn = $this->columnExists('images', 'data');
        $hasImageContentTypeColumn = $this->columnExists('images', 'content_type');

        $sql = '';
        if ($hasImageUrlColumn) {
            $sql = '
                SELECT
                    appeal_id,
                    id,
                    url
                FROM images
                WHERE appeal_id IN (' . implode(', ', $placeholders) . ')
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ';
        } elseif ($hasImageDataColumn) {
            $contentTypeSql = $hasImageContentTypeColumn
                ? 'content_type'
                : '\'image/jpeg\'::text AS content_type';

            $sql = '
                SELECT
                    appeal_id,
                    id,
                    ' . $contentTypeSql . ',
                    encode(data, \'base64\') AS data_base64
                FROM images
                WHERE appeal_id IN (' . implode(', ', $placeholders) . ')
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ';
        }

        if ($sql === '') {
            return [];
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $imagesByAppeal = [];
        foreach ($stmt->fetchAll() as $row) {
            $appealId = (int)$row['appeal_id'];
            $existing = $imagesByAppeal[$appealId] ?? [];

            if (count($existing) >= 9) {
                continue;
            }

            if ($hasImageUrlColumn) {
                $url = (string)($row['url'] ?? '');
                if ($url !== '') {
                    $existing[] = [
                        'id' => (int)$row['id'],
                        'url' => $url,
                    ];
                }
            } else {
                $contentType = (string)($row['content_type'] ?? 'image/jpeg');
                $base64 = (string)($row['data_base64'] ?? '');
                if ($base64 !== '') {
                    $existing[] = [
                        'id' => (int)$row['id'],
                        'url' => 'data:' . $contentType . ';base64,' . $base64,
                    ];
                }
            }

            $imagesByAppeal[$appealId] = $existing;
        }

        return $imagesByAppeal;
    }
}
