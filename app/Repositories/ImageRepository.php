<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;

final class ImageRepository extends Repository
{
    public function findBinaryById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT data, content_type, filename, size
            FROM images
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
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
            'filename' => basename((string)($image['filename'] ?: ('image-' . $id))),
        ];
    }

    public function findPreparedForAi(int $appealId): array
    {
        $stmt = $this->db->prepare('
            SELECT
                filename,
                content_type,
                size,
                encode(data, \'base64\') AS data_base64
            FROM images
            WHERE appeal_id = :appeal_id
            ORDER BY id ASC
            LIMIT 3
        ');
        $stmt->execute(['appeal_id' => $appealId]);

        return array_map(static function (array $image): array {
            return [
                'filename' => (string)($image['filename'] ?? ''),
                'content_type' => (string)($image['content_type'] ?? 'image/jpeg'),
                'size' => (int)($image['size'] ?? 0),
                'data_base64' => preg_replace('/\s+/', '', (string)($image['data_base64'] ?? '')) ?? '',
            ];
        }, $stmt->fetchAll());
    }

    public function findUrlsByAppealIds(array $appealIds, int $limitPerAppeal = 3, bool $inlineData = false): array
    {
        if (!$appealIds || !$this->tableExists('images')) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($appealIds as $index => $appealId) {
            $param = 'appeal_id_' . $index;
            $placeholders[] = ':' . $param;
            $params[$param] = (int)$appealId;
        }

        $hasUrl = $this->columnExists('images', 'url');
        $hasData = $this->columnExists('images', 'data');
        $hasContentType = $this->columnExists('images', 'content_type');

        if ($hasUrl) {
            $sql = '
                SELECT appeal_id, id, url
                FROM images
                WHERE appeal_id IN (' . implode(', ', $placeholders) . ')
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ';
        } elseif ($hasData) {
            $contentTypeSql = $hasContentType ? 'content_type' : '\'image/jpeg\'::text AS content_type';
            $dataSql = $inlineData ? ', encode(data, \'base64\') AS data_base64' : '';
            $sql = '
                SELECT appeal_id, id, ' . $contentTypeSql . $dataSql . '
                FROM images
                WHERE appeal_id IN (' . implode(', ', $placeholders) . ')
                ORDER BY appeal_id ASC, uploaded_at ASC, id ASC
            ';
        } else {
            return [];
        }

        $stmt = $this->db->prepare($sql);
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
                    $existing[] = [
                        'id' => (int)$row['id'],
                        'url' => $url,
                    ];
                }
            } elseif ($inlineData) {
                $base64 = (string)($row['data_base64'] ?? '');
                if ($base64 !== '') {
                    $contentType = (string)($row['content_type'] ?: 'image/jpeg');
                    $existing[] = [
                        'id' => (int)$row['id'],
                        'url' => 'data:' . $contentType . ';base64,' . $base64,
                    ];
                }
            } else {
                $existing[] = [
                    'id' => (int)$row['id'],
                    'url' => 'api/images/' . (int)$row['id'],
                    'content_type' => (string)($row['content_type'] ?: 'image/jpeg'),
                ];
            }

            $imagesByAppeal[$appealId] = $existing;
        }

        return $imagesByAppeal;
    }
}
