<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityAppeal extends Model
{
    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_DECIDED = 'decided';

    protected $fillable = [
        'tenant_id', 'school_id', 'community_report_id', 'source_action_id', 'appellant_user_id',
        'statement', 'status', 'reviewed_by_user_id', 'decision', 'decision_reason', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(CommunityReport::class, 'community_report_id');
    }

    public function sourceAction(): BelongsTo
    {
        return $this->belongsTo(CommunityReportAction::class, 'source_action_id');
    }
}
