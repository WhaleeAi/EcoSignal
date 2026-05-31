<?php

declare(strict_types=1);

namespace App\Models;

final class Appeal
{
    private int $userId;
    private int $categoryId;
    private ?int $subcategoryId;
    private string $description;
    private float $latitude;
    private float $longitude;

    public function __construct(
        int $userId,
        int $categoryId,
        ?int $subcategoryId,
        string $description,
        float $latitude,
        float $longitude
    ) {
        $this->userId = $userId;
        $this->categoryId = $categoryId;
        $this->subcategoryId = $subcategoryId;
        $this->description = $description;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
    }

    public function userId(): int
    {
        return $this->userId;
    }

    public function categoryId(): int
    {
        return $this->categoryId;
    }

    public function subcategoryId(): ?int
    {
        return $this->subcategoryId;
    }

    public function description(): string
    {
        return $this->description;
    }

    public function latitude(): float
    {
        return $this->latitude;
    }

    public function longitude(): float
    {
        return $this->longitude;
    }
}
