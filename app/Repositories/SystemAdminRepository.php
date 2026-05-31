<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Contracts\IdentityRepositoryInterface;
use App\Core\Repository;
use App\Exceptions\HttpException;

final class SystemAdminRepository extends Repository implements IdentityRepositoryInterface
{
    public function authenticate(string $login, string $password): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id, login, email, password_hash, full_name, role, is_active, created_at, last_login_at
            FROM system_admins
            WHERE login = :login OR email = :login
            LIMIT 1
        ');
        $stmt->execute(['login' => $login]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($password, (string)$admin['password_hash'])) {
            return null;
        }

        if (!(bool)$admin['is_active']) {
            throw new HttpException('Учетная запись деактивирована', 403);
        }

        $this->updateLastLogin((int)$admin['id']);
        $tokenIdentity = ['id' => (int)$admin['id'], 'login' => (string)$admin['login'], 'role' => (string)$admin['role']];

        return [
            'auth_source' => 'system_admins',
            'token_identity' => $tokenIdentity,
            'user' => $this->mapIdentity($admin),
        ];
    }

    public function findActiveIdentity(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id, login, email, full_name, role, is_active, created_at, last_login_at
            FROM system_admins
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
        $admin = $stmt->fetch();

        if (!$admin || !(bool)$admin['is_active']) {
            return null;
        }

        return $this->mapIdentity($admin);
    }

    private function updateLastLogin(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE system_admins SET last_login_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    private function mapIdentity(array $admin): array
    {
        return [
            'id' => (int)$admin['id'],
            'login' => (string)$admin['login'],
            'email' => $admin['email'] !== null ? (string)$admin['email'] : (string)$admin['login'],
            'name' => trim((string)($admin['full_name'] ?? '')) !== '' ? (string)$admin['full_name'] : (string)$admin['login'],
            'role' => (string)$admin['role'],
            'is_active' => (bool)$admin['is_active'],
            'created_at' => (string)$admin['created_at'],
            'last_login_at' => $admin['last_login_at'] !== null ? (string)$admin['last_login_at'] : null,
            'auth_source' => 'system_admins',
        ];
    }
}
