<?php

namespace App\Http\Resources;

use App\Audit\AuditPayloadSanitizer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $sanitizer = app(AuditPayloadSanitizer::class);

        return [
            'id' => $this->id,
            'event_uuid' => $this->event_uuid,
            'request_id' => $this->request_id,
            'batch_id' => $this->batch_id,
            'school_id' => $this->school_id,
            'user_id' => $this->user_id,
            'actor_username' => $this->actor_username,
            'actor_roles' => $this->actor_roles ?? [],
            'action' => $this->action,
            'module' => $this->module,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'old_values' => $sanitizer->sanitize($this->old_values ?? []),
            'new_values' => $sanitizer->sanitize($this->new_values ?? []),
            'metadata' => $sanitizer->sanitize($this->metadata ?? []),
            'reason' => $this->reason,
            'related_audit_id' => $this->related_audit_id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'route_name' => $this->route_name,
            'http_method' => $this->http_method,
            'context_type' => $this->context_type,
            'schema_version' => $this->schema_version,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
