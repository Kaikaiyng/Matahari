<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentResult extends Model
{
    protected $fillable = ['school_id', 'assessment_id', 'student_id', 'score', 'grade_label', 'teacher_comment', 'status', 'assessed_by_user_id', 'published_at'];

    protected function casts(): array
    {
        return ['score' => 'decimal:2', 'published_at' => 'datetime'];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
