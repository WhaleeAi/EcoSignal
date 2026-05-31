<?php

declare(strict_types=1);

namespace EcoSignal\Repositories;

use EcoSignal\Core\SchemaInspector;
use PDO;

final class ImageRepository
{
    private SchemaInspector $schema;

    public function __construct(private readonly PDO $pdo)
    {
        $this->schema = new SchemaInspector($pdo);
    }

    public function saveForAppeal(int $appealId, array $images): array
    {
        if (!$images) {
            return [];
        }

        $stmt = $this->pdo->prepare('
            INSERT INTO images (appeal_id, data, content_type, filename, size)
            VALUES (:appeal_id, decode(:data_base64, \'base64\'), :content_type, :filename, :size)
            RETURNING id, content_type, filename, size, uploaded_at
        ');

        $saved = [];
        foreach ($images as $image) {
            $stmt->execute([
                'appeal_id' => $appealId,
                'data_base64' => $image['data_base64'],
                'content_type' => $image['content_type'],
                'filename' => $image['filename'],
                'size' => $image['size'],
            ]);
            $saved[] = $stmt->fetch();
        }

        return $saved;
    }

    public function findBinary(int $imageId): ?array
    {
        $stmt = $this->pdo->prepare('
            SELECT data, content_type, filename, size
            FROM images
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $imageId]);
        $image = $stmt->fetch();

        if (!$image) {
            return null;
        }

        $data = $image['data'];
        if (is_resource($data)) {
            $data = stream_get_contents($data);
        }

        if (!is_string($data) || $data === '') {
            return null;
        }

        return [
            'data' => $data,
            'content_type' => (string)($image['content_type'] ?: 'image/jpeg'),
            'filename' => basename((string)($image['filename'] ?: ('image-' . $imageId))),
        ];
    }

    public function fetchByAppealIds(array $appealIds, int $limitPerAppeal, bool $inlineData): array
    {
        if (!$appealIds || !$this->schema->tableExists('images')) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($appealIds as $index => $appealId) {
            $param = 'appeal_id_' . $index;
            $placeholders[] = ':' . $param;
            $params[$param] = (int)$appealId;
        }

        $hasUrl = $this->schema->columnExists('images', 'url');
        $hasData = $this->schema->columnExists('images', 'data');
        $hasContentType = $this->schema->columnExists('images', 'content_type');

        if ($hasUrl) {
            $sql = '
                SELECT appeal_id, id, url
                FROM images
                WHERE appeal_id IN (' . implode(', ', $placeholders) . ')
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ';
        } elseif ($hasData) {
            $contentTypeSql = $hasContentType ? 'content_type' : "'image/jpeg'::text AS content_type";
            $dataSql = $inlineData ? ", encode(data, 'base64') AS data_base64" : '';
            $sql = "
                SELECT appeal_id, id, {$contentTypeSql}{$dataSql}
                FROM images
                WHERE appeal_id IN (" . implode(', ', $placeholders) . ")
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ";
        } else {
            return [];
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $imagesByAppeal = [];
        foreach ($stmt->fetchAll() as $row) {
            $appealId = (int)$row['appeal_id'];
            $existing = $imagesByAppeal[$appealId] ?? [];
            if (count($existing) >= $limitPerAppeal) {
                continue;
            }

            if ($hasUrl) {
                $url = (string)($row['url'] ?? '');
                if ($url !== '') {
                    $existing[] = ['id' => (int)$row['id'], 'url' => $url];
                }
            } elseif ($inlineData) {
                $contentType = (string)($row['content_type'] ?? 'image/jpeg');
                $base64 = (string)($row['data_base64'] ?? '');
                if ($base64 !== '') {
                    $existing[] = ['id' => (int)$row['id'], 'url' => 'data:' . $contentType . ';base64,' . $base64];
                }
            } else {
                $existing[] = [
                    'id' => (int)$row['id'],
                    'url' => 'backend/image.php?id=' . (int)$row['id'],
                    'content_type' => (string)($row['content_type'] ?: 'image/jpeg'),
                ];
            }

            $imagesByAppeal[$appealId] = $existing;
        }

        return $imagesByAppeal;
    }
}

