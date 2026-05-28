<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function getOpenRouterApiKey(): string
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

function buildAiModerationPrompt(): string
{
    return <<<'PROMPT'
You are EcoSignal automated environmental appeal moderator.
Return only valid JSON. Do not use markdown. Do not add text outside JSON.

Decision rules:
1. Analyze the citizen description, selected category/subcategory, coordinates and all attached images.
2. Carefully estimate whether the attached photos contain a real visible environmental problem and whether they match the text description.
3. Confirm the appeal only when the photos and description clearly match an environmental problem from the provided category/subcategory list.
4. Reject the appeal when photos are absent, irrelevant, contradict the description, show no visible environmental problem, or the problem is outside the provided category/subcategory list.
5. If confirmed, decide which supervisory organization should receive the appeal. The available organizations are only: Росприроднадзор, Минприроды РФ, Рослесхоз, Департамент природопользования.
6. Choose exactly one organization_id and filial_id from the provided organizations/filials. The filial must belong to the chosen organization.
7. Choose the organization and filial based on the ecological problem category/subcategory, photo evidence and description. Do not invent ids, organizations, filials, categories or statuses.
8. Priority is an integer from 0 to 5:
   0 = no environmental problem or invalid appeal,
   1 = low local inconvenience,
   2 = visible local problem,
   3 = meaningful local environmental impact,
   4 = serious pollution or public risk,
   5 = urgent high-risk pollution, water contamination, fire, toxic waste, or large-scale damage.

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

function fetchAiModerationReferences(PDO $pdo): array
{
    $categories = $pdo->query('
        SELECT
            c.id AS category_id,
            c.name AS category_name,
            s.id AS subcategory_id,
            s.name AS subcategory_name
        FROM categories c
        LEFT JOIN subcategories s ON s.category_id = c.id
        ORDER BY c.id ASC, s.id ASC
    ')->fetchAll();

    $filials = $pdo->query('
        SELECT
            o.id AS organization_id,
            o.name AS organization_name,
            o.org_type,
            f.id AS filial_id,
            f.name AS filial_name,
            f.address,
            f.region
        FROM organizations o
        INNER JOIN filials f ON f.organization_id = o.id
        WHERE f.is_active = TRUE
        ORDER BY o.name ASC, f.name ASC
    ')->fetchAll();

    return [
        'categories' => $categories,
        'filials' => $filials,
    ];
}

function buildAiModerationUserText(array $appeal, array $references): string
{
    return json_encode([
        'appeal' => $appeal,
        'allowed_categories_and_subcategories' => $references['categories'],
        'allowed_organizations_and_filials' => $references['filials'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function extractJsonObject(string $content): array
{
    $content = trim($content);
    $content = preg_replace('/^```(?:json)?\s*/i', '', $content) ?? $content;
    $content = preg_replace('/\s*```$/', '', $content) ?? $content;

    $start = strpos($content, '{');
    $end = strrpos($content, '}');
    if ($start === false || $end === false || $end < $start) {
        throw new RuntimeException('AI response does not contain JSON object');
    }

    $json = substr($content, $start, $end - $start + 1);
    $data = json_decode($json, true);
    if (!is_array($data)) {
        throw new RuntimeException('AI response JSON is invalid');
    }

    return $data;
}

function normalizeAiModerationDecision(array $decision): array
{
    $status = (string)($decision['status'] ?? 'rejected');
    if (!in_array($status, ['confirmed', 'rejected'], true)) {
        $status = 'rejected';
    }

    $priority = (int)($decision['priority'] ?? 0);
    $priority = max(0, min(5, $priority));

    $confidence = (float)($decision['confidence'] ?? 0);
    $confidence = max(0, min(1, $confidence));

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

function getOpenRouterErrorMessage(array $decoded, int $httpCode): string
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

    if (!$parts) {
        $parts[] = 'OpenRouter HTTP error ' . $httpCode;
    }

    return implode(' | ', array_values(array_unique($parts)));
}

function sendOpenRouterChatRequest(array $payload): array
{
    $headers = [
        'Authorization: Bearer ' . getOpenRouterApiKey(),
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

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
        ]);

        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false || $response === '') {
            throw new RuntimeException('OpenRouter request failed: ' . $curlError);
        }

        return [
            'http_code' => $httpCode,
            'body' => $response,
        ];
    }

    return sendOpenRouterViaCurlBinary($headers, $body);
}

function sendOpenRouterViaCurlBinary(array $headers, string $body): array
{
    if (!function_exists('proc_open')) {
        throw new RuntimeException('PHP curl extension is unavailable and proc_open is disabled');
    }

    $payloadPath = tempnam(sys_get_temp_dir(), 'ecosignal-openrouter-');
    if ($payloadPath === false || file_put_contents($payloadPath, $body) === false) {
        throw new RuntimeException('Failed to create temporary OpenRouter payload');
    }

    $command = [
        'curl.exe',
        '-sS',
        '--http1.1',
        '--connect-timeout',
        '15',
        '--max-time',
        '60',
        '-X',
        'POST',
    ];

    foreach ($headers as $header) {
        $command[] = '-H';
        $command[] = $header;
    }

    $command[] = '--data-binary';
    $command[] = '@' . $payloadPath;
    $command[] = '-w';
    $command[] = "\n__HTTP_CODE__:%{http_code}";
    $command[] = 'https://openrouter.ai/api/v1/chat/completions';

    $descriptors = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptors, $pipes);
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

    $httpCode = (int)$matches[1];
    $responseBody = preg_replace('/\n__HTTP_CODE__:\d{3}\s*$/', '', $output);

    return [
        'http_code' => $httpCode,
        'body' => (string)$responseBody,
    ];
}

function moderateAppealWithAi(array $appeal, array $preparedImages, array $references): array
{
    $content = [
        [
            'type' => 'text',
            'text' => buildAiModerationUserText($appeal, $references),
        ],
    ];

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
            [
                'role' => 'system',
                'content' => buildAiModerationPrompt(),
            ],
            [
                'role' => 'user',
                'content' => $content,
            ],
        ],
        'temperature' => 0,
        'max_tokens' => 800,
    ];

    $openRouterResponse = sendOpenRouterChatRequest($payload);
    $response = (string)$openRouterResponse['body'];
    $httpCode = (int)$openRouterResponse['http_code'];

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('OpenRouter returned invalid JSON');
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        throw new RuntimeException(getOpenRouterErrorMessage($decoded, $httpCode));
    }

    $messageContent = $decoded['choices'][0]['message']['content'] ?? '';
    if (!is_string($messageContent) || trim($messageContent) === '') {
        throw new RuntimeException('OpenRouter response is empty');
    }

    return normalizeAiModerationDecision(extractJsonObject($messageContent));
}

