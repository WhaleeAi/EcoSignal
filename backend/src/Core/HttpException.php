<?php

declare(strict_types=1);

namespace EcoSignal\Core;

use RuntimeException;

class HttpException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $statusCode = 500,
        private readonly array $context = []
    ) {
        parent::__construct($message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function payload(): array
    {
        return ['message' => $this->getMessage(), ...$this->context];
    }
}

