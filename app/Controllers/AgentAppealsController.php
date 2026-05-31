<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AppealViewService;
use App\Services\AuthService;
use Throwable;

final class AgentAppealsController extends Controller
{
    private AuthService $auth;
    private AppealViewService $appeals;

    public function __construct(AuthService $auth, AppealViewService $appeals, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->appeals = $appeals;
    }

    public function handle(): void
    {
        $this->list();
    }

    public function list(): void
    {
        $this->requireMethod('GET');

        try {
            $this->json($this->appeals->agentList($this->auth->requireAuth($this->request)));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }

    public function details(int $id): void
    {
        $this->requireMethod('GET');

        try {
            $this->json($this->appeals->agentDetail($this->auth->requireAuth($this->request), $id));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }

    public function update(): void
    {
        $this->requireMethod('POST');

        try {
            $this->json($this->appeals->updateByAgent(
                $this->auth->requireAuth($this->request),
                $this->request->json()
            ));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }
}
