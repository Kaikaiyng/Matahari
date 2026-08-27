<?php

namespace App\Services\Notifications;

final readonly class NotificationDispatchResult
{
    public function __construct(
        public string $channel,
        public int $delivered,
        public int $skipped = 0,
    ) {}
}
