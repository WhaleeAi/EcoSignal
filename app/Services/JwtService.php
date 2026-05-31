<?php

declare(strict_types=1);

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use InvalidArgumentException;

final class JwtService
{
    public function create(array $identity, string $authSource = 'users'): string
    {
        $issuedAt = time();
        $expiresAt = $issuedAt + JWT_EXPIRE_SECONDS;

        $subjectId = (int)($identity['id'] ?? 0);
        if ($subjectId <= 0) {
            throw new InvalidArgumentException('Identity id is required for JWT creation');
        }

        $role = (string)($identity['role'] ?? '');
        if ($role === '') {
            throw new InvalidArgumentException('Identity role is required for JWT creation');
        }

        $email = (string)($identity['email'] ?? '');
        $login = (string)($identity['login'] ?? '');

        $payload = [
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'sub' => $subjectId,
            'role' => $role,
            'auth_source' => $authSource,
        ];

        if ($email !== '') {
            $payload['email'] = $email;
        }
        if ($login !== '') {
            $payload['login'] = $login;
        }

        return JWT::encode($payload, JWT_SECRET, JWT_ALGO);
    }

    public function decode(string $token): object
    {
        return JWT::decode($token, new Key(JWT_SECRET, JWT_ALGO));
    }
}
