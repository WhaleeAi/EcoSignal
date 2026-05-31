<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\AppealReadRepository;
use App\Repositories\ImageRepository;

final class AppealViewService
{
    private AppealReadRepository $appeals;
    private ImageRepository $images;
    private AccessService $access;

    public function __construct(AppealReadRepository $appeals, ImageRepository $images, AccessService $access)
    {
        $this->appeals = $appeals;
        $this->images = $images;
        $this->access = $access;
    }

    public function publicMap(): array
    {
        $rows = $this->appeals->publicMapRows();
        $imageMap = $this->images->findUrlsByAppealIds($this->ids($rows), 3, false);

        return ['appeals' => array_map(fn(array $row): array => $this->mapPublicAppeal($row, $imageMap), $rows)];
    }

    public function agentDashboard(array $admin): array
    {
        $this->access->requireAgent($admin);
        $adminId = (int)$admin['id'];
        $rows = $this->appeals->agentDashboardRows($adminId);
        $imageMap = $this->images->findUrlsByAppealIds($this->ids($rows), 3, true);
        $chartRows = $this->appeals->agentChartRows($adminId);

        return [
            'user' => $this->agentUserPayload($admin),
            'chart' => array_map(static fn(array $row): array => [
                'date' => (string)$row['chart_date'],
                'total' => (int)$row['total'],
            ], $chartRows),
            'appeals' => array_map(fn(array $row): array => $this->mapAgentAppeal($row, $imageMap, true), $rows),
        ];
    }

    public function agentList(array $admin): array
    {
        $this->access->requireAgent($admin);
        $rows = $this->appeals->agentRows((int)$admin['id']);
        $imageMap = $this->images->findUrlsByAppealIds($this->ids($rows), 3, false);

        return [
            'user' => $this->agentUserPayload($admin),
            'appeals' => array_map(fn(array $row): array => $this->mapAgentAppeal($row, $imageMap, false), $rows),
        ];
    }

    public function citizenDetail(array $user, int $appealId): array
    {
        $this->access->requireCitizen($user);
        if ($appealId <= 0) {
            throw new HttpException('Некорректный ID заявки', 422);
        }

        $this->appeals->begin();
        try {
            $row = $this->appeals->citizenDetail($appealId, (int)$user['id']);
            if (!$row) {
                $this->appeals->rollBackIfActive();
                throw new HttpException('Заявка не найдена', 404);
            }

            $this->appeals->markAgentMessagesRead($appealId);
            $images = $this->appeals->imagesForAppeal($appealId, 9, true);
            $messages = $this->formatMessages($this->appeals->chatMessages($appealId), (int)$user['id'], 'citizen');
            $this->appeals->commit();

            return [
                'appeal' => $this->mapCitizenDetail($row, $images),
                'chat' => $messages,
            ];
        } catch (HttpException $error) {
            throw $error;
        } catch (\Throwable $error) {
            $this->appeals->rollBackIfActive();
            throw $error;
        }
    }

    public function agentDetail(array $admin, int $appealId): array
    {
        $this->access->requireAgent($admin);
        if ($appealId <= 0) {
            throw new HttpException('Некорректный ID заявки', 422);
        }

        $adminId = (int)$admin['id'];
        $this->appeals->begin();
        try {
            $this->appeals->markCitizenMessagesRead($appealId);
            $row = $this->appeals->agentDetail($appealId, $adminId);
            if (!$row) {
                $this->appeals->rollBackIfActive();
                throw new HttpException('Заявка не найдена или недоступна агенту', 404);
            }

            $images = $this->appeals->imagesForAppeal($appealId, 3, false);
            $messages = $this->formatMessages($this->appeals->chatMessages($appealId), $adminId, 'agent');
            $this->appeals->commit();

            return [
                'appeal' => $this->mapAgentDetail($row, $images),
                'chat' => $messages,
            ];
        } catch (HttpException $error) {
            throw $error;
        } catch (\Throwable $error) {
            $this->appeals->rollBackIfActive();
            throw $error;
        }
    }

