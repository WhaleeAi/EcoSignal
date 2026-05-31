<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Contracts\IdentityRepositoryInterface;
use App\Core\Repository;
use App\Exceptions\HttpException;

final class OrgAdminRepository extends Repository implements IdentityRepositoryInterface
{
    public function authenticate(string $login, string $password): ?array
    {
        $stmt = $this->db->prepare($this->identitySql('WHERE oa.login = :login'));
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
            'auth_source' => 'org_admins',
            'token_identity' => $tokenIdentity,
            'user' => $this->mapIdentity($admin),
        ];
    }

    public function findActiveIdentity(int $id): ?array
    {
        $stmt = $this->db->prepare($this->identitySql('WHERE oa.id = :id'));
        $stmt->execute(['id' => $id]);
        $admin = $stmt->fetch();

        if (!$admin || !(bool)$admin['is_active']) {
            return null;
        }

        return $this->mapIdentity($admin);
    }

    private function identitySql(string $where): string
    {
        return "
            SELECT
                oa.id,
                oa.organization_id,
                oa.filial_id,
                oa.login,
                oa.password_hash,
                oa.role,
                oa.about,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                o.name AS organization_name,
                o.org_type AS organization_type,
                f.name AS filial_name,
                f.region AS filial_region
            FROM org_admins oa
            INNER JOIN organizations o ON o.id = oa.organization_id
            LEFT JOIN filials f ON f.id = oa.filial_id
            {$where}
            LIMIT 1
        ";
    }

    private function updateLastLogin(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE org_admins SET last_login_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    private function mapIdentity(array $admin): array
    {
        return [
            'id' => (int)$admin['id'],
            'login' => (string)$admin['login'],
            'email' => (string)$admin['login'],
            'name' => (string)$admin['login'],
            'about' => $admin['about'] !== null ? (string)$admin['about'] : null,
            'role' => (string)$admin['role'],
            'organization_id' => (int)$admin['organization_id'],
            'organization_name' => (string)$admin['organization_name'],
            'organization_type' => (string)$admin['organization_type'],
            'filial_id' => $admin['filial_id'] !== null ? (int)$admin['filial_id'] : null,
            'filial_name' => $admin['filial_name'] !== null ? (string)$admin['filial_name'] : null,
            'filial_region' => $admin['filial_region'] !== null ? (string)$admin['filial_region'] : null,
            'is_active' => (bool)$admin['is_active'],
            'created_at' => (string)$admin['created_at'],
            'last_login_at' => $admin['last_login_at'] !== null ? (string)$admin['last_login_at'] : null,
            'auth_source' => 'org_admins',
        ];
    }
}
