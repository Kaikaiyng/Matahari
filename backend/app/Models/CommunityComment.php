<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommunityComment extends Model
{
    public const STATUS_PENDING_REVIEW = 'pending_review';

    public const STATUS_VISIBLE = 'visible';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_HIDDEN = 'hidden';

    public const STATUS_REMOVED = 'removed';

    protected $fillable = ['tenant_id', 'school_id', 'community_post_id', 'user_id', 'body', 'status', 'hidden_at', 'hidden_by_user_id', 'moderation_reason', 'removed_at', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code'];

    protected function casts(): array
    {
        return ['hidden_at' => 'datetime', 'removed_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(CommunityReport::class);
    }
}
