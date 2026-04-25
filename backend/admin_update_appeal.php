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

if (($admin['role'] ?? '') !== 'admin') {
    jsonResponse(['message' => 'Доступ только для администраторов'], 403);
}

function pickNextResponsibleOrgAdmin(PDO $pdo, int $organizationId, int $filialId): array
{
    $candidateStmt = $pdo->prepare('
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
        throw new RuntimeException('В выбранном филиале нет активных администраторов организации.');
    }

    if (count($candidates) === 1) {
        return $candidates[0];
    }

    $candidateIds = array_map(
        static fn(array $candidate): int => (int)$candidate['id'],
        $candidates
    );

    $placeholders = [];
    $params = [
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
    ];

    foreach ($candidateIds as $index => $candidateId) {
        $param = 'candidate_id_' . $index;
        $placeholders[] = ':' . $param;
        $params[$param] = $candidateId;
    }

    $lastAssignedStmt = $pdo->prepare('
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
        if ((int)$candidate['id'] !== $lastAssignedId) {
            continue;
        }

        $nextIndex = ($index + 1) % count($candidates);
        return $candidates[$nextIndex];
    }

    return $candidates[0];
}

$data = getJsonInput();
$appealId = (int)($data['appeal_id'] ?? 0);
$priority = (int)($data['priority'] ?? -1);
$organizationId = isset($data['organization_id']) && $data['organization_id'] !== ''
    ? (int)$data['organization_id']
    : 0;
$filialId = isset($data['filial_id']) && $data['filial_id'] !== ''
    ? (int)$data['filial_id']
    : 0;

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

if ($priority < 0 || $priority > 5) {
    jsonResponse(['message' => 'Приоритет должен быть от 0 до 5'], 422);
}

if (($organizationId > 0 && $filialId <= 0) || ($organizationId <= 0 && $filialId > 0)) {
    jsonResponse(['message' => 'Для назначения нужно выбрать и орган, и филиал'], 422);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];
    $shouldConfirmAppeal = $organizationId > 0 && $filialId > 0;
    $pdo->beginTransaction();

    $updateStmt = $pdo->prepare("
        UPDATE appeals
        SET
            priority = :priority,
            status = CASE
                WHEN CAST(:mark_confirmed AS boolean) THEN 'confirmed'
                ELSE status
            END
        WHERE id = :appeal_id
          AND assigned_admin_id = :admin_id
          AND status = 'pending'
        RETURNING id, priority, assigned_admin_id, status
    ");
    $updateStmt->execute([
        'priority' => $priority,
        'appeal_id' => $appealId,
        'admin_id' => $adminId,
        'mark_confirmed' => $shouldConfirmAppeal ? 'true' : 'false',
    ]);

    $updatedAppeal = $updateStmt->fetch();

    if (!$updatedAppeal) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Заявка не найдена или недоступна для изменения'], 404);
    }

    $assignmentPayload = null;

    if ($shouldConfirmAppeal) {
        $organizationStmt = $pdo->prepare('
            SELECT id, name
            FROM organizations
            WHERE id = :id
            LIMIT 1
        ');
        $organizationStmt->execute(['id' => $organizationId]);
        $organization = $organizationStmt->fetch();

        if (!$organization) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Выбранный надзорный орган не найден'], 422);
        }

        $filialStmt = $pdo->prepare('
            SELECT
                id,
                organization_id,
                name,
                region,
                is_active
            FROM filials
            WHERE id = :id
            LIMIT 1
        ');
        $filialStmt->execute(['id' => $filialId]);
        $filial = $filialStmt->fetch();

        if (!$filial) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Выбранный филиал не найден'], 422);
        }

        if ((int)$filial['organization_id'] !== $organizationId) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Филиал не принадлежит выбранному органу'], 422);
        }

        if (!(bool)$filial['is_active']) {
            $pdo->rollBack();
            jsonResponse(['message' => 'Выбранный филиал недоступен для назначения'], 422);
        }

        $responsibleOrgAdmin = pickNextResponsibleOrgAdmin($pdo, $organizationId, $filialId);

        $existingAssignmentStmt = $pdo->prepare('
            SELECT id
            FROM appeal_assignments
            WHERE appeal_id = :appeal_id
              AND status = :status
            ORDER BY assigned_at DESC, id DESC
            LIMIT 1
        ');
        $existingAssignmentStmt->execute([
            'appeal_id' => $appealId,
            'status' => 'assigned',
        ]);
        $existingAssignment = $existingAssignmentStmt->fetch();

        if ($existingAssignment) {
            $saveAssignmentStmt = $pdo->prepare('
                UPDATE appeal_assignments
                SET
                    organization_id = :organization_id,
                    filial_id = :filial_id,
                    responsible_org_admin_id = :responsible_org_admin_id,
                    assigned_by = :assigned_by,
                    assigned_at = CURRENT_TIMESTAMP,
                    status = :status
                WHERE id = :id
            ');
            $saveAssignmentStmt->execute([
                'organization_id' => $organizationId,
                'filial_id' => $filialId,
                'responsible_org_admin_id' => (int)$responsibleOrgAdmin['id'],
                'assigned_by' => $adminId,
                'status' => 'assigned',
                'id' => (int)$existingAssignment['id'],
            ]);
        } else {
            $saveAssignmentStmt = $pdo->prepare('
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
                    :assigned_by,
                    :status
                )
            ');
            $saveAssignmentStmt->execute([
                'appeal_id' => $appealId,
                'organization_id' => $organizationId,
                'filial_id' => $filialId,
                'responsible_org_admin_id' => (int)$responsibleOrgAdmin['id'],
                'assigned_by' => $adminId,
                'status' => 'assigned',
            ]);
        }

        $assignmentPayload = [
            'organization_id' => $organizationId,
            'organization_name' => (string)$organization['name'],
            'filial_id' => $filialId,
            'filial_name' => (string)$filial['name'],
            'filial_region' => $filial['region'] !== null ? (string)$filial['region'] : null,
            'responsible_org_admin_id' => (int)$responsibleOrgAdmin['id'],
            'responsible_org_admin_login' => (string)$responsibleOrgAdmin['login'],
            'status' => 'assigned',
        ];
    } else {
        $clearAssignmentStmt = $pdo->prepare('
            DELETE FROM appeal_assignments
            WHERE appeal_id = :appeal_id
              AND status = :status
        ');
        $clearAssignmentStmt->execute([
            'appeal_id' => $appealId,
            'status' => 'assigned',
        ]);
    }

    $pdo->commit();

    jsonResponse([
        'message' => $assignmentPayload
            ? 'Заявка подтверждена и назначена в филиал.'
            : 'Приоритет обновлён.',
        'appeal' => [
            'id' => (int)$updatedAppeal['id'],
            'priority' => (int)$updatedAppeal['priority'],
            'assigned_admin_id' => (int)$updatedAppeal['assigned_admin_id'],
            'status' => (string)$updatedAppeal['status'],
            'assignment' => $assignmentPayload,
        ],
    ]);
} catch (RuntimeException $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => $e->getMessage(),
    ], 422);
} catch (Throwable $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}
