<?php

declare(strict_types=1);

namespace EcoSignal\Core;

final class Response
{
    public static function allowCors(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }

    public static function json(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function binary(string $data, string $contentType, string $filename): void
    {
        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . strlen($data));
        header('Content-Disposition: inline; filename="' . addcslashes($filename, "\"\\") . '"');
        header('Cache-Control: public, max-age=86400');
        echo $data;
        exit;
    }
}

