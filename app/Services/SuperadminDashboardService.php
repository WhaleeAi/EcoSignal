<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\SuperadminDashboardRepository;

final class SuperadminDashboardService
{
    private SuperadminDashboardRepository $dashboard;
    private AccessService $access;

    public function __construct(SuperadminDashboardRepository $dashboard, AccessService $access)
    {
        $this->dashboard = $dashboard;
        $this->access = $access;
    }

    public function payload(array $superadmin): array
    {
        $this->access->requireSuperadmin($superadmin);
        return $this->dashboard->payload($superadmin);
    }

    public function saveAdmin(array $superadmin, array $data): array
    {
        $this->access->requireSuperadmin($superadmin);

        $action = (string)($data['action'] ?? 'save_admin');
        if ($action !== 'save_admin') {
            throw new HttpException('Неизвестное действие', 422);
        }

        $adminId = (int)($data['id'] ?? 0);
        $login = trim((string)($data['login'] ?? ''));
        $password = trim((string)($data['password'] ?? ''));
        $organizationId = (int)($data['organization_id'] ?? 0);
        $filialId = (int)($data['filial_id'] ?? 0);
        $isActive = (bool)($data['is_active'] ?? true);

        if ($login === '') {
            throw new HttpException('Укажите логин агента', 422);
        }

        if ($organizationId <= 0) {
            throw new HttpException('Выберите орган', 422);
        }

        if ($filialId <= 0) {
            throw new HttpException('Выберите филиал', 422);
        }

        if ($password !== '' && mb_strlen($password) < 6) {
            throw new HttpException('Пароль должен быть не короче 6 символов', 422);
        }

        if ($adminId <= 0 && $password === '') {
            throw new HttpException('Укажите пароль для нового агента', 422);
        }

        if (!$this->dashboard->organizationExists($organizationId)) {
            throw new HttpException('Орган не найден', 422);
        }

        if (!$this->dashboard->filialBelongsToOrganization($organizationId, $filialId)) {
            throw new HttpException('Филиал не принадлежит выбранному органу', 422);
        }

        if ($this->dashboard->loginTakenByOrgAdmin($login, $adminId)) {
            throw new HttpException('Агент с таким логином уже существует', 409);
        }

        if ($adminId > 0 && !$this->dashboard->adminExists($adminId)) {
            throw new HttpException('Агент не найден', 404);
        }

        $this->dashboard->saveAdmin($adminId, $login, $password, $organizationId, $filialId, $isActive);

        return [
            'message' => 'Настройки агента сохранены',
            ...$this->dashboard->payload($superadmin),
        ];
    }
}