function validateAiAssignment(PDO $pdo, int $organizationId, int $filialId): bool
{
    $stmt = $pdo->prepare('
        SELECT 1
        FROM filials f
        INNER JOIN organizations o ON o.id = f.organization_id
        WHERE f.id = :filial_id
          AND f.organization_id = :organization_id
          AND f.is_active = TRUE
        LIMIT 1
    ');
    $stmt->execute([
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
    ]);

    return (bool)$stmt->fetchColumn();
}

function pickNextResponsibleOrgAdmin(PDO $pdo, int $organizationId, int $filialId): array
{
    $candidateStmt = $pdo->prepare('
        SELECT id, login
        FROM org_admins
        WHERE organization_id = :organization_id
          AND filial_id = :filial_id
          AND role = :role
          AND is_active = TRUE
        ORDER BY id ASC
    ');
    $candidateStmt->execute([
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
        'role' => 'admin',
    ]);

    $candidates = $candidateStmt->fetchAll();
    if (!$candidates) {
        throw new RuntimeException('В выбранном филиале нет активных сотрудников для обработки заявки.');
    }

    if (count($candidates) === 1) {
        return $candidates[0];
    }

    $candidateIds = array_map(static fn(array $candidate): int => (int)$candidate['id'], $candidates);
    $placeholders = [];
    $params = [
        'organization_id' => $organizationId,
        'filial_id' => $filialId,
    ];

    foreach ($candidateIds as $index => $candidateId) {
        $param = 'candidate_id_' . $index;
        $placeholders[] = ':' . $param;
        $params[$param] = $candidateId;
    }

    $lastAssignedStmt = $pdo->prepare('
        SELECT responsible_org_admin_id
        FROM appeal_assignments
        WHERE organization_id = :organization_id
          AND filial_id = :filial_id
          AND responsible_org_admin_id IN (' . implode(', ', $placeholders) . ')
        ORDER BY assigned_at DESC, id DESC
        LIMIT 1
    ');
    $lastAssignedStmt->execute($params);

    $lastAssignedId = (int)($lastAssignedStmt->fetchColumn() ?: 0);
    if ($lastAssignedId <= 0) {
        return $candidates[0];
    }

    foreach ($candidates as $index => $candidate) {
        if ((int)$candidate['id'] === $lastAssignedId) {
            return $candidates[($index + 1) % count($candidates)];
        }
    }

    return $candidates[0];
}
