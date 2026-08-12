<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceSession extends Model
{
    protected $fillable = [
        'school_id', 'academic_year_id', 'class_id', 'subject_id', 'teaching_assignment_id',
        'session_type', 'attendance_date', 'starts_at', 'session_key', 'status',
        'created_by', 'submitted_by', 'submitted_at',
    ];

    protected function casts(): array
    {
        return ['attendance_date' => 'date', 'submitted_at' => 'datetime'];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }
}
