<?php

declare(strict_types=1);

namespace EcoSignal\Support;

final class Text
{
    public static function splitFullName(string $fullName): array
    {
        $fullName = trim(preg_replace('/\s+/', ' ', $fullName) ?? $fullName);

        if ($fullName === '') {
            return ['', ''];
        }

        $parts = explode(' ', $fullName, 2);
        return [$parts[0] ?? '', $parts[1] ?? ''];
    }

    public static function fullName(?string $firstName, ?string $lastName, ?string $fallback): string
    {
        $fullName = trim((string)$firstName . ' ' . (string)$lastName);
        return $fullName !== '' ? $fullName : (string)$fallback;
    }
}

