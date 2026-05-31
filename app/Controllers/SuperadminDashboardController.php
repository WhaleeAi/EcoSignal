<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use App\Services\SuperadminDashboardService;
use Throwable;

final class SuperadminDashboardController extends Controller
{
    private AuthService $auth;
    private SuperadminDashboardService $dashboard;

    public function __construct(AuthService $auth, SuperadminDashboardService $dashboard, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->dashboard = $dashboard;
    }

    public function handle(): void
    {
        try {
            $user = $this->auth->requireAuth($this->request);

            if ($this->request->method() === 'GET') {
                $this->json($this->dashboard->payload($user));
            }

            if ($this->request->method() === 'POST') {
                $this->json($this->dashboard->saveAdmin($user, $this->request->json()));
            }

            $this->json(['message' => 'Метод не поддерживается'], 405);
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }
}
