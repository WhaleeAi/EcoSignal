<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

$admin = requireAuth();

if (($admin['role'] ?? '') !== 'admin' || ($admin['auth_source'] ?? '') !== 'org_admins') {
    jsonResponse(['message' => 'Доступ только для агента'], 403);
}

$data = getJsonInput();
$appealId = (int)($data['appeal_id'] ?? 0);
$nextStatus = trim((string)($data['status'] ?? ''));
$feedback = trim((string)($data['feedback'] ?? ''));

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

$allowedStatuses = ['in_progress', 'resolved', 'rejected'];
if ($nextStatus !== '' && !in_array($nextStatus, $allowedStatuses, true)) {
    jsonResponse(['message' => 'Недопустимый статус заявки'], 422);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];
    $pdo->beginTransaction();

    $appealStmt = $pdo->prepare("
        SELECT
            a.id,
            a.status,
            aa.id AS assignment_id
        FROM appeals a
        INNER JOIN LATERAL (
            SELECT
                id,
                responsible_org_admin_id
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
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка не найдена или недоступна агенту'], 404);
    }

    if ($nextStatus === '' && $feedback === '') {
        $pdo->rollBack();
        jsonResponse(['message' => 'Нужно указать новый статус или текст обратной связи'], 422);
    }

    $effectiveStatus = $nextStatus !== '' ? $nextStatus : (string)$appeal['status'];

    if ($nextStatus !== '') {
        $updateAppealStmt = $pdo->prepare('
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

        $updateAssignmentStmt = $pdo->prepare('
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
        $insertMessageStmt = $pdo->prepare('
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

    $pdo->commit();

    jsonResponse([
        'message' => 'Изменения сохранены',
        'appeal' => [
            'id' => $appealId,
            'status' => $effectiveStatus,
        ],
    ]);
} catch (Throwable $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
