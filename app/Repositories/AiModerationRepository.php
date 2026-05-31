<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;
use RuntimeException;

final class AiModerationRepository extends Repository
{
    public function references(): array
    {
        $categories = $this->db->query('
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                s.id AS subcategory_id,
                s.name AS subcategory_name
            FROM categories c
            LEFT JOIN subcategories s ON s.category_id = c.id
            ORDER BY c.id ASC, s.id ASC
        ')->fetchAll();

        $filials = $this->db->query('
            SELECT
                o.id AS organization_id,
                o.name AS organization_name,
                o.org_type,
                f.id AS filial_id,
                f.name AS filial_name,
                f.address,
                f.region,
                f.latitude,
                f.longitude
            FROM organizations o
            INNER JOIN filials f ON f.organization_id = o.id
            WHERE f.is_active = TRUE
            ORDER BY o.name ASC, f.name ASC
        ')->fetchAll();

        return [
            'categories' => $categories,
            'filials' => $filials,
        ];
    }

    public function organizationExists(int $organizationId): bool
    {
        $stmt = $this->db->prepare('
            SELECT 1
            FROM organizations
            WHERE id = :organization_id
            LIMIT 1
        ');
        $stmt->execute(['organization_id' => $organizationId]);

        return (bool)$stmt->fetchColumn();
    }

    public function nearestActiveFilial(int $organizationId, float $latitude, float $longitude): ?array
    {
        $stmt = $this->db->prepare('
            SELECT
                id,
                name,
                latitude,
                longitude,
                (
                    6371 * acos(
                        LEAST(
                            1,
                            GREATEST(
                                -1,
                                cos(radians(:appeal_lat_1)) * cos(radians(latitude)) *
                                cos(radians(longitude) - radians(:appeal_lng_1)) +
                                sin(radians(:appeal_lat_2)) * sin(radians(latitude))
                            )
                        )
                    )
                ) AS distance_km
            FROM filials
            WHERE organization_id = :organization_id
              AND is_active = TRUE
            ORDER BY distance_km ASC, id ASC
            LIMIT 1
        ');
        $stmt->execute([
            'organization_id' => $organizationId,
            'appeal_lat_1' => $latitude,
            'appeal_lat_2' => $latitude,
            'appeal_lng_1' => $longitude,
        ]);

        $filial = $stmt->fetch();
        return $filial ?: null;
    }

    public function validateAssignment(int $organizationId, int $filialId): bool
    {
        $stmt = $this->db->prepare('
            SELECT 1
            FROM filials f
            INNER JOIN organizations o ON o.id = f.organization_id
            WHERE f.id = :filial_id
              AND f.organization_id = :organization_id
              AND f.is_active = TRUE
            LIMIT 1
        ');
        $stmt->execute([
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
        ]);

        return (bool)$stmt->fetchColumn();
    }

    public function assignmentLabel(int $organizationId, int $filialId): string
    {
        $stmt = $this->db->prepare('
            SELECT
                o.name AS organization_name,
                f.name AS filial_name,
                f.region AS filial_region
            FROM organizations o
            INNER JOIN filials f ON f.organization_id = o.id
            WHERE o.id = :organization_id
              AND f.id = :filial_id
            LIMIT 1
        ');
        $stmt->execute([
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
        ]);

        $info = $stmt->fetch() ?: [];
        $label = trim((string)($info['organization_name'] ?? ''));
        $filialLabel = trim((string)($info['filial_name'] ?? ''));

        if (!empty($info['filial_region'])) {
            $filialLabel .= ' (' . (string)$info['filial_region'] . ')';
        }

        if ($filialLabel !== '') {
            $label .= ($label === '' ? '' : ', ') . $filialLabel;
        }

        return $label !== '' ? $label : 'выбранный филиал';
    }

    public function nextResponsibleOrgAdmin(int $organizationId, int $filialId): array
    {
        $candidateStmt = $this->db->prepare('
            SELECT id, login
            FROM org_admins
            WHERE organization_id = :organization_id
              AND filial_id = :filial_id
              AND role = :role
              AND is_active = TRUE
            ORDER BY id ASC
        ');
        $candidateStmt->execute([
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'role' => 'admin',
        ]);

        $candidates = $candidateStmt->fetchAll();
        if (!$candidates) {
            throw new RuntimeException('В выбранном филиале нет активных сотрудников для обработки заявки.');
        }

        if (count($candidates) === 1) {
            return $candidates[0];
        }

        $placeholders = [];
        $params = [
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
        ];

        foreach ($candidates as $index => $candidate) {
            $param = 'candidate_id_' . $index;
            $placeholders[] = ':' . $param;
            $params[$param] = (int)$candidate['id'];
        }

        $lastAssignedStmt = $this->db->prepare('
            SELECT responsible_org_admin_id
            FROM appeal_assignments
            WHERE organization_id = :organization_id
              AND filial_id = :filial_id
              AND responsible_org_admin_id IN (' . implode(', ', $placeholders) . ')
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ');
        $lastAssignedStmt->execute($params);

        $lastAssignedId = (int)($lastAssignedStmt->fetchColumn() ?: 0);
        if ($lastAssignedId <= 0) {
            return $candidates[0];
        }

        foreach ($candidates as $index => $candidate) {
            if ((int)$candidate['id'] === $lastAssignedId) {
                return $candidates[($index + 1) % count($candidates)];
            }
        }

        return $candidates[0];
    }
}
