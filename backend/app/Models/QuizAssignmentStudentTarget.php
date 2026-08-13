<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAssignmentStudentTarget extends Model
{
    protected $fillable = ['school_id', 'quiz_assignment_id', 'student_id'];
}
