<?php

declare(strict_types=1);

require_once __DIR__ . '/load_env.php';

function envRequired(string $key): string
{
    $value = getenv($key);
    if (!is_string($value) || trim($value) === '') {
        throw new RuntimeException('Missing required environment variable: ' . $key);
    }

    return trim($value);
}

function envOptional(string $key, string $default): string
{
    $value = getenv($key);
    if (!is_string($value) || trim($value) === '') {
        return $default;
    }

    return trim($value);
}

function envInt(string $key, int $default): int
{
    $value = getenv($key);
    if (!is_string($value) || trim($value) === '') {
        return $default;
    }

    return (int)trim($value);
}

if (!defined('DB_HOST')) {
    define('DB_HOST', envRequired('DB_HOST'));
    define('DB_PORT', envRequired('DB_PORT'));
    define('DB_NAME', envRequired('DB_NAME'));
    define('DB_USER', envRequired('DB_USER'));
    define('DB_PASSWORD', envRequired('DB_PASSWORD'));

    define('JWT_SECRET', envRequired('JWT_SECRET'));
    define('JWT_ALGO', envOptional('JWT_ALGO', 'HS256'));
    define('OPENROUTER_API_KEY', envRequired('OPENROUTER_API_KEY'));
    define('OPENROUTER_MODEL', envOptional('OPENROUTER_MODEL', 'openrouter/free'));
    define('JWT_EXPIRE_SECONDS', envInt('JWT_EXPIRE_SECONDS', 3600 * 24));
}
