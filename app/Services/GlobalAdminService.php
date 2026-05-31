<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

final class GlobalAdminService
{
    private PDO $db;
    private AccessService $access;

    public function __construct(PDO $db, AccessService $access)
    {
        $this->db = $db;
        $this->access = $access;
    }

    public function dashboard(array $user): array
    {
        $this->access->requireGlobalAdmin($user);

        return [
            'user' => $user,
            'metrics' => $this->metrics(),
            'statuses' => $this->rows('SELECT status, COUNT(*) AS total FROM appeals GROUP BY status ORDER BY total DESC'),
            'categories' => $this->rows('
                SELECT COALESCE(c.name, \'Без категории\') AS name, COUNT(*) AS total
                FROM appeals a
                LEFT JOIN categories c ON c.id = a.category_id
                GROUP BY COALESCE(c.name, \'Без категории\')
                ORDER BY total DESC
                LIMIT 8
            '),
            'dynamics' => $this->rows('
                SELECT created_at::date AS day, COUNT(*) AS total
                FROM appeals
                WHERE created_at >= NOW() - INTERVAL \'14 days\'
                GROUP BY created_at::date
                ORDER BY day ASC
            '),
            'problem_zones' => $this->rows('
                SELECT
                    ROUND(latitude::numeric, 2) AS latitude,
                    ROUND(longitude::numeric, 2) AS longitude,
                    COUNT(*) AS total
                FROM appeals
                GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
                HAVING COUNT(*) > 1
                ORDER BY total DESC
                LIMIT 10
            '),
        ];
    }

    public function appeals(array $user): array
    {
        $this->access->requireGlobalAdmin($user);

        return [
            'appeals' => $this->rows('
                SELECT
                    a.id,
                    a.status,
                    a.priority,
                    a.description,
                    a.latitude,
                    a.longitude,
                    a.created_at,
                    u.email AS citizen_email,
                    c.name AS category_name,
                    s.name AS subcategory_name,
                    o.name AS organization_name,
                    f.name AS filial_name,
                    oa.login AS responsible_login
                FROM appeals a
                LEFT JOIN users u ON u.id = a.user_id
                LEFT JOIN categories c ON c.id = a.category_id
                LEFT JOIN subcategories s ON s.id = a.subcategory_id
                LEFT JOIN LATERAL (
                    SELECT organization_id, filial_id, responsible_org_admin_id, assigned_at
                    FROM appeal_assignments aa
                    WHERE aa.appeal_id = a.id
                    ORDER BY aa.assigned_at DESC, aa.id DESC
                    LIMIT 1
                ) aa ON TRUE
                LEFT JOIN organizations o ON o.id = aa.organization_id
                LEFT JOIN filials f ON f.id = aa.filial_id
                LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id
                ORDER BY a.created_at DESC, a.id DESC
                LIMIT 200
            '),
        ];
    }

    public function audit(array $user): array
    {
        $this->access->requireGlobalAdmin($user);

        $this->ensureAuditTable();
        return [
            'events' => $this->rows('
                SELECT id, actor_source, actor_id, actor_role, action, entity_type, entity_id, details, created_at
                FROM system_audit_logs
                ORDER BY created_at DESC, id DESC
                LIMIT 200
            '),
            'assignments' => $this->rows('
                SELECT
                    aa.id,
                    aa.appeal_id,
                    aa.status,
                    aa.assigned_at,
                    o.name AS organization_name,
                    f.name AS filial_name,
                    oa.login AS responsible_login,
                    u.email AS assigned_by_email
                FROM appeal_assignments aa
                LEFT JOIN organizations o ON o.id = aa.organization_id
                LEFT JOIN filials f ON f.id = aa.filial_id
                LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id
                LEFT JOIN users u ON u.id = aa.assigned_by
                ORDER BY aa.assigned_at DESC, aa.id DESC
                LIMIT 200
            '),
        ];
    }

    public function export(array $user): array
    {
        $payload = $this->dashboard($user);
        $payload['appeals'] = $this->appeals($user)['appeals'];
        $payload['audit'] = $this->audit($user);
        $payload['exported_at'] = date('c');

        return $payload;
    }

    private function metrics(): array
    {
        return [
            'appeals' => $this->count('appeals'),
            'users' => $this->count('users'),
            'organizations' => $this->count('organizations'),
            'filials' => $this->count('filials'),
            'org_admins' => $this->count('org_admins'),
        ];
    }

    private function count(string $table): int
    {
        return (int)$this->db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
    }

    private function rows(string $sql): array
    {
        return $this->db->query($sql)->fetchAll();
    }

    private function ensureAuditTable(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS system_audit_logs (
                id BIGSERIAL PRIMARY KEY,
                actor_source VARCHAR(32) NOT NULL,
                actor_id BIGINT,
                actor_role VARCHAR(32),
                action VARCHAR(80) NOT NULL,
                entity_type VARCHAR(80) NOT NULL,
                entity_id BIGINT,
                details JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        ");
    }
}
