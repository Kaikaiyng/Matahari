<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeeRecordCharge extends Model
{
    protected $fillable = [
        'school_id',
        'student_id',
        'fee_agreement_id',
        'fee_agreement_item_id',
        'fee_item_id',
        'academic_year',
        'billing_month',
        'fee_record_category',
        'fee_code',
        'description',
        'remark',
        'expected_amount',
        'paid_amount_cached',
        'outstanding_amount_cached',
        'billing_status',
        'collection_status',
        'charge_origin',
        'source_type',
        'skipped_reason',
        'activated_at',
    ];

    protected function casts(): array
    {
        return [
            'activated_at' => 'datetime',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function feeAgreement(): BelongsTo
    {
        return $this->belongsTo(FeeAgreement::class);
    }

    public function feeAgreementItem(): BelongsTo
    {
        return $this->belongsTo(FeeAgreementItem::class);
    }

    public function feeItem(): BelongsTo
    {
        return $this->belongsTo(FeeItem::class);
    }
}
