<?php

declare(strict_types=1);

namespace EcoSignal\Core;

final class Request
{
    public function method(): string
    {
        return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    }

    public function contentType(): string
    {
        return (string)($_SERVER['CONTENT_TYPE'] ?? '');
    }

    public function json(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return [];
        }

        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public function postOrJson(): array
    {
        if (stripos($this->contentType(), 'application/json') !== false) {
            return $this->json();
        }

        return $_POST;
    }

    public function queryInt(string $key, int $default = 0): int
    {
        return (int)($_GET[$key] ?? $default);
    }

    public function bearerToken(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

        if (!is_string($authHeader) || $authHeader === '') {
            return null;
        }

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }
}

