<?php

declare(strict_types=1);

namespace App\Contracts;

interface IdentityProviderInterface
{
    public function authenticate(string $login, string $password): ?array;
}
