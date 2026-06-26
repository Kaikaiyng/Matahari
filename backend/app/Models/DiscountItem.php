<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DiscountItem extends Model
{
    protected $fillable = [
        'school_id',
        'name',
        'discount_type',
        'default_value',
        'status',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(StudentDiscountAssignment::class);
    }
}
