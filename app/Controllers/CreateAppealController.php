<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AppealService;
use App\Services\AuthService;
use Throwable;

final class CreateAppealController extends Controller
{
    private AuthService $auth;
    private AppealService $appeals;

    public function __construct(AuthService $auth, AppealService $appeals, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->appeals = $appeals;
    }

    public function handle(): void
    {
        $this->requireMethod('POST');

        try {
            $user = $this->auth->requireAuth($this->request);
            $this->json($this->appeals->create(
                $user,
                $this->request->input(),
                $this->request->file('images'),
                $this->request->contentLength()
            ), 201);
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json([
                'message' => 'Ошибка создания заявки',
                'error' => $error->getMessage(),
            ], 500);
        }
    }
}
