<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Http\Request;
use App\Core\Http\Response;

abstract class Controller
{
    protected Request $request;

    public function __construct(?Request $request = null)
    {
        $this->request = $request ?? Request::fromGlobals();
    }

    protected function requireMethod(string $method): void
    {
        if ($this->request->method() !== strtoupper($method)) {
            Response::json(['message' => 'Метод не поддерживается'], 405);
        }
    }

    protected function json(array $data, int $statusCode = 200): void
    {
        Response::json($data, $statusCode);
    }

    abstract public function handle(): void;
}
