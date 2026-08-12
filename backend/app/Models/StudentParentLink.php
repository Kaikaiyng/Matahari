<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentParentLink extends Model
{
    protected $fillable = [
        'school_id', 'student_id', 'parent_id', 'relationship', 'status', 'is_primary_contact',
        'can_view_finance', 'can_view_academics', 'starts_on', 'ended_on', 'current_slot',
    ];

    protected function casts(): array
    {
        return [
            'is_primary_contact' => 'boolean',
            'can_view_finance' => 'boolean',
            'can_view_academics' => 'boolean',
            'starts_on' => 'date',
            'ended_on' => 'date',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function guardian(): BelongsTo
    {
        return $this->belongsTo(Guardian::class, 'parent_id');
    }
}
