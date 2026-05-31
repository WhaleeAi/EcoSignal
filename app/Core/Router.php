<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Http\Response;

final class Router
{
    private array $routes = [];

    public function get(string $path, callable $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    public function patch(string $path, callable $handler): void
    {
        $this->add('PATCH', $path, $handler);
    }

    public function add(string $method, string $path, callable $handler): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $this->normalizePath($path),
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $uri): void
    {
        $method = strtoupper($method);
        $path = $this->normalizePath(parse_url($uri, PHP_URL_PATH) ?: '/');

        foreach ($this->routes as $route) {
            $params = $this->match($route['path'], $path);
            if ($params === null) {
                continue;
            }

            if ($route['method'] !== $method) {
                Response::json(['message' => 'Метод не поддерживается'], 405);
            }

            ($route['handler'])(...$params);
            return;
        }

        Response::json(['message' => 'Маршрут не найден'], 404);
    }

    private function normalizePath(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '/' ? '/' : rtrim($path, '/');
    }

    private function match(string $routePath, string $requestPath): ?array
    {
        $routeSegments = explode('/', trim($routePath, '/'));
        $requestSegments = explode('/', trim($requestPath, '/'));

        if (count($routeSegments) !== count($requestSegments)) {
            return null;
        }

        $params = [];
        foreach ($routeSegments as $index => $segment) {
            if (preg_match('/^\{([a-zA-Z_][a-zA-Z0-9_]*)}$/', $segment)) {
                $params[] = urldecode($requestSegments[$index]);
                continue;
            }

            if ($segment !== $requestSegments[$index]) {
                return null;
            }
        }

        return $params;
    }
}
