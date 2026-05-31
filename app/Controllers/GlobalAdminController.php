<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use App\Services\GlobalAdminService;
use Throwable;

final class GlobalAdminController extends Controller
{
    private AuthService $auth;
    private GlobalAdminService $service;

    public function __construct(AuthService $auth, GlobalAdminService $service, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->service = $service;
    }

    public function handle(): void
    {
        $this->dashboard();
    }

    public function dashboard(): void
    {
        $this->respond(fn(array $user): array => $this->service->dashboard($user));
    }

    public function appeals(): void
    {
        $this->respond(fn(array $user): array => $this->service->appeals($user));
    }

    public function audit(): void
    {
        $this->respond(fn(array $user): array => $this->service->audit($user));
    }

    public function export(): void
    {
        $this->respond(fn(array $user): array => $this->service->export($user));
    }

    private function respond(callable $callback): void
    {
        $this->requireMethod('GET');

        try {
            $this->json($callback($this->auth->requireAuth($this->request)));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }
}
