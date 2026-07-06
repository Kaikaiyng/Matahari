<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeeItem extends Model
{
    protected $fillable = [
        'school_id',
        'name',
        'code',
        'fee_type',
        'category',
        'default_amount',
        'status',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(StudentFeeAssignment::class);
    }

    public function feeAgreementItems(): HasMany
    {
        return $this->hasMany(FeeAgreementItem::class);
    }
}
