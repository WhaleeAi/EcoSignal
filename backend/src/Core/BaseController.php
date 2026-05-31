<?php

declare(strict_types=1);

namespace EcoSignal\Core;

use Throwable;

abstract class BaseController
{
    protected Request $request;

    public function __construct()
    {
        $this->request = new Request();
    }

    protected function only(string $method): void
    {
        if ($this->request->method() !== strtoupper($method)) {
            throw new HttpException('Метод не поддерживается', 405);
        }
    }

    protected function json(array $data, int $status = 200): void
    {
        Response::json($data, $status);
    }

    protected function run(callable $handler): void
    {
        Response::allowCors();

        try {
            $handler();
        } catch (HttpException $e) {
            Response::json($e->payload(), $e->statusCode());
        } catch (Throwable $e) {
            Response::json([
                'message' => 'Ошибка сервера',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

