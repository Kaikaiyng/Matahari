<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassEnrolment extends Model
{
    protected $fillable = [
        'school_id', 'academic_year_id', 'class_id', 'student_id', 'starts_on', 'ends_on',
        'status', 'current_slot', 'created_by', 'ended_by', 'ended_at',
    ];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date', 'ended_at' => 'datetime'];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
