<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;

final class AccessService
{
    public function requireCitizen(array $user): void
    {
        if (($user['auth_source'] ?? '') !== 'users' || !in_array(($user['role'] ?? ''), ['citizen', 'user', 'agency'], true)) {
            throw new HttpException('Доступ только для пользователя', 403);
        }
    }

    public function requireAgent(array $user): void
    {
        if (($user['role'] ?? '') !== 'admin' || ($user['auth_source'] ?? '') !== 'org_admins') {
            throw new HttpException('Доступ только для органа надзора', 403);
        }
    }

    public function requireSuperadmin(array $user): void
    {
        if (($user['role'] ?? '') !== 'superadmin' || ($user['auth_source'] ?? '') !== 'system_admins') {
            throw new HttpException('Доступ только для суперадмина', 403);
        }
    }

    public function requireGlobalAdmin(array $user): void
    {
        if (($user['role'] ?? '') !== 'global_admin' || ($user['auth_source'] ?? '') !== 'system_admins') {
            throw new HttpException('Доступ только для глобального администратора', 403);
        }
    }

    public function requireAiAdmin(array $user): void
    {
        if (($user['role'] ?? '') !== 'ai_admin' || ($user['auth_source'] ?? '') !== 'system_admins') {
            throw new HttpException('Доступ только для администратора ИИ', 403);
        }
    }
}
