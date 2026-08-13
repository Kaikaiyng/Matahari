<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAssignmentClassTarget extends Model
{
    protected $fillable = ['school_id', 'quiz_assignment_id', 'class_id'];
}
