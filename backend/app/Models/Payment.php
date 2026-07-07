<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    protected $fillable = [
        'school_id',
        'student_id',
        'payment_method',
        'payment_date',
        'received_date',
        'amount',
        'paid_by',
        'bank_account',
        'reference_no',
        'payment_proof',
        'remark',
        'status',
        'recorded_by',
        'verified_by',
        'verified_at',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'received_date' => 'date',
            'verified_at' => 'datetime',
            'voided_at' => 'datetime',
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

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class)->where('status', 'issued');
    }

    public function issuedReceipt(): HasOne
    {
        return $this->hasOne(Receipt::class)->where('status', 'issued');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(Receipt::class);
    }
}
