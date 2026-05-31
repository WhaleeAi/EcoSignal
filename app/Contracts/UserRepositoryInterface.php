<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Models\User;

interface UserRepositoryInterface
{
    public function emailExists(string $email): bool;

    public function create(User $user, string $passwordHash): array;

    public function findActiveIdentity(int $id): ?array;
}
