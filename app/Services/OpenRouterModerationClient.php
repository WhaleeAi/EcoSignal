<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

final class OpenRouterModerationClient
{
    public function moderate(array $appeal, array $preparedImages, array $references): array
    {
        $content = [[
            'type' => 'text',
            'text' => json_encode([
                'appeal' => $appeal,
                'allowed_categories_and_subcategories' => $references['categories'],
                'allowed_organizations_and_filials' => $references['filials'],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]];

        foreach (array_slice($preparedImages, 0, 3) as $image) {
            $imageBase64 = preg_replace('/\s+/', '', (string)($image['data_base64'] ?? '')) ?? '';
            if ($imageBase64 === '') {
                continue;
            }

            $content[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => 'data:' . $image['content_type'] . ';base64,' . $imageBase64,
                ],
            ];
        }

        $payload = [
            'model' => OPENROUTER_MODEL,
            'messages' => [
                ['role' => 'system', 'content' => $this->prompt()],
                ['role' => 'user', 'content' => $content],
            ],
            'temperature' => 0,
            'max_tokens' => 800,
        ];

        $response = $this->send($payload);
        $decoded = json_decode((string)$response['body'], true);
        if (!is_array($decoded)) {
            throw new RuntimeException('OpenRouter returned invalid JSON');
        }

        $httpCode = (int)$response['http_code'];
        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException($this->errorMessage($decoded, $httpCode));
        }

        $messageContent = $decoded['choices'][0]['message']['content'] ?? '';
        if (!is_string($messageContent) || trim($messageContent) === '') {
            throw new RuntimeException('OpenRouter response is empty');
        }

        return $this->normalize($this->extractJson($messageContent));
    }

    private function send(array $payload): array
    {
        $headers = [
            'Authorization: Bearer ' . $this->apiKey(),
            'Content-Type: application/json',
            'HTTP-Referer: http://localhost/EcoSignal',
            'X-Title: EcoSignal',
        ];
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($body === false) {
            throw new RuntimeException('Failed to encode OpenRouter payload');
        }

        if (function_exists('curl_init')) {
            $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
            if ($ch === false) {
                throw new RuntimeException('Failed to initialize OpenRouter request');
            }

            $options = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_CONNECTTIMEOUT => 15,
                CURLOPT_TIMEOUT => 60,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_POSTFIELDS => $body,
            ];

            $caBundlePath = $this->caBundlePath();
            if ($caBundlePath !== null) {
                if (!is_readable($caBundlePath)) {
                    throw new RuntimeException('OpenRouter CA bundle is not readable: ' . $caBundlePath);
                }
                $options[CURLOPT_CAINFO] = $caBundlePath;
            }

            curl_setopt_array($ch, $options);
            $response = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            if (PHP_VERSION_ID < 80500) {
                curl_close($ch);
            }

            if ($response === false || $response === '') {
                throw new RuntimeException('OpenRouter request failed: ' . $curlError);
            }

            return ['http_code' => $httpCode, 'body' => $response];
        }

