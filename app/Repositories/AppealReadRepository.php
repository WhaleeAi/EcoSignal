<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;
use Throwable;

final class AppealReadRepository extends Repository
{
    public function publicMapRows(): array
    {
        $subcategorySelect = 'NULL::text AS subcategory_name';
        $subcategoryJoin = '';

        if ($this->tableExists('subcategories') && $this->columnExists('appeals', 'subcategory_id')) {
            $subcategorySelect = 's.name AS subcategory_name';
            $subcategoryJoin = 'LEFT JOIN subcategories s ON s.id = a.subcategory_id';
        }

        $stmt = $this->db->query("
            SELECT
                a.id AS appeal_id,
                a.status,
                a.description,
                a.created_at,
                a.priority,
                a.latitude,
                a.longitude,
                ai_message.message AS ai_status_message,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.score,
                c.name AS category_name,
                {$subcategorySelect}
            FROM appeals a
            INNER JOIN users u ON u.id = a.user_id
            INNER JOIN categories c ON c.id = a.category_id
            {$subcategoryJoin}
            LEFT JOIN LATERAL (
                SELECT ac.message
                FROM appeal_chats ac
                WHERE ac.appeal_id = a.id
                  AND ac.sender_user_id IS NULL
                  AND ac.sender_org_admin_id IS NULL
                ORDER BY ac.created_at DESC, ac.id DESC
                LIMIT 1
            ) ai_message ON TRUE
            WHERE a.status IN ('confirmed', 'in_progress', 'resolved')
            ORDER BY a.created_at DESC
        ");

        return $stmt->fetchAll();
    }

    public function agentDashboardRows(int $adminId): array
    {
        $subcategorySelect = 'NULL::text AS subcategory_name';
        $subcategoryJoin = '';

        if ($this->tableExists('subcategories') && $this->columnExists('appeals', 'subcategory_id')) {
            $subcategorySelect = 's.name AS subcategory_name';
            $subcategoryJoin = 'LEFT JOIN subcategories s ON s.id = a.subcategory_id';
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
                aa.assigned_at AS assignment_assigned_at,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.score,
                c.name AS category_name,
                {$subcategorySelect}
            FROM appeals a
            INNER JOIN users u ON u.id = a.user_id
            INNER JOIN categories c ON c.id = a.category_id
            {$subcategoryJoin}
            INNER JOIN LATERAL (
                SELECT responsible_org_admin_id, assigned_at
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
        $stmt->execute(['admin_id' => $adminId]);

        return $stmt->fetchAll();
    }

    public function agentRows(int $adminId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                a.id AS appeal_id,
                a.status,
                a.description,
                a.created_at,
                a.priority,
                aa.assigned_at AS assignment_assigned_at,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.score,
                c.name AS category_name,
                s.name AS subcategory_name
            FROM appeals a
            INNER JOIN users u ON u.id = a.user_id
            INNER JOIN categories c ON c.id = a.category_id
            LEFT JOIN subcategories s ON s.id = a.subcategory_id
            INNER JOIN LATERAL (
                SELECT responsible_org_admin_id, assigned_at
                FROM appeal_assignments
                WHERE appeal_id = a.id
                ORDER BY assigned_at DESC, id DESC
                LIMIT 1
            ) aa ON aa.responsible_org_admin_id = :admin_id
            WHERE a.status <> 'pending'
            ORDER BY aa.assigned_at DESC, a.created_at DESC
        ");
        $stmt->execute(['admin_id' => $adminId]);

        return $stmt->fetchAll();
    }

    public function agentChartRows(int $adminId): array
    {
        $stmt = $this->db->prepare("
            WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 days',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS day
            ),
            latest_assignments AS (
                SELECT aa.appeal_id, aa.assigned_at
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
        $stmt->execute(['admin_id' => $adminId]);

        return $stmt->fetchAll();
    }

    public function citizenDetail(int $appealId, int $userId): ?array
    {
        $hasAssignments = $this->tableExists('appeal_assignments');
        $hasOrganizations = $this->tableExists('organizations');
        $hasFilials = $this->tableExists('filials');
        $hasOrgAdmins = $this->tableExists('org_admins');
        $hasSubcategories = $this->tableExists('subcategories') && $this->columnExists('appeals', 'subcategory_id');

        $assignmentSelect = "
            NULL::bigint AS assignment_id,
            NULL::timestamp AS assigned_at,
            NULL::text AS assignment_status,
            NULL::bigint AS organization_id,
            NULL::bigint AS filial_id,
            NULL::bigint AS responsible_org_admin_id,
            NULL::text AS organization_name,
            NULL::text AS filial_name,
            NULL::text AS filial_region,
            NULL::text AS responsible_org_admin_login
        ";
        $assignmentJoin = '';
        $subcategorySelect = 'NULL::text AS subcategory_name';
        $subcategoryJoin = '';

        if ($hasSubcategories) {
            $subcategorySelect = 's.name AS subcategory_name';
            $subcategoryJoin = 'LEFT JOIN subcategories s ON s.id = a.subcategory_id';
        }

        if ($hasAssignments) {
            $assignmentSelect = "
                aa.id AS assignment_id,
                aa.assigned_at,
                aa.status AS assignment_status,
                aa.organization_id,
                aa.filial_id,
                aa.responsible_org_admin_id,
                " . ($hasOrganizations ? 'o.name' : 'NULL::text') . " AS organization_name,
                " . ($hasFilials ? 'f.name' : 'NULL::text') . " AS filial_name,
                " . ($hasFilials ? 'f.region' : 'NULL::text') . " AS filial_region,
                " . ($hasOrgAdmins ? 'oa.login' : 'NULL::text') . " AS responsible_org_admin_login
            ";

            $assignmentJoin = "
                LEFT JOIN LATERAL (
                    SELECT id, assigned_at, status, organization_id, filial_id, responsible_org_admin_id
                    FROM appeal_assignments
                    WHERE appeal_id = a.id
                    ORDER BY assigned_at DESC, id DESC
                    LIMIT 1
                ) aa ON TRUE
                " . ($hasOrganizations ? 'LEFT JOIN organizations o ON o.id = aa.organization_id' : '') . "
                " . ($hasFilials ? 'LEFT JOIN filials f ON f.id = aa.filial_id' : '') . "
                " . ($hasOrgAdmins ? 'LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id' : '') . "
            ";
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
                {$subcategorySelect},
                {$assignmentSelect}
            FROM appeals a
            INNER JOIN categories c ON c.id = a.category_id
            {$subcategoryJoin}
            {$assignmentJoin}
            WHERE a.id = :appeal_id
              AND a.user_id = :user_id
            LIMIT 1
        ");
        $stmt->execute([
            'appeal_id' => $appealId,
            'user_id' => $userId,
        ]);

        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function agentDetail(int $appealId, int $adminId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                a.id AS appeal_id,
                a.status,
                a.description,
                a.created_at,
                a.priority,
                a.latitude,
                a.longitude,
                aa.id AS assignment_id,
                aa.assigned_at,
                aa.status AS assignment_status,
                aa.organization_id,
                aa.filial_id,
                aa.responsible_org_admin_id,
                o.name AS organization_name,
                f.name AS filial_name,
                f.region AS filial_region,
                oa.login AS responsible_org_admin_login,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.score,
                c.name AS category_name,
                s.name AS subcategory_name
            FROM appeals a
            INNER JOIN users u ON u.id = a.user_id
            INNER JOIN categories c ON c.id = a.category_id
            LEFT JOIN subcategories s ON s.id = a.subcategory_id
            INNER JOIN LATERAL (
                SELECT id, responsible_org_admin_id, assigned_at, status, organization_id, filial_id
                FROM appeal_assignments
                WHERE appeal_id = a.id
                ORDER BY assigned_at DESC, id DESC
                LIMIT 1
            ) aa ON aa.responsible_org_admin_id = :admin_id
            LEFT JOIN organizations o ON o.id = aa.organization_id
            LEFT JOIN filials f ON f.id = aa.filial_id
            LEFT JOIN org_admins oa ON oa.id = aa.responsible_org_admin_id
            WHERE a.id = :appeal_id
              AND a.status <> 'pending'
            LIMIT 1
        ");
        $stmt->execute([
            'admin_id' => $adminId,
            'appeal_id' => $appealId,
        ]);

        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function markCitizenMessagesRead(int $appealId): void
    {
        $stmt = $this->db->prepare('
            UPDATE appeal_chats
            SET is_read = TRUE
            WHERE appeal_id = :appeal_id
              AND sender_user_id IS NOT NULL
              AND is_read = FALSE
        ');
        $stmt->execute(['appeal_id' => $appealId]);
    }

    public function markAgentMessagesRead(int $appealId): void
    {
        if (!$this->tableExists('appeal_chats')) {
            return;
        }

        $stmt = $this->db->prepare('
            UPDATE appeal_chats
            SET is_read = TRUE
            WHERE appeal_id = :appeal_id
              AND sender_org_admin_id IS NOT NULL
              AND is_read = FALSE
        ');
        $stmt->execute(['appeal_id' => $appealId]);
    }

    public function imagesForAppeal(int $appealId, int $limit = 9, bool $inlineData = true): array
    {
        if (!$this->tableExists('images')) {
            return [];
        }

        $hasUrl = $this->columnExists('images', 'url');
        $hasData = $this->columnExists('images', 'data');
        $hasContentType = $this->columnExists('images', 'content_type');

        if ($hasUrl) {
            $sql = '
                SELECT id, url
                FROM images
                WHERE appeal_id = :appeal_id
                ORDER BY uploaded_at ASC, id ASC
            ';
        } elseif ($hasData) {
            $contentTypeSql = $hasContentType ? 'content_type' : '\'image/jpeg\'::text AS content_type';
            $dataSql = $inlineData ? ', encode(data, \'base64\') AS data_base64' : '';
            $sql = '
                SELECT id, ' . $contentTypeSql . $dataSql . '
                FROM images
                WHERE appeal_id = :appeal_id
                ORDER BY uploaded_at ASC, id ASC
            ';
        } else {
            return [];
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['appeal_id' => $appealId]);

        $images = [];
        foreach ($stmt->fetchAll() as $row) {
            if (count($images) >= $limit) {
                break;
            }

            if ($hasUrl) {
                $url = (string)($row['url'] ?? '');
                if ($url !== '') {
                    $images[] = ['id' => (int)$row['id'], 'url' => $url];
                }
                continue;
            }

            $contentType = (string)($row['content_type'] ?? 'image/jpeg');
            if ($inlineData) {
                $base64 = (string)($row['data_base64'] ?? '');
                if ($base64 !== '') {
                    $images[] = [
                        'id' => (int)$row['id'],
                        'url' => 'data:' . $contentType . ';base64,' . $base64,
                    ];
                }
            } else {
                $images[] = [
                    'id' => (int)$row['id'],
                    'url' => 'api/images/' . (int)$row['id'],
                    'content_type' => $contentType,
                ];
            }
        }

        return $images;
    }

    public function chatMessages(int $appealId): array
    {
        if (!$this->tableExists('appeal_chats')) {
            return [];
        }

        $hasOrgAdmins = $this->tableExists('org_admins');
        $stmt = $this->db->prepare("
            SELECT
                ac.id,
                ac.message,
                ac.created_at,
                ac.is_read,
                ac.sender_user_id,
                ac.sender_org_admin_id,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                " . ($hasOrgAdmins ? 'oa.login' : 'NULL::text') . " AS org_admin_login
            FROM appeal_chats ac
            LEFT JOIN users u ON u.id = ac.sender_user_id
            " . ($hasOrgAdmins ? 'LEFT JOIN org_admins oa ON oa.id = ac.sender_org_admin_id' : '') . "
            WHERE ac.appeal_id = :appeal_id
            ORDER BY ac.created_at ASC, ac.id ASC
        ");
        $stmt->execute(['appeal_id' => $appealId]);

        return $stmt->fetchAll();
    }

    public function userOwnsAppeal(int $appealId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            SELECT id
            FROM appeals
            WHERE id = :appeal_id
              AND user_id = :user_id
            LIMIT 1
        ');
        $stmt->execute([
            'appeal_id' => $appealId,
            'user_id' => $userId,
        ]);

        return (bool)$stmt->fetch();
    }

    public function chatAvailableForUser(int $appealId): bool
    {
        if (!$this->tableExists('appeal_assignments') || !$this->tableExists('appeal_chats')) {
            return false;
        }

        $stmt = $this->db->prepare('
            SELECT responsible_org_admin_id
            FROM appeal_assignments
            WHERE appeal_id = :appeal_id
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ');
        $stmt->execute(['appeal_id' => $appealId]);
        $assignment = $stmt->fetch();

        return $assignment && !empty($assignment['responsible_org_admin_id']);
    }

    public function addCitizenMessage(int $appealId, int $userId, string $message): void
    {
        $stmt = $this->db->prepare('
            INSERT INTO appeal_chats (
                appeal_id,
                sender_user_id,
                message
            ) VALUES (
                :appeal_id,
                :sender_user_id,
                :message
            )
        ');
        $stmt->execute([
            'appeal_id' => $appealId,
            'sender_user_id' => $userId,
            'message' => $message,
        ]);
    }

    public function updateByAgent(int $appealId, int $adminId, string $nextStatus, string $feedback): array
    {
        $this->db->beginTransaction();

        try {
            $appealStmt = $this->db->prepare("
                SELECT a.id, a.status, aa.id AS assignment_id
                FROM appeals a
                INNER JOIN LATERAL (
                    SELECT id, responsible_org_admin_id
                    FROM appeal_assignments
                    WHERE appeal_id = a.id
                    ORDER BY assigned_at DESC, id DESC
                    LIMIT 1
                ) aa ON aa.responsible_org_admin_id = :admin_id
                WHERE a.id = :appeal_id
                  AND a.status <> 'pending'
                FOR UPDATE
            ");
            $appealStmt->execute([
                'admin_id' => $adminId,
                'appeal_id' => $appealId,
            ]);
            $appeal = $appealStmt->fetch();

            if (!$appeal) {
                $this->db->rollBack();
                return [];
            }

            $effectiveStatus = $nextStatus !== '' ? $nextStatus : (string)$appeal['status'];

            if ($nextStatus !== '') {
                $updateAppealStmt = $this->db->prepare('
                    UPDATE appeals
                    SET status = :status
                    WHERE id = :appeal_id
                ');
                $updateAppealStmt->execute([
                    'status' => $nextStatus,
                    'appeal_id' => $appealId,
                ]);

                $assignmentStatus = match ($nextStatus) {
                    'resolved' => 'resolved',
                    'rejected' => 'rejected',
                    default => 'assigned',
                };

                $updateAssignmentStmt = $this->db->prepare('
                    UPDATE appeal_assignments
                    SET status = :status
                    WHERE id = :assignment_id
                ');
                $updateAssignmentStmt->execute([
                    'status' => $assignmentStatus,
                    'assignment_id' => (int)$appeal['assignment_id'],
                ]);
            }

            if ($feedback !== '') {
                $insertMessageStmt = $this->db->prepare('
                    INSERT INTO appeal_chats (
                        appeal_id,
                        sender_org_admin_id,
                        message
                    ) VALUES (
                        :appeal_id,
                        :sender_org_admin_id,
                        :message
                    )
                ');
                $insertMessageStmt->execute([
                    'appeal_id' => $appealId,
                    'sender_org_admin_id' => $adminId,
                    'message' => $feedback,
                ]);
            }

            $this->db->commit();
            return ['id' => $appealId, 'status' => $effectiveStatus];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $error;
        }
    }

    public function findForAi(int $appealId, int $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT
                a.id,
                a.user_id,
                a.category_id,
                c.name AS category_name,
                a.subcategory_id,
                s.name AS subcategory_name,
                a.status,
                a.description,
                a.latitude,
                a.longitude,
                a.priority,
                a.created_at
            FROM appeals a
            INNER JOIN categories c ON c.id = a.category_id
            LEFT JOIN subcategories s ON s.id = a.subcategory_id
            WHERE a.id = :appeal_id
              AND a.user_id = :user_id
            LIMIT 1
        ');
        $stmt->execute([
            'appeal_id' => $appealId,
            'user_id' => $userId,
        ]);

        $appeal = $stmt->fetch();
        return $appeal ?: null;
    }

    public function addSystemMessage(int $appealId, string $message): void
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

    public function updateAfterAi(int $appealId, string $status, int $priority): array
    {
        $stmt = $this->db->prepare('
            UPDATE appeals
            SET status = :status,
                priority = :priority
            WHERE id = :appeal_id
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
            'appeal_id' => $appealId,
            'status' => $status,
            'priority' => $priority,
        ]);

        return $stmt->fetch();
    }

    public function createAssignment(int $appealId, int $organizationId, int $filialId, int $adminId): array
    {
        $stmt = $this->db->prepare('
            INSERT INTO appeal_assignments (
                appeal_id,
                organization_id,
                filial_id,
                responsible_org_admin_id,
                assigned_by,
                status
            ) VALUES (
                :appeal_id,
                :organization_id,
                :filial_id,
                :responsible_org_admin_id,
                NULL,
                :status
            )
            RETURNING id, appeal_id, organization_id, filial_id, responsible_org_admin_id, assigned_at, status
        ');
        $stmt->execute([
            'appeal_id' => $appealId,
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'responsible_org_admin_id' => $adminId,
            'status' => 'assigned',
        ]);

        return $stmt->fetch();
    }

    public function begin(): void
    {
        $this->db->beginTransaction();
    }

    public function commit(): void
    {
        $this->db->commit();
    }

    public function rollBackIfActive(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }
}
