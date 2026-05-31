<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'EcoSignal\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $path = __DIR__ . '/src/' . str_replace('\\', DIRECTORY_SEPARATOR, $relativeClass) . '.php';

    if (is_readable($path)) {
        require_once $path;
    }
});

require_once __DIR__ . '/config.php';

