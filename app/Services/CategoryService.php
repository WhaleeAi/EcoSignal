<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\CategoryRepositoryInterface;

final class CategoryService
{
    private CategoryRepositoryInterface $categories;

    public function __construct(CategoryRepositoryInterface $categories)
    {
        $this->categories = $categories;
    }

    public function all(): array
    {
        return $this->categories->tree();
    }
}
