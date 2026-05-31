<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Models\Appeal;

interface AppealRepositoryInterface
{
    public function createWithImages(Appeal $appeal, array $images, string $systemMessage): array;

    public function findForUser(int $userId): array;
}
