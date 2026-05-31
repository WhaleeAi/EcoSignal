<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use Throwable;

final class MeController extends Controller
{
    private AuthService $auth;

    public function __construct(AuthService $auth, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
    }

    public function handle(): void
    {
        $this->requireMethod('GET');

        try {
            $this->json(['user' => $this->auth->requireAuth($this->request)]);
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json([
                'message' => 'Ошибка сервера',
                'error' => $error->getMessage(),
            ], 500);
        }
    }
}
