<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityUserBlock extends Model
{
    protected $fillable = ['tenant_id', 'school_id', 'blocker_user_id', 'blocked_user_id', 'blocked_at', 'revoked_at'];

    protected function casts(): array
    {
        return ['blocked_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocker_user_id');
    }

    public function blockedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_user_id');
    }
}
