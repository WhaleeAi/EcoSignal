<?php

declare(strict_types=1);

namespace App\Contracts;

interface CategoryRepositoryInterface
{
    public function tree(): array;

    public function exists(int $categoryId): bool;

    public function subcategoryBelongsToCategory(int $subcategoryId, int $categoryId): bool;
}
