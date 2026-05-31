<?php

declare(strict_types=1);

namespace EcoSignal\Services;

use EcoSignal\Core\HttpException;
use finfo;

final class FileUploadService
{
    public function validateRequestBodySize(): void
    {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        $postMaxSize = $this->parsePhpSizeToBytes((string)ini_get('post_max_size'));

        if ($postMaxSize > 0 && $contentLength > $postMaxSize) {
            throw new HttpException('Файлы слишком большие для загрузки', 413, [
                'error' => 'Размер запроса превышает post_max_size=' . ini_get('post_max_size'),
            ]);
        }
    }

    public function normalize(?array $imagesField): array
    {
        if (!$imagesField || !isset($imagesField['name'])) {
            return [];
        }

        if (!is_array($imagesField['name'])) {
            return [[
                'name' => (string)$imagesField['name'],
                'type' => (string)$imagesField['type'],
                'tmp_name' => (string)$imagesField['tmp_name'],
                'error' => (int)$imagesField['error'],
                'size' => (int)$imagesField['size'],
            ]];
        }

        $normalized = [];
        $total = count($imagesField['name']);
        for ($i = 0; $i < $total; $i++) {
            $normalized[] = [
                'name' => (string)$imagesField['name'][$i],
                'type' => (string)$imagesField['type'][$i],
                'tmp_name' => (string)$imagesField['tmp_name'][$i],
                'error' => (int)$imagesField['error'][$i],
                'size' => (int)$imagesField['size'][$i],
            ];
        }

        return $normalized;
    }

    public function prepare(array $uploadedImages): array
    {
        $prepared = [];
        $maxImageSize = 5 * 1024 * 1024;
        $allowedTypes = ['image/jpeg', 'image/png'];
        $allowedExtensions = ['jpg', 'jpeg', 'png'];

        foreach ($uploadedImages as $image) {
            if ((int)$image['error'] === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            if ((int)$image['error'] !== UPLOAD_ERR_OK) {
                throw new HttpException($this->uploadErrorMessage((int)$image['error']), 422);
            }
            if ((int)$image['size'] > $maxImageSize) {
                throw new HttpException('Размер каждого фото не должен превышать 5 МБ', 422);
            }

            $extension = strtolower(pathinfo((string)$image['name'], PATHINFO_EXTENSION));
            if (!in_array($extension, $allowedExtensions, true)) {
                throw new HttpException('Допустимы только файлы PNG, JPG и JPEG', 422);
            }

            $tmpName = (string)$image['tmp_name'];
            if ($tmpName === '' || !is_uploaded_file($tmpName)) {
                throw new HttpException('Некорректный загруженный файл', 422);
            }

            $binaryData = file_get_contents($tmpName);
            if ($binaryData === false) {
                throw new HttpException('Не удалось прочитать файл', 422);
            }

            $contentType = $this->detectType($tmpName, (string)$image['type']);
            if (!in_array($contentType, $allowedTypes, true)) {
                throw new HttpException('Допустимы только файлы PNG, JPG и JPEG', 422);
            }

            $prepared[] = [
                'filename' => basename((string)$image['name']),
                'content_type' => $contentType,
                'size' => strlen($binaryData),
                'data_base64' => base64_encode($binaryData),
            ];
        }

        return $prepared;
    }

    private function parsePhpSizeToBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '') {
            return 0;
        }

        $unit = strtolower($value[strlen($value) - 1]);
        $number = (float)$value;

        return match ($unit) {
            'g' => (int)($number * 1024 * 1024 * 1024),
            'm' => (int)($number * 1024 * 1024),
            'k' => (int)($number * 1024),
            default => (int)$number,
        };
    }

    private function detectType(string $tmpName, string $fallbackType): string
    {
        if (class_exists('finfo')) {
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $detected = $finfo->file($tmpName);
            if (is_string($detected) && $detected !== '') {
                return $detected;
            }
        }

        $imageInfo = @getimagesize($tmpName);
        if (is_array($imageInfo) && isset($imageInfo['mime'])) {
            return (string)$imageInfo['mime'];
        }

        return $fallbackType;
    }

    private function uploadErrorMessage(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файл превышает допустимый размер загрузки',
            UPLOAD_ERR_PARTIAL => 'Файл загрузился не полностью',
            UPLOAD_ERR_NO_TMP_DIR => 'На сервере не настроена временная папка для загрузки',
            UPLOAD_ERR_CANT_WRITE => 'Сервер не смог записать загруженный файл',
            UPLOAD_ERR_EXTENSION => 'PHP-расширение остановило загрузку файла',
            default => 'Ошибка загрузки файла',
        };
    }
}

