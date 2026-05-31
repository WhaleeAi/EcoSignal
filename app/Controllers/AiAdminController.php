<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AiAdminService;
use App\Services\AuthService;
use Throwable;

final class AiAdminController extends Controller
{
    private AuthService $auth;
    private AiAdminService $service;

    public function __construct(AuthService $auth, AiAdminService $service, ?Request $request = null)
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
        $this->respond('GET', fn(array $user): array => $this->service->dashboard($user));
    }

    public function review(): void
    {
        $this->respond('POST', fn(array $user): array => $this->service->review($user, $this->request->json()));
    }

    public function requeue(): void
    {
        $this->respond('POST', fn(array $user): array => $this->service->requeue($user, $this->request->json()));
    }

    public function settings(): void
    {
        $this->respond('POST', fn(array $user): array => $this->service->saveSettings($user, $this->request->json()));
    }

    private function respond(string $method, callable $callback): void
    {
        $this->requireMethod($method);

        try {
            $this->json($callback($this->auth->requireAuth($this->request)));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }
}
