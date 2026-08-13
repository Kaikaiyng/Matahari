<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuizAttempt extends Model
{
    protected $fillable = ['school_id', 'quiz_id', 'quiz_assignment_id', 'student_id', 'attempt_context_key', 'attempt_number', 'status', 'started_at', 'submitted_at', 'scored_at', 'score', 'max_score', 'scored_by_user_id'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'submitted_at' => 'datetime', 'scored_at' => 'datetime', 'score' => 'decimal:2', 'max_score' => 'decimal:2'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(QuizAssignment::class, 'quiz_assignment_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(QuizAttemptAnswer::class);
    }
}
