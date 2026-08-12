<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicYear extends Model
{
    protected $fillable = ['school_id', 'code', 'name', 'starts_on', 'ends_on', 'status', 'current_slot'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function classEnrolments(): HasMany
    {
        return $this->hasMany(ClassEnrolment::class);
    }

    public function teachingAssignments(): HasMany
    {
        return $this->hasMany(TeachingAssignment::class);
    }
}
