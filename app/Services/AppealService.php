<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\AppealRepositoryInterface;
use App\Contracts\CategoryRepositoryInterface;
use App\Exceptions\HttpException;
use App\Models\Appeal;

final class AppealService
{
    private AppealRepositoryInterface $appeals;
    private CategoryRepositoryInterface $categories;
    private UploadService $uploads;

    public function __construct(
        AppealRepositoryInterface $appeals,
        CategoryRepositoryInterface $categories,
        UploadService $uploads
    ) {
        $this->appeals = $appeals;
        $this->categories = $categories;
        $this->uploads = $uploads;
    }

    public function create(array $user, array $data, ?array $imagesField, int $contentLength): array
    {
        $this->uploads->validateRequestBodySize($contentLength);

        if (!in_array(($user['role'] ?? ''), ['citizen', 'agency', 'user'], true)) {
            throw new HttpException('Создавать заявки может только пользователь', 403);
        }

        $categoryId = (int)($data['category_id'] ?? 0);
        $subcategoryRaw = $data['subcategory_id'] ?? null;
        $subcategoryId = ($subcategoryRaw === null || $subcategoryRaw === '') ? null : (int)$subcategoryRaw;
        $description = trim((string)($data['description'] ?? ''));
        $latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
        $longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;

        if ($categoryId <= 0) {
            throw new HttpException('Выберите категорию', 422);
        }

        if ($description === '') {
            throw new HttpException('Добавьте описание проблемы', 422);
        }

        if ($latitude === null || $latitude < -90 || $latitude > 90) {
            throw new HttpException('Некорректная широта', 422);
        }

        if ($longitude === null || $longitude < -180 || $longitude > 180) {
            throw new HttpException('Некорректная долгота', 422);
        }

        if (!$this->categories->exists($categoryId)) {
            throw new HttpException('Категория не найдена', 422);
        }

        if ($subcategoryId !== null && !$this->categories->subcategoryBelongsToCategory($subcategoryId, $categoryId)) {
            throw new HttpException('Подкатегория не принадлежит выбранной категории', 422);
        }

        $preparedImages = $this->uploads->prepare($this->uploads->normalize($imagesField));
        $result = $this->appeals->createWithImages(
            new Appeal((int)$user['id'], $categoryId, $subcategoryId, $description, $latitude, $longitude),
            $preparedImages,
            'Заявка отправлена на автоматическую проверку. EcoSignal AI анализирует описание, категорию и прикрепленные фотографии.'
        );

        return [
            'message' => 'Заявка создана и отправлена на автоматическую AI-проверку.',
            'appeal' => $result['appeal'],
            'images' => $result['images'],
            'ai_processing_required' => true,
        ];
    }

    public function listForUser(array $user): array
    {
        return [
            'user' => [
                'id' => (int)$user['id'],
                'name' => trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? '')),
                'role' => (string)($user['role'] ?? ''),
            ],
            'appeals' => $this->appeals->findForUser((int)$user['id']),
        ];
    }
}
