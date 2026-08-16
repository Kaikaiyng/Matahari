<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityReportAction extends Model
{
    protected $fillable = ['tenant_id', 'school_id', 'community_report_id', 'actor_user_id', 'action', 'reason_code', 'reason', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(CommunityReport::class, 'community_report_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
