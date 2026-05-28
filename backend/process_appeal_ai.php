<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/ai_moderation.php';

allowCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['message' => 'Метод не поддерживается'], 405);
}

@set_time_limit(120);

function insertAiSystemChatMessage(PDO $pdo, int $appealId, string $message): void
{
    $stmt = $pdo->prepare('
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

function fetchAppealForAi(PDO $pdo, int $appealId, int $userId): ?array
{
    $stmt = $pdo->prepare('
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

function fetchAppealImagesForAi(PDO $pdo, int $appealId): array
{
    $stmt = $pdo->prepare('
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

function getAssignmentLabel(PDO $pdo, int $organizationId, int $filialId): string
{
    $stmt = $pdo->prepare('
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

function getPublicAiErrorMessage(string $errorMessage): string
{
    $normalized = mb_strtolower($errorMessage);

    if (str_contains($normalized, 'base64')) {
        return 'Не удалось проверить фото. Попробуйте загрузить другое изображение.';
    }

    if (str_contains($normalized, 'rate-limited') || str_contains($normalized, '429')) {
        return 'Заявка принята и ожидает проверки.';
    }

    return 'Проверка временно недоступна. Заявка остается в ожидании.';
}

$user = requireAuth();
$input = getJsonInput();
$appealId = (int)($input['appeal_id'] ?? 0);

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный идентификатор заявки'], 422);
}

try {
    $pdo = getPDO();
    $appeal = fetchAppealForAi($pdo, $appealId, (int)$user['id']);

    if (!$appeal) {
        jsonResponse(['message' => 'Заявка не найдена'], 404);
    }

    if ((string)$appeal['status'] !== 'pending') {
        jsonResponse([
            'message' => 'Заявка уже обработана',
            'appeal' => $appeal,
            'ai_decision' => null,
        ]);
    }

    $preparedImages = fetchAppealImagesForAi($pdo, $appealId);
    $references = fetchAiModerationReferences($pdo);
    $appealForAi = [
        'category_id' => (int)$appeal['category_id'],
        'category_name' => (string)$appeal['category_name'],
        'subcategory_id' => $appeal['subcategory_id'] !== null ? (int)$appeal['subcategory_id'] : null,
        'subcategory_name' => $appeal['subcategory_name'] !== null ? (string)$appeal['subcategory_name'] : null,
        'description' => (string)$appeal['description'],
        'latitude' => (float)$appeal['latitude'],
        'longitude' => (float)$appeal['longitude'],
        'images_count' => count($preparedImages),
    ];

    try {
        $aiDecision = moderateAppealWithAi($appealForAi, $preparedImages, $references);
    } catch (Throwable $aiError) {
        $publicErrorMessage = getPublicAiErrorMessage($aiError->getMessage());

        insertAiSystemChatMessage(
            $pdo,
            $appealId,
            $publicErrorMessage
        );

        jsonResponse([
            'message' => $publicErrorMessage,
        ], 502);
    }

    if ($aiDecision['status'] === 'confirmed') {
        $organizationId = (int)($aiDecision['organization_id'] ?? 0);
        $filialId = (int)($aiDecision['filial_id'] ?? 0);

        if ($organizationId <= 0 || $filialId <= 0 || !validateAiAssignment($pdo, $organizationId, $filialId)) {
            $aiDecision['status'] = 'rejected';
            $aiDecision['organization_id'] = null;
            $aiDecision['filial_id'] = null;
            $aiDecision['priority'] = 0;
            $aiDecision['reason'] = 'AI выбрала недоступный орган или филиал.';
        }
    }

    $finalStatus = $aiDecision['status'] === 'confirmed' ? 'confirmed' : 'rejected';
    $finalPriority = $finalStatus === 'confirmed'
        ? max(1, min(5, (int)$aiDecision['priority']))
        : 0;
    $responsible = null;

    if ($finalStatus === 'confirmed') {
        try {
            $responsible = pickNextResponsibleOrgAdmin(
                $pdo,
                (int)$aiDecision['organization_id'],
                (int)$aiDecision['filial_id']
            );
        } catch (Throwable $responsibleError) {
            $finalStatus = 'rejected';
            $finalPriority = 0;
            $aiDecision['status'] = 'rejected';
            $aiDecision['organization_id'] = null;
            $aiDecision['filial_id'] = null;
            $aiDecision['priority'] = 0;
            $aiDecision['reason'] = $responsibleError->getMessage();
        }
    }

    $pdo->beginTransaction();

    $updateAppealStmt = $pdo->prepare('
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
    $updateAppealStmt->execute([
        'appeal_id' => $appealId,
        'status' => $finalStatus,
        'priority' => $finalPriority,
    ]);
    $appeal = $updateAppealStmt->fetch();

    $assignment = null;
    $assignmentLabel = '';
    if ($finalStatus === 'confirmed') {
        $organizationId = (int)$aiDecision['organization_id'];
        $filialId = (int)$aiDecision['filial_id'];

        $assignmentStmt = $pdo->prepare('
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
        $assignmentStmt->execute([
            'appeal_id' => $appealId,
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'responsible_org_admin_id' => (int)$responsible['id'],
            'status' => 'assigned',
        ]);
        $assignment = $assignmentStmt->fetch();
        $assignmentLabel = getAssignmentLabel($pdo, $organizationId, $filialId);

        insertAiSystemChatMessage(
            $pdo,
            $appealId,
            'AI-проверка завершена: заявка принята и направлена в ' . $assignmentLabel . '. Причина: ' . $aiDecision['reason']
        );
    } else {
        insertAiSystemChatMessage(
            $pdo,
            $appealId,
            'AI-проверка завершена: заявка отклонена. Причина: ' . $aiDecision['reason']
        );
    }

    $pdo->commit();

    jsonResponse([
        'message' => $finalStatus === 'confirmed'
            ? 'Заявка принята AI и направлена в ' . $assignmentLabel . '.'
            : 'Заявка отклонена автоматической AI-проверкой.',
        'appeal' => $appeal,
        'assignment' => $assignment,
        'ai_decision' => $aiDecision,
    ]);
} catch (Throwable $e) {
    if (($pdo ?? null) instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'message' => 'Проверка временно недоступна. Заявка остается в ожидании.',
    ], 500);
}
