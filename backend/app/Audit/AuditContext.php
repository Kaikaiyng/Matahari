<?php

namespace App\Audit;

use Illuminate\Support\Str;
use InvalidArgumentException;

final readonly class AuditContext
{
    /**
     * @param  array<int, string>  $actorRoles
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
        if (! Str::isUuid($this->requestId, 7)) {
            throw new InvalidArgumentException('Audit request ID must be a UUIDv7.');
        }
    }
}
