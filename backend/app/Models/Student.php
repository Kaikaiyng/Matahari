<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    protected $fillable = [
        'school_id',
        'class_id',
        'level_group',
        'student_no',
        'full_name',
        'gender',
        'dob',
        'registration_date',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'dob' => 'date',
            'registration_date' => 'date',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function parents(): BelongsToMany
    {
        return $this->belongsToMany(Guardian::class, 'student_parent_links', 'student_id', 'parent_id')
            ->withPivot(['school_id', 'relationship', 'is_primary_contact'])
            ->withTimestamps();
    }

    public function feeAssignments(): HasMany
    {
        return $this->hasMany(StudentFeeAssignment::class);
    }

    public function feeAgreements(): HasMany
    {
        return $this->hasMany(FeeAgreement::class);
    }

    public function feeRecordCharges(): HasMany
    {
        return $this->hasMany(FeeRecordCharge::class);
    }

    public function currentFeeAgreements(): HasMany
    {
        return $this->hasMany(FeeAgreement::class)->where('is_current', true);
    }

    public function discountAssignments(): HasMany
    {
        return $this->hasMany(StudentDiscountAssignment::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(Receipt::class);
    }
}
