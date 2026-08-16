<?php

namespace App\Services\Community;

final readonly class SafetyInspection
{
    public function __construct(
        public string $normalized,
        public bool $allowed,
        public ?string $reasonCode,
        public bool $requiresManualReview,
    ) {}
}
