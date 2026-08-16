<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityPolicyAcceptance extends Model
{
    protected $fillable = ['tenant_id', 'school_id', 'user_id', 'community_policy_version_id', 'accepted_at', 'security_context'];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime', 'security_context' => 'array'];
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(CommunityPolicyVersion::class, 'community_policy_version_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
