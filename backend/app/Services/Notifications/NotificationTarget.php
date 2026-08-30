<?php

namespace App\Services\Notifications;

use App\Models\NotificationDestination;

final readonly class NotificationTarget
{
    public function __construct(
        public string $channel,
        public string $destinationType,
        public string $address,
    ) {}

    public static function inApp(int $userId): self
    {
        return new self('in_app', 'user', (string) $userId);
    }

    public static function fromDestination(NotificationDestination $destination): self
    {
        return new self($destination->channel, $destination->destination_type, $destination->destination_address);
    }
}
