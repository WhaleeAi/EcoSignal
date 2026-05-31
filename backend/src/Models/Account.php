<?php

declare(strict_types=1);

namespace EcoSignal\Models;

abstract class Account implements Authenticatable
{
    public function __construct(protected array $data)
    {
    }

    public function id(): int
    {
        return (int)($this->data['id'] ?? 0);
    }

    public function role(): string
    {
        return (string)($this->data['role'] ?? '');
    }

    public function toArray(): array
    {
        return $this->data;
    }
}

