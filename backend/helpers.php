<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/config.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function getBearerToken(): ?string
{
    $headers = getallheaders();

    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if (!$authHeader) {
        return null;
    }

    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }

    return null;
}

function createJwtToken(array $identity, string $authSource = 'users'): string
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

function decodeJwtToken(string $token): object
{
    return JWT::decode($token, new Key(JWT_SECRET, JWT_ALGO));
}

function splitFullName(string $fullName): array
{
    $fullName = trim(preg_replace('/\s+/', ' ', $fullName));

    if ($fullName === '') {
        return ['', ''];
    }

    $parts = explode(' ', $fullName, 2);

    $firstName = $parts[0] ?? '';
    $lastName = $parts[1] ?? '';

    return [$firstName, $lastName];
}

function allowCors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
