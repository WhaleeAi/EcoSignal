<?php

declare(strict_types=1);

namespace App\Models;

final class Category
{
    private int $id;
    private string $name;
    private array $subcategories;

    public function __construct(int $id, string $name, array $subcategories = [])
    {
        $this->id = $id;
        $this->name = $name;
        $this->subcategories = $subcategories;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'subcategories' => $this->subcategories,
        ];
    }
}