    public function addCitizenMessage(array $user, array $data): array
    {
        $this->access->requireCitizen($user);

        $appealId = (int)($data['appeal_id'] ?? 0);
        $message = trim((string)($data['message'] ?? ''));

        if ($appealId <= 0) {
            throw new HttpException('Некорректный ID заявки', 422);
        }

        if ($message === '') {
            throw new HttpException('Введите сообщение', 422);
        }

        if (!$this->appeals->userOwnsAppeal($appealId, (int)$user['id'])) {
            throw new HttpException('Заявка не найдена', 404);
        }

        if (!$this->appeals->chatAvailableForUser($appealId)) {
            throw new HttpException('Чат не доступен: ответственный по вашей заявке еще не назначен', 409);
        }

        $this->appeals->addCitizenMessage($appealId, (int)$user['id'], $message);

        return [
            'message' => 'Сообщение отправлено',
            'chat_message' => [
                'appeal_id' => $appealId,
            ],
        ];
    }

    public function updateByAgent(array $admin, array $data): array
    {
        $this->access->requireAgent($admin);

        $appealId = (int)($data['appeal_id'] ?? 0);
        $nextStatus = trim((string)($data['status'] ?? ''));
        $feedback = trim((string)($data['feedback'] ?? ''));

        if ($appealId <= 0) {
            throw new HttpException('Некорректный ID заявки', 422);
        }

        $allowedStatuses = ['in_progress', 'resolved', 'rejected'];
        if ($nextStatus !== '' && !in_array($nextStatus, $allowedStatuses, true)) {
            throw new HttpException('Недопустимый статус заявки', 422);
        }

        if ($nextStatus === '' && $feedback === '') {
            throw new HttpException('Нужно указать новый статус или текст обратной связи', 422);
        }

        $appeal = $this->appeals->updateByAgent($appealId, (int)$admin['id'], $nextStatus, $feedback);
        if (!$appeal) {
            throw new HttpException('Заявка не найдена или недоступна агенту', 404);
        }

        return [
            'message' => 'Изменения сохранены',
            'appeal' => $appeal,
        ];
    }

    private function ids(array $rows): array
    {
        return array_map(static fn(array $row): int => (int)$row['appeal_id'], $rows);
    }

    private function fullName(?string $firstName, ?string $lastName, ?string $email): string
    {
        $name = trim((string)$firstName . ' ' . (string)$lastName);
        return $name !== '' ? $name : (string)$email;
    }

    private function mapPublicAppeal(array $row, array $imageMap): array
    {
        $appealId = (int)$row['appeal_id'];

        return [
            'id' => $appealId,
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'priority' => (int)$row['priority'],
            'ai_status_message' => $row['ai_status_message'] !== null ? (string)$row['ai_status_message'] : null,
            'latitude' => (float)$row['latitude'],
            'longitude' => (float)$row['longitude'],
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'user' => [
                'id' => (int)$row['user_id'],
                'name' => $this->fullName($row['first_name'] ?? null, $row['last_name'] ?? null, $row['email'] ?? null),
                'level' => (int)($row['score'] ?? 0),
            ],
            'images' => $imageMap[$appealId] ?? [],
        ];
    }

    private function mapAgentAppeal(array $row, array $imageMap, bool $includeCoordinates): array
    {
        $appealId = (int)$row['appeal_id'];
        $payload = [
            'id' => $appealId,
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'assigned_at' => (string)$row['assignment_assigned_at'],
            'priority' => (int)$row['priority'],
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'user' => [
                'id' => (int)$row['user_id'],
                'name' => $this->fullName($row['first_name'] ?? null, $row['last_name'] ?? null, $row['email'] ?? null),
                'level' => (int)($row['score'] ?? 0),
                'email' => (string)$row['email'],
            ],
            'images' => $imageMap[$appealId] ?? [],
        ];

        if ($includeCoordinates) {
            $payload['latitude'] = $row['latitude'] !== null ? (float)$row['latitude'] : null;
            $payload['longitude'] = $row['longitude'] !== null ? (float)$row['longitude'] : null;
        }

        return $payload;
    }

