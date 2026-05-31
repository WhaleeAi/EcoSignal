<?php

declare(strict_types=1);

namespace App\Services;

final class NameService
{
    public function splitFullName(string $fullName): array
    {
        $fullName = trim((string)preg_replace('/\s+/', ' ', $fullName));

        if ($fullName === '') {
            return ['', ''];
        }

        $parts = explode(' ', $fullName, 2);

        return [
            $parts[0] ?? '',
            $parts[1] ?? '',
        ];
    }
}
