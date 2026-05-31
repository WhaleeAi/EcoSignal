<?php

declare(strict_types=1);

namespace EcoSignal\Repositories;

use EcoSignal\Core\SchemaInspector;
use PDO;

final class UserRepository
{
    private SchemaInspector $schema;

    public function __construct(private readonly PDO $pdo)
    {
        $this->schema = new SchemaInspector($pdo);
    }

    public function findUserById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, email, first_name, last_name, about, role, created_at FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            return null;
        }

        $user['auth_source'] = 'users';
        return $user;
    }

    public function findUserByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('
            SELECT id, email, password_hash, first_name, last_name, role, created_at
            FROM users
            WHERE email = :email
            LIMIT 1
        ');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function createUser(string $email, string $passwordHash, string $firstName, ?string $lastName, string $role): array
    {
        $stmt = $this->pdo->prepare('
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (:email, :password_hash, :first_name, :last_name, :role)
            RETURNING id, email, first_name, last_name, role, created_at
        ');
        $stmt->execute([
            'email' => $email,
            'password_hash' => $passwordHash,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'role' => $role,
        ]);

        return $stmt->fetch();
    }

    public function userEmailExists(string $email, int $exceptId = 0): bool
    {
        $stmt = $this->pdo->prepare('
            SELECT id
            FROM users
            WHERE email = :email
              AND (:id = 0 OR id <> :id)
            LIMIT 1
        ');
        $stmt->execute(['email' => $email, 'id' => $exceptId]);

        return (bool)$stmt->fetch();
    }

    public function findOrgAdminById(int $id): ?array
    {
        $hasFirstName = $this->schema->columnExists('org_admins', 'first_name');
        $hasLastName = $this->schema->columnExists('org_admins', 'last_name');
        $hasAbout = $this->schema->columnExists('org_admins', 'about');
        $hasEmail = $this->schema->columnExists('org_admins', 'email');

        $stmt = $this->pdo->prepare('
            SELECT
                oa.id,
                oa.organization_id,
                oa.filial_id,
                oa.login,
                oa.role,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                ' . ($hasFirstName ? 'oa.first_name' : 'NULL::varchar') . ' AS first_name,
                ' . ($hasLastName ? 'oa.last_name' : 'NULL::varchar') . ' AS last_name,
                ' . ($hasAbout ? 'oa.about' : 'NULL::text') . ' AS about,
                ' . ($hasEmail ? 'oa.email' : 'NULL::varchar') . ' AS email,
                o.name AS organization_name,
                o.org_type,
                f.name AS filial_name,
                f.region AS filial_region
            FROM org_admins oa
            INNER JOIN organizations o ON o.id = oa.organization_id
            LEFT JOIN filials f ON f.id = oa.filial_id
            WHERE oa.id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return $row ? $this->formatOrgAdmin($row) : null;
    }

    public function findOrgAdminByLogin(string $login): ?array
    {
        if (!$this->schema->tableExists('org_admins') || !$this->schema->tableExists('organizations')) {
            return null;
        }

        $hasFilials = $this->schema->tableExists('filials');
        $sql = '
            SELECT
                oa.id,
                oa.organization_id,
                oa.filial_id,
                oa.login,
                oa.password_hash,
                oa.role,
                oa.is_active,
                oa.created_at,
                oa.last_login_at,
                o.name AS organization_name,
                o.org_type,'
            . ($hasFilials ? '
                f.name AS filial_name,
                f.region AS filial_region' : '
                NULL::varchar AS filial_name,
                NULL::varchar AS filial_region')
            . '
            FROM org_admins oa
            INNER JOIN organizations o ON o.id = oa.organization_id '
            . ($hasFilials ? 'LEFT JOIN filials f ON f.id = oa.filial_id ' : '')
            . '
            WHERE oa.login = :login
            LIMIT 1
        ';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['login' => $login]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findSuperadminById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('
            SELECT id, login, full_name, role, is_active, created_at, last_login_at
            FROM superadmins
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return $row ? $this->formatSuperadmin($row) : null;
    }

    public function findSuperadminByLogin(string $login): ?array
    {
        if (!$this->schema->tableExists('superadmins')) {
            return null;
        }

        $stmt = $this->pdo->prepare('
            SELECT id, login, password_hash, full_name, role, is_active, created_at, last_login_at
            FROM superadmins
            WHERE login = :login
            LIMIT 1
        ');
        $stmt->execute(['login' => $login]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function touchLastLogin(string $table, int $id): void
    {
        $stmt = $this->pdo->prepare("UPDATE {$table} SET last_login_at = NOW() WHERE id = :id");
        $stmt->execute(['id' => $id]);
    }

    private function formatOrgAdmin(array $row): array
    {
        $firstName = $row['first_name'] !== null ? (string)$row['first_name'] : '';
        $lastName = $row['last_name'] !== null ? (string)$row['last_name'] : '';
        $fullName = trim($firstName . ' ' . $lastName);

        return [
            'id' => (int)$row['id'],
            'organization_id' => (int)$row['organization_id'],
            'organization_name' => (string)$row['organization_name'],
            'organization_type' => (string)$row['org_type'],
            'filial_id' => $row['filial_id'] !== null ? (int)$row['filial_id'] : null,
            'filial_name' => $row['filial_name'] !== null ? (string)$row['filial_name'] : null,
            'filial_region' => $row['filial_region'] !== null ? (string)$row['filial_region'] : null,
            'login' => (string)$row['login'],
            'email' => $row['email'] !== null ? (string)$row['email'] : (string)$row['login'],
            'first_name' => $firstName !== '' ? $firstName : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'about' => $row['about'] !== null ? (string)$row['about'] : null,
            'name' => $fullName !== '' ? $fullName : (string)$row['login'],
            'role' => (string)$row['role'],
            'is_active' => (bool)$row['is_active'],
            'created_at' => (string)$row['created_at'],
            'last_login_at' => $row['last_login_at'] !== null ? (string)$row['last_login_at'] : null,
            'auth_source' => 'org_admins',
        ];
    }

    private function formatSuperadmin(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'login' => (string)$row['login'],
            'email' => (string)$row['login'],
            'name' => trim((string)($row['full_name'] ?? '')) !== '' ? (string)$row['full_name'] : (string)$row['login'],
            'role' => (string)$row['role'],
            'is_active' => (bool)$row['is_active'],
            'created_at' => (string)$row['created_at'],
            'last_login_at' => $row['last_login_at'] !== null ? (string)$row['last_login_at'] : null,
            'auth_source' => 'superadmins',
        ];
    }
}
