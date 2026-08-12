<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PortalNotification extends Model
{
    protected $fillable = [
        'school_id',
        'recipient_user_id',
        'type',
        'title',
        'body',
        'context_json',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'context_json' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
