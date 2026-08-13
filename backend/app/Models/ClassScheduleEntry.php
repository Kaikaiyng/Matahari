<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassScheduleEntry extends Model
{
    protected $fillable = ['school_id', 'academic_year_id', 'class_id', 'subject_id', 'teaching_assignment_id', 'title', 'day_of_week', 'starts_at', 'ends_at', 'location', 'effective_from', 'effective_to', 'status', 'created_by_user_id'];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'effective_from' => 'date', 'effective_to' => 'date'];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teachingAssignment(): BelongsTo
    {
        return $this->belongsTo(TeachingAssignment::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
