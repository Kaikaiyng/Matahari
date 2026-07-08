<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentAllocation extends Model
{
    protected $fillable = [
        'school_id',
        'payment_id',
        'fee_item_id',
        'fee_agreement_item_id',
        'fee_record_charge_id',
        'allocation_type',
        'fee_code',
        'description',
        'amount',
        'sort_order',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function feeItem(): BelongsTo
    {
        return $this->belongsTo(FeeItem::class);
    }

    public function feeAgreementItem(): BelongsTo
    {
        return $this->belongsTo(FeeAgreementItem::class);
    }

    public function feeRecordCharge(): BelongsTo
    {
        return $this->belongsTo(FeeRecordCharge::class);
    }
}
