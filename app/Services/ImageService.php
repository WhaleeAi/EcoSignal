<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\ImageRepository;

final class ImageService
{
    private ImageRepository $images;

    public function __construct(ImageRepository $images)
    {
        $this->images = $images;
    }

    public function findBinary(int $id): array
    {
        if ($id <= 0) {
            throw new HttpException('Некорректный идентификатор изображения', 422);
        }

        $image = $this->images->findBinaryById($id);
        if ($image === null) {
            throw new HttpException('Изображение не найдено', 404);
        }

        return $image;
    }
}
