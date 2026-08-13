<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttemptAnswer extends Model
{
    protected $fillable = ['quiz_attempt_id', 'quiz_question_id', 'quiz_option_id', 'is_correct', 'awarded_points', 'answered_at'];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean', 'awarded_points' => 'decimal:2', 'answered_at' => 'datetime'];
    }
}
