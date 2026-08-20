<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommunityPost extends Model
{
    public const STATUS_PENDING_REVIEW = 'pending_review';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_HIDDEN = 'hidden';

    public const STATUS_DELETED = 'deleted';

    protected $fillable = ['tenant_id', 'school_id', 'author_user_id', 'calendar_event_id', 'post_type', 'body', 'comments_enabled', 'status', 'published_at', 'hidden_at', 'hidden_by_user_id', 'moderation_reason', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code'];

    protected function casts(): array
    {
        return ['comments_enabled' => 'boolean', 'published_at' => 'datetime', 'hidden_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function audiences(): HasMany
    {
        return $this->hasMany(CommunityPostAudience::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(CommunityPostMedia::class)->orderBy('sort_order');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(CommunityPostReaction::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(CommunityComment::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(CommunityReport::class);
    }
}
