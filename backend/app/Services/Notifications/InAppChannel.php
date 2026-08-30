<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannelContract;
use App\Models\PortalNotification;
use InvalidArgumentException;

final class InAppChannel implements NotificationChannelContract
{
    public function key(): string
    {
        return 'in_app';
    }

    public function deliver(NotificationMessage $message, array $targets): NotificationDispatchResult
    {
        if ($message->schoolId === null) {
            throw new InvalidArgumentException('In-app notifications require a school.');
        }
        if ($targets === []) {
            return new NotificationDispatchResult($this->key(), 0);
        }

        $now = now();
        $rows = array_map(function (NotificationTarget $target) use ($message, $now): array {
            if ($target->channel !== $this->key() || $target->destinationType !== 'user' || ! ctype_digit($target->address)) {
                throw new InvalidArgumentException('The in-app channel requires user notification targets.');
            }

            return [
                'school_id' => $message->schoolId,
                'recipient_user_id' => (int) $target->address,
                'type' => $message->type,
                'title' => $message->title,
                'body' => $message->body,
                'context_json' => $message->context === [] ? null : json_encode($message->context, JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $targets);

        PortalNotification::query()->insert($rows);

        return new NotificationDispatchResult($this->key(), count($rows));
    }
}
