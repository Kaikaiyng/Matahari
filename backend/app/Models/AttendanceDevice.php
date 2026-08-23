<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceDevice extends Model
{
    protected $fillable = ['school_id', 'name', 'vendor', 'external_device_id', 'direction_mode', 'status', 'location', 'credential_secret', 'last_seen_at'];

    protected $hidden = ['credential_secret'];

    protected function casts(): array
    {
        return ['credential_secret' => 'encrypted', 'last_seen_at' => 'datetime'];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }
}
