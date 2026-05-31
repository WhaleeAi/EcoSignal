<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;

final class ProfileRepository extends Repository
{
    public function userEmailExists(string $email, int $exceptId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM users WHERE id <> :id AND email = :email LIMIT 1');
        $stmt->execute(['email' => $email, 'id' => $exceptId]);

        return (bool)$stmt->fetch();
    }

    public function orgAdminLoginExists(string $login, int $exceptId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM org_admins WHERE id <> :id AND login = :login LIMIT 1');
        $stmt->execute(['login' => $login, 'id' => $exceptId]);

        return (bool)$stmt->fetch();
    }

    public function updateUser(int $id, array $fields, array $params): void
    {
        $params['id'] = $id;
        $stmt = $this->db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id');
        $stmt->execute($params);
    }

    public function updateOrgAdmin(int $id, array $fields, array $params): void
    {
        $this->ensureOrgAdminProfileColumns();
        $params['id'] = $id;
        $stmt = $this->db->prepare('UPDATE org_admins SET ' . implode(', ', $fields) . ' WHERE id = :id');
        $stmt->execute($params);
    }

    public function findUser(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id, email, first_name, last_name, about, score, role, created_at
            FROM users
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            return null;
        }

        $firstName = $user['first_name'] !== null ? (string)$user['first_name'] : '';
        $lastName = $user['last_name'] !== null ? (string)$user['last_name'] : '';
        $name = trim($firstName . ' ' . $lastName);

        return [
            'id' => (int)$user['id'],
            'email' => (string)$user['email'],
            'login' => (string)$user['email'],
            'first_name' => $firstName !== '' ? $firstName : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'about' => $user['about'] !== null ? (string)$user['about'] : null,
            'score' => (int)($user['score'] ?? 0),
            'name' => $name !== '' ? $name : (string)$user['email'],
            'role' => (string)$user['role'],
            'created_at' => (string)$user['created_at'],
            'auth_source' => 'users',
        ];
    }

    public function findOrgAdmin(int $id): ?array
    {
        $this->ensureOrgAdminProfileColumns();
        $stmt = $this->db->prepare('
            SELECT
                oa.id,
                oa.login,
                oa.role,
                oa.about,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                oa.organization_id,
                oa.filial_id,
                o.name AS organization_name,
                o.org_type AS organization_type,
                f.name AS filial_name,
                f.region AS filial_region
            FROM org_admins oa
            LEFT JOIN organizations o ON o.id = oa.organization_id
            LEFT JOIN filials f ON f.id = oa.filial_id
            WHERE oa.id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
        $admin = $stmt->fetch();

        if (!$admin) {
            return null;
        }

        return [
            'id' => (int)$admin['id'],
            'login' => (string)$admin['login'],
            'email' => str_contains((string)$admin['login'], '@') ? (string)$admin['login'] : null,
            'name' => (string)$admin['login'],
            'role' => (string)$admin['role'],
            'about' => $admin['about'] !== null ? (string)$admin['about'] : null,
            'is_active' => (bool)$admin['is_active'],
            'organization_id' => $admin['organization_id'] !== null ? (int)$admin['organization_id'] : null,
            'organization_name' => $admin['organization_name'] !== null ? (string)$admin['organization_name'] : null,
            'organization_type' => $admin['organization_type'] !== null ? (string)$admin['organization_type'] : null,
            'filial_id' => $admin['filial_id'] !== null ? (int)$admin['filial_id'] : null,
            'filial_name' => $admin['filial_name'] !== null ? (string)$admin['filial_name'] : null,
            'filial_region' => $admin['filial_region'] !== null ? (string)$admin['filial_region'] : null,
            'created_at' => (string)$admin['created_at'],
            'last_login_at' => $admin['last_login_at'] !== null ? (string)$admin['last_login_at'] : null,
            'auth_source' => 'org_admins',
        ];
    }

    private function ensureOrgAdminProfileColumns(): void
    {
        if (!$this->columnExists('org_admins', 'about')) {
            $this->db->exec('ALTER TABLE org_admins ADD COLUMN about TEXT');
        }
    }
}
