<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeeAgreement extends Model
{
    protected $fillable = [
        'school_id',
        'student_id',
        'agreement_no',
        'academic_year',
        'version_no',
        'payment_plan',
        'effective_from',
        'effective_to',
        'is_current',
        'status',
        'remarks',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'is_current' => 'boolean',
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

    public function items(): HasMany
    {
        return $this->hasMany(FeeAgreementItem::class);
    }

    public function feeRecordCharges(): HasMany
    {
        return $this->hasMany(FeeRecordCharge::class);
    }

    public function discounts(): HasMany
    {
        return $this->hasMany(FeeAgreementDiscount::class);
    }
}
