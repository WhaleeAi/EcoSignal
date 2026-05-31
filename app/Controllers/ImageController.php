<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Http\Request;
use App\Core\Http\Response;
use App\Exceptions\HttpException;
use App\Services\ImageService;
use Throwable;

final class ImageController extends Controller
{
    private ImageService $images;

    public function __construct(ImageService $images, ?Request $request = null)
    {
        parent::__construct($request);
        $this->images = $images;
    }

    public function show(int $id): void
    {
        $this->requireMethod('GET');

        try {
            $image = $this->images->findBinary($id);
            header('Content-Type: ' . $image['content_type']);
            header('Content-Length: ' . strlen($image['data']));
            header('Content-Disposition: inline; filename="' . addcslashes($image['filename'], "\"\\") . '"');
            header('Cache-Control: public, max-age=86400');
            echo $image['data'];
        } catch (HttpException $error) {
            Response::json(['message' => $error->getMessage()], $error->statusCode());
        } catch (Throwable $error) {
            Response::json([
                'message' => 'Ошибка сервера',
                'error' => $error->getMessage(),
            ], 500);
        }
    }

    public function handle(): void
    {
        $this->show((int)($_GET['id'] ?? 0));
    }
}
