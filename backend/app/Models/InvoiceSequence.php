<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceSequence extends Model
{
    protected $fillable = [
        'school_id',
        'year',
        'prefix',
        'current_number',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }
}
