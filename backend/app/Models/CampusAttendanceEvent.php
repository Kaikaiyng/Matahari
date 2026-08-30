<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class CampusAttendanceEvent extends Model
{
    protected $fillable = ['school_id', 'student_id', 'attendance_device_id', 'direction', 'method', 'event_date', 'event_time', 'occurred_at', 'source', 'external_event_id', 'note', 'recorded_by'];

    protected function casts(): array
    {
        return ['event_date' => 'date', 'occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Campus Attendance events are immutable.'));
        static::deleting(fn () => throw new LogicException('Campus Attendance events cannot be deleted.'));
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(AttendanceDevice::class, 'attendance_device_id');
    }
}
