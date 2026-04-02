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

$data = getJsonInput();
$appealId = (int)($data['appeal_id'] ?? 0);
$priority = (int)($data['priority'] ?? -1);
$agencyName = trim((string)($data['agency_name'] ?? ''));

if ($appealId <= 0) {
    jsonResponse(['message' => 'Некорректный ID заявки'], 422);
}

if ($priority < 0 || $priority > 5) {
    jsonResponse(['message' => 'Приоритет должен быть от 0 до 5'], 422);
}

try {
    $pdo = getPDO();
    $adminId = (int)$admin['id'];

    $updateStmt = $pdo->prepare("
        UPDATE appeals
        SET priority = :priority
        WHERE id = :appeal_id
          AND assigned_admin_id = :admin_id
          AND status = 'pending'
        RETURNING id, priority, assigned_admin_id, status
    ");
    $updateStmt->execute([
        'priority' => $priority,
        'appeal_id' => $appealId,
        'admin_id' => $adminId,
    ]);

    $updatedAppeal = $updateStmt->fetch();

    if (!$updatedAppeal) {
        jsonResponse(['message' => 'Заявка не найдена или недоступна для изменения'], 404);
    }

    jsonResponse([
        'message' => 'Приоритет обновлён. Назначение в надзорный орган пока работает как заглушка.',
        'appeal' => [
            'id' => (int)$updatedAppeal['id'],
            'priority' => (int)$updatedAppeal['priority'],
            'assigned_admin_id' => (int)$updatedAppeal['assigned_admin_id'],
            'status' => (string)$updatedAppeal['status'],
            'agency_name' => $agencyName,
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'message' => 'Ошибка сервера',
        'error' => $e->getMessage(),
    ], 500);
}

