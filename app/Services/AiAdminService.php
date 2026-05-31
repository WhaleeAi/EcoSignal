<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use PDO;

final class AiAdminService
{
    private PDO $db;
    private AccessService $access;
    private string $errorLogPath;

    public function __construct(PDO $db, AccessService $access, string $errorLogPath)
    {
        $this->db = $db;
        $this->access = $access;
        $this->errorLogPath = $errorLogPath;
    }

    public function dashboard(array $user): array
    {
        $this->access->requireAiAdmin($user);
        $this->ensureTables();

        return [
            'user' => $user,
            'metrics' => [
                'confirmed' => $this->countAppealsByStatus('confirmed'),
                'rejected' => $this->countAppealsByStatus('rejected'),
                'pending' => $this->countAppealsByStatus('pending'),
                'failed_runs' => $this->countRunsByStatus('failed'),
                'avg_processing_seconds' => $this->averageProcessingSeconds(),
                'stuck_pending' => $this->stuckPendingCount(),
            ],
            'runs_by_status' => $this->rows('
                SELECT status, COUNT(*) AS total
                FROM ai_moderation_runs
                GROUP BY status
                ORDER BY total DESC
            '),
            'recent_runs' => $this->rows('
                SELECT
                    r.id,
                    r.appeal_id,
                    r.status,
                    r.model,
                    r.confidence,
                    r.decision_reason,
                    r.error_message,
                    r.started_at,
                    r.finished_at,
                    a.status AS appeal_status
                FROM ai_moderation_runs r
                LEFT JOIN appeals a ON a.id = r.appeal_id
                ORDER BY r.started_at DESC, r.id DESC
                LIMIT 100
            '),
            'pending_appeals' => $this->pendingAppeals(),
            'settings' => $this->settings(),
            'error_log' => $this->tailErrorLog(),
        ];
    }

    public function requeue(array $user, array $data): array
    {
        $this->access->requireAiAdmin($user);
        $this->ensureTables();

        $appealId = (int)($data['appeal_id'] ?? 0);
        if ($appealId <= 0 || !$this->appealExists($appealId)) {
            throw new HttpException('Заявка не найдена', 404);
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO ai_moderation_runs (
                    appeal_id,
                    reviewed_by_system_admin_id,
                    status,
                    decision_reason,
                    request_payload
                )
                VALUES (
                    :appeal_id,
                    :admin_id,
                    'queued',
                    :reason,
                    CAST(:payload AS jsonb)
                )
            ");
            $stmt->execute([
                'appeal_id' => $appealId,
                'admin_id' => (int)$user['id'],
                'reason' => trim((string)($data['reason'] ?? 'Повторная отправка администратором ИИ')),
                'payload' => json_encode(['source' => 'ai_admin_requeue'], JSON_UNESCAPED_UNICODE),
            ]);

            $update = $this->db->prepare("UPDATE appeals SET status = 'pending', priority = GREATEST(priority, 1) WHERE id = :id");
            $update->execute(['id' => $appealId]);
            $this->audit($user, 'ai_requeue', 'appeal', $appealId, ['reason' => (string)($data['reason'] ?? '')]);
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }

        return ['message' => 'Заявка поставлена в очередь повторной AI-проверки', ...$this->dashboard($user)];
    }

    public function review(array $user, array $data): array
    {
        $this->access->requireAiAdmin($user);
        $this->ensureTables();

        $appealId = (int)($data['appeal_id'] ?? 0);
        $decision = (string)($data['decision'] ?? '');
        $reason = trim((string)($data['reason'] ?? ''));

        $status = match ($decision) {
            'confirm', 'confirmed' => 'confirmed',
            'reject', 'rejected' => 'rejected',
            'false_positive' => 'confirmed',
            default => '',
        };

        if ($appealId <= 0 || !$this->appealExists($appealId)) {
            throw new HttpException('Заявка не найдена', 404);
        }

        if ($status === '') {
            throw new HttpException('Некорректное решение проверки', 422);
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO ai_moderation_runs (
                    appeal_id,
                    reviewed_by_system_admin_id,
                    status,
                    decision_reason,
                    response_payload,
                    finished_at
                )
                VALUES (
                    :appeal_id,
                    :admin_id,
                    'overridden',
                    :reason,
                    CAST(:payload AS jsonb),
                    NOW()
                )
            ");
            $stmt->execute([
                'appeal_id' => $appealId,
                'admin_id' => (int)$user['id'],
                'reason' => $reason !== '' ? $reason : 'Ручное решение администратора ИИ',
                'payload' => json_encode(['decision' => $decision, 'appeal_status' => $status], JSON_UNESCAPED_UNICODE),
            ]);

            $update = $this->db->prepare('UPDATE appeals SET status = :status WHERE id = :id');
            $update->execute(['status' => $status, 'id' => $appealId]);
            $this->audit($user, 'ai_manual_review', 'appeal', $appealId, ['decision' => $decision, 'reason' => $reason]);
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }

        return ['message' => 'Ручное AI-решение сохранено', ...$this->dashboard($user)];
    }

    public function saveSettings(array $user, array $data): array
    {
        $this->access->requireAiAdmin($user);
        $this->ensureTables();

        $settings = $data['settings'] ?? [];
        if (!is_array($settings)) {
            throw new HttpException('Некорректные настройки', 422);
        }

        $stmt = $this->db->prepare('
            INSERT INTO ai_settings (key, value, description, updated_by_system_admin_id, updated_at)
            VALUES (:key, CAST(:value AS jsonb), :description, :admin_id, NOW())
            ON CONFLICT (key) DO UPDATE
            SET
                value = EXCLUDED.value,
                description = COALESCE(EXCLUDED.description, ai_settings.description),
                updated_by_system_admin_id = EXCLUDED.updated_by_system_admin_id,
                updated_at = NOW()
        ');

        foreach ($settings as $key => $value) {
            if (!is_string($key) || !preg_match('/^[a-zA-Z0-9_.-]{2,120}$/', $key)) {
                throw new HttpException('Некорректный ключ настройки', 422);
            }

            $stmt->execute([
                'key' => $key,
                'value' => json_encode($value, JSON_UNESCAPED_UNICODE),
                'description' => null,
                'admin_id' => (int)$user['id'],
            ]);
        }

        $this->audit($user, 'ai_settings_update', 'ai_settings', null, ['keys' => array_keys($settings)]);
        return ['message' => 'Настройки AI обновлены', ...$this->dashboard($user)];
    }

    private function pendingAppeals(): array
    {
        return $this->rows('
            SELECT
                a.id,
                a.status,
                a.priority,
                a.description,
                a.created_at,
                c.name AS category_name,
                s.name AS subcategory_name
            FROM appeals a
            LEFT JOIN categories c ON c.id = a.category_id
            LEFT JOIN subcategories s ON s.id = a.subcategory_id
            WHERE a.status IN (\'pending\', \'rejected\')
            ORDER BY a.created_at ASC, a.id ASC
            LIMIT 100
        ');
    }

    private function settings(): array
    {
        return $this->rows('
            SELECT key, value, description, updated_at
            FROM ai_settings
            ORDER BY key ASC
        ');
    }

    private function countAppealsByStatus(string $status): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM appeals WHERE status = :status');
        $stmt->execute(['status' => $status]);

        return (int)$stmt->fetchColumn();
    }

    private function countRunsByStatus(string $status): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM ai_moderation_runs WHERE status = :status');
        $stmt->execute(['status' => $status]);

        return (int)$stmt->fetchColumn();
    }

    private function averageProcessingSeconds(): int
    {
        $value = $this->db->query("
            SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)))), 0)
            FROM ai_moderation_runs
            WHERE finished_at IS NOT NULL
        ")->fetchColumn();

        return (int)$value;
    }

