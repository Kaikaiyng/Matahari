<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentCommunityAuthorization extends Model
{
    public const CAPABILITY_FREEFORM_INTERACTION = 'freeform_interaction';

    protected $fillable = [
        'tenant_id', 'school_id', 'student_user_id', 'authorized_by_user_id', 'capability',
        'effective_at', 'revoked_at', 'revoked_by_user_id', 'revocation_reason',
    ];

    protected function casts(): array
    {
        return ['effective_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function studentUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function authorizedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorized_by_user_id');
    }
}
