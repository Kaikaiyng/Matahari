<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityComment extends Model
{
    protected $fillable = ['school_id', 'community_post_id', 'user_id', 'body', 'status', 'hidden_at', 'hidden_by_user_id', 'moderation_reason', 'removed_at'];

    protected function casts(): array
    {
        return ['hidden_at' => 'datetime', 'removed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
