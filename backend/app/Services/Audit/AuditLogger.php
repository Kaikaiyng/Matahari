<?php

namespace App\Services\Audit;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditPayloadSanitizer;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use Illuminate\Support\Str;

final class AuditLogger implements AuditLoggerContract
{
    public function __construct(
        private readonly AuditPayloadSanitizer $sanitizer,
    ) {}

    public function record(AuditEvent $event, AuditContext $context): AuditLog
    {
        return AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => $context->requestId,
            'batch_id' => $event->batchId,
            'school_id' => $event->schoolId ?? $context->actorSchoolId,
            'user_id' => $context->actorId,
            'actor_username' => $context->actorUsername,
            'actor_roles' => $context->actorRoles,
            'action' => $event->action->value,
            'module' => $event->module->value,
            'entity_type' => $event->subjectType?->value,
            'entity_id' => $event->subjectId,
            'old_values' => $this->sanitizer->sanitize($event->oldValues),
            'new_values' => $this->sanitizer->sanitize($event->newValues),
            'metadata' => $this->sanitizer->sanitize($event->metadata),
            'reason' => $event->reason === null ? null : trim($event->reason),
            'related_audit_id' => $event->relatedAuditId,
            'ip_address' => $context->ipAddress,
            'user_agent' => $context->userAgent === null ? null : mb_substr($context->userAgent, 0, 1000),
            'route_name' => $context->routeName,
            'http_method' => $context->httpMethod,
            'context_type' => $context->contextType->value,
            'schema_version' => 1,
        ]);
    }
}
