<?php

declare(strict_types=1);

namespace App\Core\Http;

final class Request
{
    private string $method;
    private array $server;
    private array $headers;
    private array $post;
    private array $files;

    public function __construct(string $method, array $server, array $headers, array $post, array $files)
    {
        $this->method = strtoupper($method);
        $this->server = $server;
        $this->headers = $headers;
        $this->post = $post;
        $this->files = $files;
    }

    public static function fromGlobals(): self
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];

        return new self(
            (string)($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $_SERVER,
            is_array($headers) ? $headers : [],
            $_POST,
            $_FILES
        );
    }

    public function method(): string
    {
        return $this->method;
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

    public function input(): array
    {
        return $this->isJson() ? $this->json() : $this->post;
    }

    public function bearerToken(): ?string
    {
        $authHeader = $this->headers['Authorization'] ?? $this->headers['authorization'] ?? null;
        if (!$authHeader) {
            return null;
        }

        if (preg_match('/Bearer\s(\S+)/', (string)$authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }

    public function file(string $key): ?array
    {
        return $this->files[$key] ?? null;
    }

    public function contentLength(): int
    {
        return (int)($this->server['CONTENT_LENGTH'] ?? 0);
    }

    private function isJson(): bool
    {
        return stripos((string)($this->server['CONTENT_TYPE'] ?? ''), 'application/json') !== false;
    }
}
