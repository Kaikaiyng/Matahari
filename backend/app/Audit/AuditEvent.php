<?php

namespace App\Audit;

use InvalidArgumentException;

final readonly class AuditEvent
{
    public function __construct(
        public AuditAction $action,
        public AuditModule $module,
        public ?int $schoolId = null,
        public ?AuditSubject $subjectType = null,
        public ?int $subjectId = null,
        public array $oldValues = [],
        public array $newValues = [],
        public array $metadata = [],
        public ?string $reason = null,
        public ?int $relatedAuditId = null,
        public ?string $batchId = null,
    ) {
        if (($this->subjectType === null) !== ($this->subjectId === null)) {
            throw new InvalidArgumentException('Audit subject type and ID must be provided together.');
        }

        if ($this->reason !== null && trim($this->reason) === '') {
            throw new InvalidArgumentException('Audit reason cannot be blank.');
        }
    }
}
