<?php

namespace App\Audit;

final readonly class AuditContext
{
    /**
     * @param array<int, string> $actorRoles
     */
    public function __construct(
        public string $requestId,
        public AuditContextType $contextType,
        public ?int $actorId = null,
        public ?string $actorUsername = null,
        public array $actorRoles = [],
        public ?int $actorSchoolId = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?string $routeName = null,
        public ?string $httpMethod = null,
    ) {
    }
}
