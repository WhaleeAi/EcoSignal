<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use Throwable;

final class LoginController extends Controller
{
    private AuthService $auth;

    public function __construct(AuthService $auth, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
    }

    public function handle(): void
    {
        $this->requireMethod('POST');
        $data = $this->request->json();

        $email = trim((string)($data['email'] ?? ''));
        $password = trim((string)($data['password'] ?? ''));

        if ($email === '' || $password === '') {
            $this->json(['message' => 'Введите email и пароль'], 422);
        }

        try {
            $this->json($this->auth->login($email, $password));
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
