<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\RegistrationService;
use Throwable;

final class RegisterController extends Controller
{
    private RegistrationService $registration;

    public function __construct(RegistrationService $registration, ?Request $request = null)
    {
        parent::__construct($request);
        $this->registration = $registration;
    }

    public function handle(): void
    {
        $this->requireMethod('POST');

        try {
            $this->json($this->registration->register($this->request->json()), 201);
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json([
                'message' => 'Ошибка сервера',
                'error' => $error->getMessage(),
                'file' => $error->getFile(),
                'line' => $error->getLine(),
            ], 500);
        }
    }
}
