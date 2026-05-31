<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use App\Services\ProfileService;
use Throwable;

final class ProfileController extends Controller
{
    private AuthService $auth;
    private ProfileService $profiles;

    public function __construct(AuthService $auth, ProfileService $profiles, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->profiles = $profiles;
    }

    public function handle(): void
    {
        $this->requireMethod('POST');

        try {
            $this->json($this->profiles->update(
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
