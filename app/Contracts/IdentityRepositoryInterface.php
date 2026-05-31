<?php

declare(strict_types=1);

namespace App\Contracts;

interface IdentityRepositoryInterface extends IdentityProviderInterface
{
    public function findActiveIdentity(int $id): ?array;
}
