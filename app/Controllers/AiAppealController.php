<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AiAppealProcessingService;
use App\Services\AuthService;
use Throwable;

final class AiAppealController extends Controller
{
    private AuthService $auth;
    private AiAppealProcessingService $ai;

    public function __construct(AuthService $auth, AiAppealProcessingService $ai, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->ai = $ai;
    }

    public function handle(): void
    {
        $this->requireMethod('POST');

        try {
            $this->json($this->ai->process(
                $this->auth->requireAuth($this->request),
                $this->request->json()
            ));
        } catch (HttpException $error) {
            $this->json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            $this->json(['message' => 'Проверка временно недоступна. Заявка остается в ожидании.'], 500);
        }
    }
}
