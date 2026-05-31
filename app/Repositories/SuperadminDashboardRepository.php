<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;

final class SuperadminDashboardRepository extends Repository
{
    public function payload(array $user): array
    {
        $organizations = $this->db->query('SELECT id, name, org_type, created_at FROM organizations ORDER BY name ASC')->fetchAll();
        $filials = $this->db->query('
            SELECT id, organization_id, name, address, latitude, longitude, hotline_phone, email, region, is_active, created_at
            FROM filials
            ORDER BY organization_id ASC, name ASC
        ')->fetchAll();
        $admins = $this->db->query('
            SELECT
                oa.id,
                oa.organization_id,
                oa.filial_id,
                oa.login,
                oa.role,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                o.name AS organization_name,
                o.org_type,
                f.name AS filial_name,
                f.region AS filial_region,
                f.latitude AS filial_latitude,
                f.longitude AS filial_longitude
            FROM org_admins oa
            INNER JOIN organizations o ON o.id = oa.organization_id
            LEFT JOIN filials f ON f.id = oa.filial_id
            ORDER BY oa.is_active DESC, o.name ASC, f.name ASC, oa.login ASC
        ')->fetchAll();

        return [
            'user' => [
                'id' => (int)$user['id'],
                'login' => (string)$user['login'],
                'name' => (string)($user['name'] ?? $user['login']),
                'role' => (string)$user['role'],
                'auth_source' => (string)$user['auth_source'],
            ],
            'organizations' => array_map(static fn(array $row): array => [
                'id' => (int)$row['id'],
                'name' => (string)$row['name'],
                'org_type' => (string)$row['org_type'],
                'created_at' => (string)$row['created_at'],
            ], $organizations),
            'filials' => array_map(static fn(array $row): array => [
                'id' => (int)$row['id'],
                'organization_id' => (int)$row['organization_id'],
                'name' => (string)$row['name'],
                'address' => (string)$row['address'],
                'latitude' => (float)$row['latitude'],
                'longitude' => (float)$row['longitude'],
                'hotline_phone' => $row['hotline_phone'] !== null ? (string)$row['hotline_phone'] : null,
                'email' => $row['email'] !== null ? (string)$row['email'] : null,
                'region' => $row['region'] !== null ? (string)$row['region'] : null,
                'is_active' => (bool)$row['is_active'],
                'created_at' => (string)$row['created_at'],
            ], $filials),
            'admins' => array_map(static fn(array $row): array => [
                'id' => (int)$row['id'],
                'organization_id' => (int)$row['organization_id'],
                'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
                'login' => (string)$row['login'],
                'role' => (string)$row['role'],
                'is_active' => (bool)$row['is_active'],
                'created_at' => (string)$row['created_at'],
                'last_login_at' => $row['last_login_at'] !== null ? (string)$row['last_login_at'] : null,
                'organization_name' => (string)$row['organization_name'],
                'organization_type' => (string)$row['org_type'],
                'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
                'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
                'filial_latitude' => $row['filial_latitude'] !== null ? (float)$row['filial_latitude'] : null,
                'filial_longitude' => $row['filial_longitude'] !== null ? (float)$row['filial_longitude'] : null,
            ], $admins),
        ];
    }

    public function organizationExists(int $id): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM organizations WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        return (bool)$stmt->fetchColumn();
    }

    public function filialBelongsToOrganization(int $organizationId, int $filialId): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM filials WHERE id = :filial_id AND organization_id = :organization_id LIMIT 1');
        $stmt->execute(['organization_id' => $organizationId, 'filial_id' => $filialId]);
        return (bool)$stmt->fetchColumn();
    }

    public function loginTakenByOrgAdmin(string $login, int $exceptAdminId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM org_admins WHERE login = :login AND id <> :id LIMIT 1');
        $stmt->execute(['login' => $login, 'id' => $exceptAdminId]);
        return (bool)$stmt->fetch();
    }

    public function adminExists(int $id): bool
    {
        $stmt = $this->db->prepare("SELECT id FROM org_admins WHERE id = :id AND role = 'admin' LIMIT 1");
        $stmt->execute(['id' => $id]);
        return (bool)$stmt->fetch();
    }

    public function saveAdmin(int $adminId, string $login, string $password, int $organizationId, int $filialId, bool $isActive): void
    {
        if ($adminId > 0) {
            $fields = ['organization_id = :organization_id', 'filial_id = :filial_id', 'login = :login', 'role = :role', 'is_active = :is_active'];
            $params = ['id' => $adminId, 'organization_id' => $organizationId, 'filial_id' => $filialId, 'login' => $login, 'role' => 'admin', 'is_active' => $isActive ? 'true' : 'false'];
            if ($password !== '') {
                $fields[] = 'password_hash = :password_hash';
                $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            }
            $stmt = $this->db->prepare('UPDATE org_admins SET ' . implode(', ', $fields) . ' WHERE id = :id');
            $stmt->execute($params);
            return;
        }

        $stmt = $this->db->prepare('
            INSERT INTO org_admins (organization_id, filial_id, login, password_hash, role, is_active)
            VALUES (:organization_id, :filial_id, :login, :password_hash, :role, :is_active)
        ');
        $stmt->execute([
            'organization_id' => $organizationId,
            'filial_id' => $filialId,
            'login' => $login,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => 'admin',
            'is_active' => $isActive ? 'true' : 'false',
        ]);
    }
}
