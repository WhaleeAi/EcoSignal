<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

final class GlobalAdminService
{
    public function __construct(
        private readonly PDO $db,
        private readonly AccessService $access
    ) {
    }

    public function dashboard(array $user): array
    {
        $this->access->requireGlobalAdmin($user);
        $this->ensureAuditTable();

        return [
            'user' => $user,
            'metrics' => $this->metrics(),
            'statuses' => $this->rows('SELECT status, COUNT(*) AS total FROM appeals GROUP BY status ORDER BY total DESC'),
            'categories' => $this->rows("
                SELECT COALESCE(c.name, 'Uncategorized') AS name, COUNT(*) AS total
                FROM appeals a
                LEFT JOIN categories c ON c.id = a.category_id
                GROUP BY COALESCE(c.name, 'Uncategorized')
                ORDER BY total DESC
                LIMIT 8
            "),
            'dynamics' => $this->rows("
                SELECT created_at::date AS day, COUNT(*) AS total
                FROM appeals
                WHERE created_at >= NOW() - INTERVAL '14 days'
                GROUP BY created_at::date
                ORDER BY day ASC
            "),
            'problem_zones' => $this->rows('
                SELECT
                    ROUND(latitude::numeric, 2) AS latitude,
                    ROUND(longitude::numeric, 2) AS longitude,
                    COUNT(*) AS total,
                    MAX(created_at) AS last_created_at
                FROM appeals
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
                HAVING COUNT(*) > 1
                ORDER BY total DESC
                LIMIT 10
            '),
            'organizations' => $this->organizationLoad(),
            'agents' => $this->agentLoad(),
            'roles' => $this->roleSummary(),
            'system_admins' => $this->systemAdmins(),
            'users' => $this->users(),
            'ai' => $this->aiSummary(),
        ];
    }

    public function appeals(array $user): array
    {
        $this->access->requireGlobalAdmin($user);

        return [
            'appeals' => $this->rows("
                SELECT
                    a.id,
                    a.status,
                    a.priority,
                    a.description,
                    a.latitude,
                    a.longitude,
                    a.created_at,
                    u.email AS citizen_email,
                    COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS citizen_name,
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
            "),
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

    public function createSystemAdmin(array $user, array $data): array
    {
        $this->access->requireGlobalAdmin($user);

        $login = trim((string)($data['login'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $fullName = trim((string)($data['full_name'] ?? ''));
        $role = trim((string)($data['role'] ?? 'global_admin'));
        $password = trim((string)($data['password'] ?? ''));

        if ($login === '') {
            throw new \App\Exceptions\HttpException('Укажите логин', 422);
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \App\Exceptions\HttpException('Некорректный email', 422);
        }
        if (!in_array($role, ['superadmin', 'global_admin', 'ai_admin'], true)) {
            throw new \App\Exceptions\HttpException('Некорректная роль системного администратора', 422);
        }
        if (mb_strlen($password) < 6) {
            throw new \App\Exceptions\HttpException('Пароль должен быть не короче 6 символов', 422);
        }

        $stmt = $this->db->prepare('
            INSERT INTO system_admins (login, email, password_hash, full_name, role, is_active)
            VALUES (:login, :email, :password_hash, :full_name, :role, TRUE)
            RETURNING id
        ');

        try {
            $stmt->execute([
                'login' => $login,
                'email' => $email !== '' ? $email : null,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'full_name' => $fullName !== '' ? $fullName : null,
                'role' => $role,
            ]);
        } catch (\PDOException $error) {
            if ($error->getCode() === '23505') {
                throw new \App\Exceptions\HttpException('Системный администратор с таким логином или email уже существует', 409);
            }

            throw $error;
        }

        $createdId = (int)$stmt->fetchColumn();
        $this->auditAction($user, 'system_admin.create', 'system_admin', $createdId, ['login' => $login, 'role' => $role]);

        return ['message' => 'Системный администратор добавлен', ...$this->dashboard($user)];
    }

    public function deleteSystemAdmin(array $user, array $data): array
    {
        $this->access->requireGlobalAdmin($user);

        $adminId = (int)($data['id'] ?? 0);
        if ($adminId <= 0) {
            throw new \App\Exceptions\HttpException('Некорректный ID системного администратора', 422);
        }
        if ($adminId === (int)($user['id'] ?? 0)) {
            throw new \App\Exceptions\HttpException('Нельзя удалить собственную учетную запись', 422);
        }

        $stmt = $this->db->prepare('DELETE FROM system_admins WHERE id = :id RETURNING login, role');
        $stmt->execute(['id' => $adminId]);
        $deleted = $stmt->fetch();

        if (!$deleted) {
            throw new \App\Exceptions\HttpException('Системный администратор не найден', 404);
        }

        $this->auditAction($user, 'system_admin.delete', 'system_admin', $adminId, $deleted);

        return ['message' => 'Системный администратор удален', ...$this->dashboard($user)];
    }

    public function deleteUser(array $user, array $data): array
    {
        $this->access->requireGlobalAdmin($user);

        $userId = (int)($data['id'] ?? 0);
        $confirmCascade = (bool)($data['confirm_cascade'] ?? false);
        if ($userId <= 0) {
            throw new \App\Exceptions\HttpException('Некорректный ID пользователя', 422);
        }

        $appealsCount = $this->userAppealsCount($userId);
        if ($appealsCount > 0 && !$confirmCascade) {
            throw new \App\Exceptions\HttpException(
                'У пользователя есть заявки: ' . $appealsCount . '. Подтвердите удаление вместе с историей заявок.',
                409
            );
        }

        $stmt = $this->db->prepare('DELETE FROM users WHERE id = :id RETURNING email, role');
        $stmt->execute(['id' => $userId]);
        $deleted = $stmt->fetch();

        if (!$deleted) {
            throw new \App\Exceptions\HttpException('Пользователь не найден', 404);
        }

        $this->auditAction($user, 'user.delete', 'user', $userId, ['email' => $deleted['email'], 'role' => $deleted['role'], 'appeals_deleted' => $appealsCount]);

        return ['message' => 'Пользователь удален', ...$this->dashboard($user)];
    }

    private function metrics(): array
    {
        return [
            ['key' => 'total_appeals', 'value' => $this->count('appeals')],
            ['key' => 'today_appeals', 'value' => $this->scalar('SELECT COUNT(*) FROM appeals WHERE created_at >= CURRENT_DATE')],
            ['key' => 'pending_ai', 'value' => $this->scalar("SELECT COUNT(*) FROM appeals WHERE status = 'pending'")],
            ['key' => 'in_progress', 'value' => $this->scalar("SELECT COUNT(*) FROM appeals WHERE status = 'in_progress'")],
            ['key' => 'stale', 'value' => $this->staleAppealsCount()],
            ['key' => 'resolved_7d', 'value' => $this->scalar("SELECT COUNT(*) FROM appeals WHERE status = 'resolved' AND created_at >= NOW() - INTERVAL '7 days'")],
            ['key' => 'users', 'value' => $this->count('users')],
            ['key' => 'active_agents', 'value' => $this->scalar('SELECT COUNT(*) FROM org_admins WHERE is_active = TRUE')],
            ['key' => 'organizations', 'value' => $this->count('organizations')],
            ['key' => 'filials', 'value' => $this->count('filials')],
        ];
    }

    private function organizationLoad(): array
    {
        return $this->rows("
            SELECT
                o.name AS organization_name,
                f.name AS filial_name,
                COUNT(DISTINCT oa.id) AS agents_total,
                COUNT(DISTINCT aa.id) AS assigned_total,
                COUNT(DISTINCT aa.id) FILTER (WHERE a.status = 'in_progress') AS in_progress_total,
                COUNT(DISTINCT aa.id) FILTER (WHERE a.status = 'resolved') AS resolved_total,
                COUNT(DISTINCT aa.id) FILTER (WHERE a.status = 'rejected') AS rejected_total
            FROM organizations o
            LEFT JOIN filials f ON f.organization_id = o.id
            LEFT JOIN org_admins oa ON oa.organization_id = o.id AND oa.filial_id = f.id
            LEFT JOIN appeal_assignments aa ON aa.organization_id = o.id AND aa.filial_id = f.id
            LEFT JOIN appeals a ON a.id = aa.appeal_id
            GROUP BY o.name, f.name
            ORDER BY assigned_total DESC, o.name ASC, f.name ASC
            LIMIT 50
        ");
    }

    private function agentLoad(): array
    {
        return $this->rows("
            SELECT
                oa.login,
                oa.is_active,
                o.name AS organization_name,
                f.name AS filial_name,
                COUNT(aa.id) AS assigned_total,
                COUNT(aa.id) FILTER (WHERE a.status = 'in_progress') AS in_progress_total,
                COUNT(aa.id) FILTER (WHERE a.status = 'resolved') AS resolved_total,
                MAX(aa.assigned_at) AS last_assigned_at
            FROM org_admins oa
            LEFT JOIN organizations o ON o.id = oa.organization_id
            LEFT JOIN filials f ON f.id = oa.filial_id
            LEFT JOIN appeal_assignments aa ON aa.responsible_org_admin_id = oa.id
            LEFT JOIN appeals a ON a.id = aa.appeal_id
            WHERE oa.role = 'admin'
            GROUP BY oa.id, oa.login, oa.is_active, o.name, f.name
            ORDER BY assigned_total DESC, last_assigned_at DESC NULLS LAST
            LIMIT 50
        ");
    }

    private function roleSummary(): array
    {
        $rows = array_merge(
            $this->rows("
                SELECT
                    'users' AS source,
                    CASE WHEN role IN ('citizen', 'agency', 'user') THEN 'citizen' ELSE role END AS role,
                    COUNT(*) AS total,
                    COUNT(*) AS active_total
                FROM users
                GROUP BY CASE WHEN role IN ('citizen', 'agency', 'user') THEN 'citizen' ELSE role END
            "),
            $this->rows("
                SELECT 'org_admins' AS source, role, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active = TRUE) AS active_total
                FROM org_admins
                GROUP BY role
            "),
            $this->rows("
                SELECT 'system_admins' AS source, role, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active = TRUE) AS active_total
                FROM system_admins
                GROUP BY role
            ")
        );

        usort($rows, static fn(array $a, array $b): int => [$a['source'], $a['role']] <=> [$b['source'], $b['role']]);

        return $rows;
    }

    private function systemAdmins(): array
    {
        return $this->rows('
            SELECT id, login, email, full_name, role, is_active, created_at, last_login_at
            FROM system_admins
            ORDER BY role ASC, login ASC
        ');
    }

    private function users(): array
    {
        return $this->rows('
            SELECT
                u.id,
                u.email,
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, \' \', u.last_name)), \'\'), u.email) AS name,
                CASE WHEN u.role IN (\'citizen\', \'agency\', \'user\') THEN \'citizen\' ELSE u.role END AS role,
                u.created_at,
                COUNT(a.id) AS appeals_total,
                MAX(a.created_at) AS last_appeal_at
            FROM users u
            LEFT JOIN appeals a ON a.user_id = u.id
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.created_at
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT 200
        ');
    }

    private function aiSummary(): array
    {
        return [
            'metrics' => [
                ['key' => 'ai_runs', 'value' => $this->count('ai_moderation_runs')],
                ['key' => 'ai_failed', 'value' => $this->scalar("SELECT COUNT(*) FROM ai_moderation_runs WHERE status = 'failed'")],
                ['key' => 'ai_confirmed', 'value' => $this->scalar("SELECT COUNT(*) FROM ai_moderation_runs WHERE status = 'confirmed'")],
                ['key' => 'ai_rejected', 'value' => $this->scalar("SELECT COUNT(*) FROM ai_moderation_runs WHERE status = 'rejected'")],
            ],
            'statuses' => $this->rows('
                SELECT status, COUNT(*) AS total
                FROM ai_moderation_runs
                GROUP BY status
                ORDER BY total DESC
            '),
            'recent_runs' => $this->rows('
                SELECT appeal_id, status, model, confidence, decision_reason, error_message, finished_at, started_at
                FROM ai_moderation_runs
                ORDER BY started_at DESC, id DESC
                LIMIT 30
            '),
        ];
    }

    private function staleAppealsCount(): int
    {
        return $this->scalar("
            SELECT COUNT(*)
            FROM appeals
            WHERE status IN ('pending', 'confirmed', 'in_progress')
              AND created_at < NOW() - INTERVAL '7 days'
        ");
    }

    private function count(string $table): int
    {
        return (int)$this->db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
    }

    private function scalar(string $sql): int
    {
        return (int)$this->db->query($sql)->fetchColumn();
    }

    private function rows(string $sql): array
    {
        return $this->db->query($sql)->fetchAll();
    }

    private function userAppealsCount(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM appeals WHERE user_id = :id');
        $stmt->execute(['id' => $userId]);

        return (int)$stmt->fetchColumn();
    }

    private function auditAction(array $actor, string $action, string $entityType, int $entityId, array $details = []): void
    {
        $this->ensureAuditTable();

        $stmt = $this->db->prepare('
            INSERT INTO system_audit_logs (actor_source, actor_id, actor_role, action, entity_type, entity_id, details)
            VALUES (:actor_source, :actor_id, :actor_role, :action, :entity_type, :entity_id, CAST(:details AS jsonb))
        ');
        $stmt->execute([
            'actor_source' => (string)($actor['auth_source'] ?? 'system_admins'),
            'actor_id' => (int)($actor['id'] ?? 0) ?: null,
            'actor_role' => (string)($actor['role'] ?? 'global_admin'),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'details' => json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    private function ensureAuditTable(): void
    {
        $this->db->exec('
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
        ');
    }
}
