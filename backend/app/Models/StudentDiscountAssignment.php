<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentDiscountAssignment extends Model
{
    protected $fillable = [
        'school_id',
        'student_id',
        'discount_item_id',
        'discount_type',
        'value',
        'start_date',
        'end_date',
        'status',
        'reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
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

    public function discountItem(): BelongsTo
    {
        return $this->belongsTo(DiscountItem::class);
    }
}
