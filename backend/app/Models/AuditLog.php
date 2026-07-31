<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'event_uuid',
        'request_id',
        'batch_id',
        'school_id',
        'user_id',
        'actor_username',
        'actor_roles',
        'action',
        'module',
        'entity_type',
        'entity_id',
        'old_values',
        'new_values',
        'metadata',
        'reason',
        'related_audit_id',
        'ip_address',
        'user_agent',
        'route_name',
        'http_method',
        'context_type',
        'schema_version',
    ];

    protected function casts(): array
    {
        return [
            'actor_roles' => 'array',
            'old_values' => 'array',
            'new_values' => 'array',
            'metadata' => 'array',
            'schema_version' => 'integer',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
