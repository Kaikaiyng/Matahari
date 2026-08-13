<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuizAssignment extends Model
{
    protected $fillable = ['school_id', 'academic_year_id', 'quiz_id', 'assigned_by_user_id', 'available_from', 'due_at', 'attempt_limit', 'status', 'published_at'];

    protected function casts(): array
    {
        return ['available_from' => 'datetime', 'due_at' => 'datetime', 'published_at' => 'datetime'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function classTargets(): HasMany
    {
        return $this->hasMany(QuizAssignmentClassTarget::class);
    }

    public function studentTargets(): HasMany
    {
        return $this->hasMany(QuizAssignmentStudentTarget::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(QuizAssignmentRecipient::class);
    }
}
