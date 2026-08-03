<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeeAgreementItem extends Model
{
    protected $fillable = [
        'school_id',
        'fee_agreement_id',
        'fee_item_id',
        'fee_code',
        'fee_category',
        'description',
        'amount',
        'is_mandatory',
        'sort_order',
        'classification',
        'billing_frequency',
        'billing_months',
        'requires_preview_confirmation',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'is_mandatory' => 'boolean',
            'billing_months' => 'array',
            'requires_preview_confirmation' => 'boolean',
        ];
    }

    public function feeAgreement(): BelongsTo
    {
        return $this->belongsTo(FeeAgreement::class);
    }

    public function feeItem(): BelongsTo
    {
        return $this->belongsTo(FeeItem::class);
    }

    public function feeRecordCharges(): HasMany
    {
        return $this->hasMany(FeeRecordCharge::class);
    }
}
