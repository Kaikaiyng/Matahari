<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchoolSupportSetting extends Model
{
    protected $fillable = [
        'school_id',
        'call_phone',
        'whatsapp_phone',
        'support_email',
        'operating_hours',
        'updated_by',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