        return $this->sendViaCurlBinary($headers, $body);
    }

    private function sendViaCurlBinary(array $headers, string $body): array
    {
        if (!function_exists('proc_open')) {
            throw new RuntimeException('PHP curl extension is unavailable and proc_open is disabled');
        }

        $payloadPath = tempnam(sys_get_temp_dir(), 'ecosignal-openrouter-');
        if ($payloadPath === false || file_put_contents($payloadPath, $body) === false) {
            throw new RuntimeException('Failed to create temporary OpenRouter payload');
        }

        $command = ['curl.exe', '-sS', '--http1.1', '--connect-timeout', '15', '--max-time', '60', '-X', 'POST'];
        foreach ($headers as $header) {
            $command[] = '-H';
            $command[] = $header;
        }
        $command[] = '--data-binary';
        $command[] = '@' . $payloadPath;
        $command[] = '-w';
        $command[] = "\n__HTTP_CODE__:%{http_code}";
        $command[] = 'https://openrouter.ai/api/v1/chat/completions';

        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            @unlink($payloadPath);
            throw new RuntimeException('Failed to start curl.exe for OpenRouter request');
        }

        $output = stream_get_contents($pipes[1]);
        $errorOutput = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        @unlink($payloadPath);

        if ($exitCode !== 0 || !is_string($output) || trim($output) === '') {
            throw new RuntimeException('OpenRouter curl.exe request failed: ' . trim((string)$errorOutput));
        }

        if (!preg_match('/\n__HTTP_CODE__:(\d{3})\s*$/', $output, $matches)) {
            throw new RuntimeException('OpenRouter curl.exe response did not include HTTP status');
        }

        return [
            'http_code' => (int)$matches[1],
            'body' => (string)preg_replace('/\n__HTTP_CODE__:\d{3}\s*$/', '', $output),
        ];
    }

    private function apiKey(): string
    {
        $envKey = getenv('OPENROUTER_API_KEY');
        if (is_string($envKey) && trim($envKey) !== '') {
            return trim($envKey);
        }

        if (defined('OPENROUTER_API_KEY') && trim((string)OPENROUTER_API_KEY) !== '') {
            return trim((string)OPENROUTER_API_KEY);
        }

        throw new RuntimeException('OPENROUTER_API_KEY is not configured');
    }

    private function caBundlePath(): ?string
    {
        $envPath = getenv('OPENROUTER_CA_BUNDLE');
        if (is_string($envPath) && trim($envPath) !== '') {
            return trim($envPath);
        }

        $fallbackPath = 'C:\\Program Files\\Git\\usr\\ssl\\certs\\ca-bundle.crt';
        return is_readable($fallbackPath) ? $fallbackPath : null;
    }

    private function extractJson(string $content): array
    {
        $content = trim($content);
        $content = preg_replace('/^```(?:json)?\s*/i', '', $content) ?? $content;
        $content = preg_replace('/\s*```$/', '', $content) ?? $content;

        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start === false || $end === false || $end < $start) {
            throw new RuntimeException('AI response does not contain JSON object');
        }

        $data = json_decode(substr($content, $start, $end - $start + 1), true);
        if (!is_array($data)) {
            throw new RuntimeException('AI response JSON is invalid');
        }

        return $data;
    }

    private function normalize(array $decision): array
    {
        $status = (string)($decision['status'] ?? 'rejected');
        if (!in_array($status, ['confirmed', 'rejected'], true)) {
            $status = 'rejected';
        }

        $priority = max(0, min(5, (int)($decision['priority'] ?? 0)));
        $confidence = max(0, min(1, (float)($decision['confidence'] ?? 0)));

        if ($status === 'rejected') {
            return [
                'status' => 'rejected',
                'is_environmental_problem' => (bool)($decision['is_environmental_problem'] ?? false),
                'matches_description' => (bool)($decision['matches_description'] ?? false),
                'category_id' => null,
                'subcategory_id' => null,
                'organization_id' => null,
                'filial_id' => null,
                'priority' => 0,
                'confidence' => $confidence,
                'reason' => trim((string)($decision['reason'] ?? 'Заявка отклонена автоматической проверкой.')),
            ];
        }

        return [
            'status' => 'confirmed',
            'is_environmental_problem' => (bool)($decision['is_environmental_problem'] ?? true),
            'matches_description' => (bool)($decision['matches_description'] ?? true),
            'category_id' => isset($decision['category_id']) ? (int)$decision['category_id'] : null,
            'subcategory_id' => isset($decision['subcategory_id']) ? (int)$decision['subcategory_id'] : null,
            'organization_id' => isset($decision['organization_id']) ? (int)$decision['organization_id'] : null,
            'filial_id' => isset($decision['filial_id']) ? (int)$decision['filial_id'] : null,
            'priority' => $priority,
            'confidence' => $confidence,
            'reason' => trim((string)($decision['reason'] ?? 'Заявка подтверждена автоматической проверкой.')),
        ];
    }

    private function errorMessage(array $decoded, int $httpCode): string
    {
        $error = is_array($decoded['error'] ?? null) ? $decoded['error'] : [];
        $parts = [];

        foreach (['message', 'code'] as $key) {
            if (isset($error[$key]) && is_scalar($error[$key])) {
                $value = trim((string)$error[$key]);
                if ($value !== '') {
                    $parts[] = $value;
                }
            }
        }

        $metadata = is_array($error['metadata'] ?? null) ? $error['metadata'] : [];
        foreach (['raw', 'provider_name'] as $key) {
            if (isset($metadata[$key]) && is_scalar($metadata[$key])) {
                $value = trim((string)$metadata[$key]);
                if ($value !== '') {
                    $parts[] = $value;
                }
            }
        }

        return $parts ? implode(' | ', array_values(array_unique($parts))) : 'OpenRouter HTTP error ' . $httpCode;
    }

    private function prompt(): string
    {
        return <<<'PROMPT'
You are EcoSignal automated environmental appeal moderator.
Return only valid JSON. Do not use markdown. Do not add text outside JSON.

Decision rules:
1. Analyze the citizen description, selected category/subcategory, coordinates and all attached images.
2. Carefully estimate whether the attached photos contain a real visible environmental problem and whether they match the text description.
3. Confirm the appeal only when the photos and description clearly match an environmental problem from the provided category/subcategory list.
4. Reject the appeal when photos are absent, irrelevant, contradict the description, show no visible environmental problem, or the problem is outside the provided category/subcategory list.
5. If confirmed, decide which supervisory organization should receive the appeal.
6. Choose exactly one organization_id from the provided organizations/filials. The server will route the appeal to the active filial of that organization with the shortest distance to the appeal coordinates.
7. You may return any provided filial_id that belongs to the chosen organization, but do not invent ids, organizations, filials, categories or statuses.
8. Priority is an integer from 0 to 5.

Required JSON schema:
{
  "status": "confirmed" | "rejected",
  "is_environmental_problem": boolean,
  "matches_description": boolean,
  "category_id": number | null,
  "subcategory_id": number | null,
  "organization_id": number | null,
  "filial_id": number | null,
  "priority": number,
  "confidence": number,
  "reason": string
}

For rejected appeals set organization_id, filial_id, category_id and subcategory_id to null and priority to 0.
Confidence must be from 0 to 1.
Reason must be short and in Russian.
PROMPT;
    }
}
