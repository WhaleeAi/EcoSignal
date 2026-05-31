<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Contracts\IdentityRepositoryInterface;
use App\Contracts\UserRepositoryInterface;
use App\Core\Repository;
use App\Models\User;

final class UserRepository extends Repository implements UserRepositoryInterface, IdentityRepositoryInterface
{
    public function authenticate(string $login, string $password): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id, email, password_hash, first_name, last_name, about, score, role, created_at
            FROM users
            WHERE email = :login
            LIMIT 1
        ');
        $stmt->execute(['login' => $login]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            return null;
        }

        $tokenIdentity = $user;
        unset($user['password_hash']);
        $user['auth_source'] = 'users';

        return [
            'auth_source' => 'users',
            'token_identity' => $tokenIdentity,
            'user' => $this->mapIdentity($user),
        ];
    }

    public function emailExists(string $email): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        return (bool)$stmt->fetch();
    }

    public function create(User $user, string $passwordHash): array
    {
        $stmt = $this->db->prepare('
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (:email, :password_hash, :first_name, :last_name, :role)
            RETURNING id, email, first_name, last_name, about, score, role, created_at
        ');
        $stmt->execute([
            'email' => $user->email(),
            'password_hash' => $passwordHash,
            'first_name' => $user->firstName(),
            'last_name' => $user->lastName(),
            'role' => $user->role(),
        ]);

        $created = $stmt->fetch();
        $created['auth_source'] = 'users';
        return $this->mapIdentity($created);
    }

    public function findActiveIdentity(int $id): ?array
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

        $user['auth_source'] = 'users';
        return $this->mapIdentity($user);
    }

    private function mapIdentity(array $user): array
    {
        $firstName = $user['first_name'] !== null ? (string)$user['first_name'] : '';
        $lastName = $user['last_name'] !== null ? (string)$user['last_name'] : '';
        $name = trim($firstName . ' ' . $lastName);

        return [
            'id' => (int)$user['id'],
            'email' => (string)$user['email'],
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
}
