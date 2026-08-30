<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannelContract;
use Illuminate\Support\Facades\Log;

final class NotificationDispatcher
{
    /** @var array<string, NotificationChannelContract> */
    private array $channels = [];

    /** @param iterable<NotificationChannelContract> $channels */
    public function __construct(iterable $channels)
    {
        foreach ($channels as $channel) {
            $this->channels[$channel->key()] = $channel;
        }
    }

    /** @param iterable<int> $recipientUserIds */
    public function sendInApp(NotificationMessage $message, iterable $recipientUserIds): NotificationDispatchResult
    {
        $targets = [];
        foreach ($recipientUserIds as $recipientUserId) {
            $targets[] = NotificationTarget::inApp((int) $recipientUserId);
        }

        return $this->dispatch($message, 'in_app', $targets);
    }

    /** @param iterable<NotificationTarget> $targets */
    public function dispatch(NotificationMessage $message, string $channel, iterable $targets): NotificationDispatchResult
    {
        $targetList = is_array($targets) ? array_values($targets) : iterator_to_array($targets, false);
        $driver = $this->channels[$channel] ?? null;
        if (! $driver) {
            Log::warning('Notification channel is not registered; delivery skipped.', [
                'channel' => $channel,
                'target_count' => count($targetList),
                'tenant_id' => $message->tenantId,
                'school_id' => $message->schoolId,
                'notification_type' => $message->type,
            ]);

            return new NotificationDispatchResult($channel, 0, count($targetList));
        }

        return $driver->deliver($message, $targetList);
    }
}
