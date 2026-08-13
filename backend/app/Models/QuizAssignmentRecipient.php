<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAssignmentRecipient extends Model
{
    protected $fillable = ['school_id', 'quiz_assignment_id', 'student_id', 'eligibility_source', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }
}
