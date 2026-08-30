<?php

namespace App\Services\Notifications;

use InvalidArgumentException;

final readonly class NotificationMessage
{
    /** @param array<string, mixed> $context */
    public function __construct(
        public ?int $tenantId,
        public ?int $schoolId,
        public string $type,
        public string $title,
        public string $body,
        public array $context = [],
    ) {
        if ($this->schoolId !== null && $this->tenantId === null) {
            throw new InvalidArgumentException('A school-scoped notification message requires a tenant.');
        }
    }
}