    private function stuckPendingCount(): int
    {
        $hours = (int)($this->db->query("
            SELECT COALESCE((value #>> '{}')::int, 24)
            FROM ai_settings
            WHERE key = 'pending_alert_hours'
        ")->fetchColumn() ?: 24);

        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM appeals
            WHERE status = 'pending'
              AND created_at < NOW() - (CAST(:hours AS text) || ' hours')::interval
        ");
        $stmt->execute(['hours' => max(1, $hours)]);

        return (int)$stmt->fetchColumn();
    }

    private function appealExists(int $appealId): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM appeals WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $appealId]);

        return (bool)$stmt->fetchColumn();
    }

    private function tailErrorLog(): array
    {
        if (!is_file($this->errorLogPath) || !is_readable($this->errorLogPath)) {
            return [];
        }

        $lines = file($this->errorLogPath, FILE_IGNORE_NEW_LINES);
        if (!is_array($lines)) {
            return [];
        }

        return array_slice($lines, -80);
    }

    private function rows(string $sql): array
    {
        return $this->db->query($sql)->fetchAll();
    }

    private function audit(array $user, string $action, string $entityType, ?int $entityId, array $details): void
    {
        $this->db->prepare('
            INSERT INTO system_audit_logs (actor_source, actor_id, actor_role, action, entity_type, entity_id, details)
            VALUES (:source, :id, :role, :action, :entity_type, :entity_id, CAST(:details AS jsonb))
        ')->execute([
            'source' => (string)($user['auth_source'] ?? 'system_admins'),
            'id' => (int)$user['id'],
            'role' => (string)$user['role'],
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'details' => json_encode($details, JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function ensureTables(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS ai_moderation_runs (
                id BIGSERIAL PRIMARY KEY,
                appeal_id INT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
                triggered_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
                reviewed_by_system_admin_id BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
                status VARCHAR(32) NOT NULL,
                model VARCHAR(120),
                confidence NUMERIC(5, 4),
                decision_reason TEXT,
                error_message TEXT,
                request_payload JSONB,
                response_payload JSONB,
                started_at TIMESTAMP NOT NULL DEFAULT NOW(),
                finished_at TIMESTAMP
            )
        ");
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS ai_settings (
                key VARCHAR(120) PRIMARY KEY,
                value JSONB NOT NULL,
                description TEXT,
                updated_by_system_admin_id BIGINT REFERENCES system_admins(id) ON DELETE SET NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        ");
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
        $this->db->exec("
            INSERT INTO ai_settings (key, value, description)
            VALUES
                ('confidence_threshold', '0.7000'::jsonb, 'Minimum confidence for automatic AI decisions'),
                ('auto_assign_enabled', 'true'::jsonb, 'Whether AI can automatically assign confirmed appeals'),
                ('pending_alert_hours', '24'::jsonb, 'Hours before pending appeal is considered stuck')
            ON CONFLICT (key) DO NOTHING
        ");
    }
}