    private function mapCitizenDetail(array $row, array $images): array
    {
        return [
            'id' => (int)$row['appeal_id'],
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'priority' => (int)$row['priority'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'images' => $images,
            'assignment' => $row['assignment_id'] !== null ? [
                'id' => (int)$row['assignment_id'],
                'organization_id' => $row['organization_id'] !== null ? (int)$row['organization_id'] : null,
                'organization_name' => $row['organization_name'] !== null ? (string)$row['organization_name'] : null,
                'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
                'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
                'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
                'responsible_org_admin_id' => $row['responsible_org_admin_id'] !== null ? (int)$row['responsible_org_admin_id'] : null,
                'responsible_org_admin_login' => $row['responsible_org_admin_login'] !== null ? (string)$row['responsible_org_admin_login'] : null,
                'status' => $row['assignment_status'] !== null ? (string)$row['assignment_status'] : null,
                'assigned_at' => $row['assigned_at'] !== null ? (string)$row['assigned_at'] : null,
            ] : null,
        ];
    }

    private function mapAgentDetail(array $row, array $images): array
    {
        return [
            'id' => (int)$row['appeal_id'],
            'status' => (string)$row['status'],
            'description' => (string)$row['description'],
            'created_at' => (string)$row['created_at'],
            'assigned_at' => (string)$row['assigned_at'],
            'priority' => (int)$row['priority'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'category' => (string)$row['category_name'],
            'subcategory' => (string)($row['subcategory_name'] ?? 'Без подкатегории'),
            'user' => [
                'id' => (int)$row['user_id'],
                'name' => $this->fullName($row['first_name'] ?? null, $row['last_name'] ?? null, $row['email'] ?? null),
                'level' => (int)($row['score'] ?? 0),
                'email' => (string)$row['email'],
            ],
            'images' => $images,
            'assignment' => [
                'id' => (int)$row['assignment_id'],
                'organization_id' => (int)$row['organization_id'],
                'organization_name' => (string)$row['organization_name'],
                'filial_id' => (int)$row['filial_id'],
                'filial_name' => (string)$row['filial_name'],
                'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
                'responsible_org_admin_id' => $row['responsible_org_admin_id'] !== null ? (int)$row['responsible_org_admin_id'] : null,
                'responsible_org_admin_login' => $row['responsible_org_admin_login'] !== null ? (string)$row['responsible_org_admin_login'] : null,
                'status' => (string)$row['assignment_status'],
            ],
        ];
    }

    private function formatMessages(array $rows, int $viewerId, string $viewerType): array
    {
        return array_map(function (array $row) use ($viewerId, $viewerType): array {
            $isUser = $row['sender_user_id'] !== null;
            $isAgent = $row['sender_org_admin_id'] !== null;

            return [
                'id' => (int)$row['id'],
                'message' => (string)$row['message'],
                'created_at' => (string)$row['created_at'],
                'is_read' => (bool)$row['is_read'],
                'sender_type' => $isUser ? 'citizen' : ($isAgent ? 'agent' : 'system'),
                'sender_name' => match (true) {
                    $isUser => $this->fullName($row['user_first_name'] ?? null, $row['user_last_name'] ?? null, $row['user_email'] ?? null),
                    $isAgent => (string)($row['org_admin_login'] ?? 'Агент'),
                    default => 'EcoSignal AI',
                },
                'is_own' => $viewerType === 'citizen'
                    ? ($isUser && (int)$row['sender_user_id'] === $viewerId)
                    : ($isAgent && (int)$row['sender_org_admin_id'] === $viewerId),
            ];
        }, $rows);
    }

    private function agentUserPayload(array $admin): array
    {
        return [
            'id' => (int)$admin['id'],
            'login' => (string)$admin['login'],
            'name' => (string)$admin['login'],
            'role' => (string)$admin['role'],
            'organization_name' => (string)$admin['organization_name'],
            'organization_type' => (string)$admin['organization_type'],
            'filial_name' => $admin['filial_name'] !== null ? (string)$admin['filial_name'] : null,
            'filial_region' => $admin['filial_region'] !== null ? (string)$admin['filial_region'] : null,
            'auth_source' => (string)$admin['auth_source'],
        ];
    }
}
