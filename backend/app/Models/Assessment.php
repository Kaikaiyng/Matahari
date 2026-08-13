<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assessment extends Model
{
    protected $fillable = ['school_id', 'academic_year_id', 'academic_term_id', 'subject_id', 'created_by_user_id', 'title', 'assessment_type', 'max_score', 'due_at', 'status', 'published_at'];

    protected function casts(): array
    {
        return ['max_score' => 'decimal:2', 'due_at' => 'datetime', 'published_at' => 'datetime'];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function classTargets(): HasMany
    {
        return $this->hasMany(AssessmentClassTarget::class);
    }

    public function results(): HasMany
    {
        return $this->hasMany(AssessmentResult::class);
    }
}
