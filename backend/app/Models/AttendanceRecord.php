<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceRecord extends Model
{
    protected $fillable = [
        'school_id', 'attendance_session_id', 'student_id', 'status', 'public_note',
        'marked_by', 'corrected_by', 'correction_reason', 'corrected_at',
    ];

    protected function casts(): array
    {
        return ['corrected_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(AttendanceSession::class, 'attendance_session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
