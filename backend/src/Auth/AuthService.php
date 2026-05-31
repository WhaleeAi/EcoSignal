<?php

declare(strict_types=1);

namespace EcoSignal\Auth;

use EcoSignal\Core\HttpException;
use EcoSignal\Core\Request;
use EcoSignal\Models\Authenticatable;
use EcoSignal\Models\OrgAdminAccount;
use EcoSignal\Models\SuperadminAccount;
use EcoSignal\Models\UserAccount;
use EcoSignal\Repositories\UserRepository;
use Throwable;

final class AuthService
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly UserRepository $users
    ) {
    }

    public function requireAuth(?Request $request = null): Authenticatable
    {
        $request ??= new Request();
        $token = $request->bearerToken();

        if (!$token) {
            throw new HttpException('Токен не передан', 401);
        }

        try {
            $decoded = $this->jwt->decode($token);
            $subjectId = (int)($decoded->sub ?? 0);
            $authSource = (string)($decoded->auth_source ?? 'users');

            if ($subjectId <= 0 || !in_array($authSource, ['users', 'org_admins', 'superadmins'], true)) {
                throw new HttpException('Некорректный токен', 401);
            }

            return match ($authSource) {
                'org_admins' => $this->requireOrgAdmin($subjectId),
                'superadmins' => $this->requireSuperadmin($subjectId),
                default => $this->requireUser($subjectId),
            };
        } catch (HttpException $e) {
            throw $e;
        } catch (Throwable) {
            throw new HttpException('Недействительный или просроченный токен', 401);
        }
    }

    public function requireRole(string $role, string $authSource, ?Request $request = null): Authenticatable
    {
        $account = $this->requireAuth($request);
        if ($account->role() !== $role || $account->authSource() !== $authSource) {
            throw new HttpException('Доступ запрещен', 403);
        }

        return $account;
    }

    private function requireUser(int $id): Authenticatable
    {
        $user = $this->users->findUserById($id);
        if (!$user) {
            throw new HttpException('Пользователь не найден', 401);
        }

        return new UserAccount($user);
    }

    private function requireOrgAdmin(int $id): Authenticatable
    {
        $admin = $this->users->findOrgAdminById($id);
        if (!$admin || !(bool)($admin['is_active'] ?? true)) {
            throw new HttpException('Пользователь не найден', 401);
        }

        return new OrgAdminAccount($admin);
    }

    private function requireSuperadmin(int $id): Authenticatable
    {
        $superadmin = $this->users->findSuperadminById($id);
        if (!$superadmin || !(bool)($superadmin['is_active'] ?? true)) {
            throw new HttpException('Пользователь не найден', 401);
        }

        return new SuperadminAccount($superadmin);
    }
}
