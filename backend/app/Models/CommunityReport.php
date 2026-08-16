<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommunityReport extends Model
{
    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_REVIEWING = 'reviewing';

    public const STATUS_RESOLVED = 'resolved';

    protected $fillable = [
        'tenant_id', 'school_id', 'reporter_user_id', 'source', 'target_type', 'community_post_id',
        'community_comment_id', 'reported_user_id', 'reason_code', 'details', 'priority',
        'status', 'target_snapshot', 'due_at', 'assigned_to_user_id', 'resolved_at',
        'resolution_code', 'evidence_held_at', 'evidence_held_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'target_snapshot' => 'array',
            'due_at' => 'datetime',
            'resolved_at' => 'datetime',
            'evidence_held_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(CommunityPost::class, 'community_post_id');
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(CommunityComment::class, 'community_comment_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }

    public function reportedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(CommunityReportAction::class);
    }

    public function appeals(): HasMany
    {
        return $this->hasMany(CommunityAppeal::class);
    }
}
