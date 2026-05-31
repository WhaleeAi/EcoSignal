<?php

declare(strict_types=1);

namespace EcoSignal\Models;

interface Authenticatable
{
    public function id(): int;

    public function role(): string;

    public function authSource(): string;

    public function toArray(): array;
}

