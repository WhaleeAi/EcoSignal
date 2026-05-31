<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use App\Services\CategoryService;
use Throwable;

final class CategoriesController extends Controller
{
    private AuthService $auth;
    private CategoryService $categories;

    public function __construct(AuthService $auth, CategoryService $categories, ?Request $request = null)
    {
        parent::__construct($request);
        $this->auth = $auth;
        $this->categories = $categories;
    }

    public function handle(): void
    {
        $this->requireMethod('GET');

        try {
            $this->auth->requireAuth($this->request);
            $this->json(['categories' => $this->categories->all()]);
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
