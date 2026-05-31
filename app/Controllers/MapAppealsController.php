<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AppealViewService;
use Throwable;

final class MapAppealsController extends Controller
{
    private AppealViewService $appeals;

    public function __construct(AppealViewService $appeals, ?Request $request = null)
    {
        parent::__construct($request);
        $this->appeals = $appeals;
    }

    public function handle(): void
    {
        $this->requireMethod('GET');

        try {
            $this->json($this->appeals->publicMap());
        } catch (Throwable $error) {
            $this->json(['message' => 'Ошибка сервера', 'error' => $error->getMessage()], 500);
        }
    }
}
