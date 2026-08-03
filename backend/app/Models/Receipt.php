<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Receipt extends Model
{
    protected $fillable = [
        'school_id',
        'payment_id',
        'active_payment_id',
        'student_id',
        'student_no',
        'student_name',
        'paid_by',
        'payment_method',
        'payment_date',
        'received_date',
        'receipt_no',
        'receipt_date',
        'amount',
        'amount_in_words',
        'status',
        'issued_by',
        'issued_at',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'date',
            'received_date' => 'date',
            'receipt_date' => 'date',
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function activePayment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'active_payment_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReceiptItem::class)->orderBy('sort_order')->orderBy('id');
    }
}
