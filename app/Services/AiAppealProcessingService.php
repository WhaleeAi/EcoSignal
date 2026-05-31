<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\AiModerationRepository;
use App\Repositories\AppealReadRepository;
use App\Repositories\ImageRepository;
use Throwable;

final class AiAppealProcessingService
{
    private AppealReadRepository $appeals;
    private ImageRepository $images;
    private AiModerationRepository $aiData;
    private OpenRouterModerationClient $client;

    public function __construct(
        AppealReadRepository $appeals,
        ImageRepository $images,
        AiModerationRepository $aiData,
        OpenRouterModerationClient $client
    ) {
        $this->appeals = $appeals;
        $this->images = $images;
        $this->aiData = $aiData;
        $this->client = $client;
    }

    public function process(array $user, array $input): array
    {
        @set_time_limit(120);

        $appealId = (int)($input['appeal_id'] ?? 0);
        if ($appealId <= 0) {
            throw new HttpException('Некорректный идентификатор заявки', 422);
        }

        $appeal = $this->appeals->findForAi($appealId, (int)$user['id']);
        if (!$appeal) {
            throw new HttpException('Заявка не найдена', 404);
        }

        if ((string)$appeal['status'] !== 'pending') {
            return [
                'message' => 'Заявка уже обработана',
                'appeal' => $appeal,
                'ai_decision' => null,
            ];
        }

        try {
            $decision = $this->client->moderate(
                [
                    'category_id' => (int)$appeal['category_id'],
                    'category_name' => (string)$appeal['category_name'],
                    'subcategory_id' => $appeal['subcategory_id'] !== null ? (int)$appeal['subcategory_id'] : null,
                    'subcategory_name' => $appeal['subcategory_name'] !== null ? (string)$appeal['subcategory_name'] : null,
                    'description' => (string)$appeal['description'],
                    'latitude' => (float)$appeal['latitude'],
                    'longitude' => (float)$appeal['longitude'],
                    'images_count' => count($this->images->findPreparedForAi($appealId)),
                ],
                $this->images->findPreparedForAi($appealId),
                $this->aiData->references()
            );
        } catch (Throwable $error) {
            $this->logError($appealId, $error, 'EcoSignal AI moderation failed');
            $publicMessage = $this->publicErrorMessage($error->getMessage());
            $this->appeals->addSystemMessage($appealId, $publicMessage);
            throw new HttpException($publicMessage, 502);
        }

        if ($decision['status'] === 'confirmed') {
            $this->prepareConfirmedDecision($decision, $appeal);
        }

        $finalStatus = $decision['status'] === 'confirmed' ? 'confirmed' : 'rejected';
        $finalPriority = $finalStatus === 'confirmed' ? max(1, min(5, (int)$decision['priority'])) : 0;
        $responsible = null;

        if ($finalStatus === 'confirmed') {
            try {
                $responsible = $this->aiData->nextResponsibleOrgAdmin(
                    (int)$decision['organization_id'],
                    (int)$decision['filial_id']
                );
            } catch (Throwable $error) {
                $finalStatus = 'rejected';
                $finalPriority = 0;
                $decision['status'] = 'rejected';
                $decision['organization_id'] = null;
                $decision['filial_id'] = null;
                $decision['priority'] = 0;
                $decision['reason'] = $error->getMessage();
            }
        }

        try {
            $this->appeals->begin();
            $updatedAppeal = $this->appeals->updateAfterAi($appealId, $finalStatus, $finalPriority);
            $assignment = null;
            $assignmentLabel = '';

            if ($finalStatus === 'confirmed') {
                $organizationId = (int)$decision['organization_id'];
                $filialId = (int)$decision['filial_id'];
                $assignment = $this->appeals->createAssignment($appealId, $organizationId, $filialId, (int)$responsible['id']);
                $assignmentLabel = $this->aiData->assignmentLabel($organizationId, $filialId);
                $this->appeals->addSystemMessage(
                    $appealId,
                    'AI-проверка завершена: заявка принята и направлена в ' . $assignmentLabel . '. Причина: ' . $decision['reason']
                );
            } else {
                $this->appeals->addSystemMessage(
                    $appealId,
                    'AI-проверка завершена: заявка отклонена. Причина: ' . $decision['reason']
                );
            }

            $this->appeals->commit();

            return [
                'message' => $finalStatus === 'confirmed'
                    ? 'Заявка принята AI и направлена в ' . $assignmentLabel . '.'
                    : 'Заявка отклонена автоматической AI-проверкой.',
                'appeal' => $updatedAppeal,
                'assignment' => $assignment,
                'ai_decision' => $decision,
            ];
        } catch (Throwable $error) {
            $this->appeals->rollBackIfActive();
            $this->logError($appealId, $error, 'EcoSignal AI processing failed');
            throw new HttpException('Проверка временно недоступна. Заявка остается в ожидании.', 500);
        }
    }

    private function prepareConfirmedDecision(array &$decision, array $appeal): void
    {
        $organizationId = (int)($decision['organization_id'] ?? 0);
        $nearestFilial = $organizationId > 0
            ? $this->aiData->nearestActiveFilial($organizationId, (float)$appeal['latitude'], (float)$appeal['longitude'])
            : null;

        if ($organizationId <= 0 || !$this->aiData->organizationExists($organizationId) || !$nearestFilial) {
            $this->rejectDecision($decision, 'AI выбрала недоступный орган или для органа нет активного филиала.');
            return;
        }

        $decision['filial_id'] = (int)$nearestFilial['id'];
        $decision['filial_distance_km'] = round((float)$nearestFilial['distance_km'], 2);

        if (!$this->aiData->validateAssignment($organizationId, (int)$nearestFilial['id'])) {
            $this->rejectDecision($decision, 'Ближайший филиал недоступен для назначения.');
        }
    }

    private function rejectDecision(array &$decision, string $reason): void
    {
        $decision['status'] = 'rejected';
        $decision['organization_id'] = null;
        $decision['filial_id'] = null;
        $decision['priority'] = 0;
        $decision['reason'] = $reason;
    }

    private function publicErrorMessage(string $message): string
    {
        $normalized = mb_strtolower($message);

        if (str_contains($normalized, 'base64')) {
            return 'Не удалось проверить фото. Попробуйте загрузить другое изображение.';
        }

        if (str_contains($normalized, 'rate-limited') || str_contains($normalized, '429')) {
            return 'Заявка принята и ожидает проверки.';
        }

        return 'Проверка временно недоступна. Заявка остается в ожидании.';
    }

    private function logError(int $appealId, Throwable $error, string $stage): void
    {
        $message = sprintf(
            "[%s] %s for appeal #%d: %s in %s:%d%s",
            date('Y-m-d H:i:s'),
            $stage,
            $appealId,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine(),
            PHP_EOL
        );

        error_log(trim($message));
        $logDir = dirname(__DIR__, 2) . '/storage';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }
        error_log($message, 3, $logDir . '/ai_errors.log');
    }
}
