<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    protected $fillable = ['school_id', 'subject_id', 'assessment_id', 'owner_user_id', 'practice_owner_student_id', 'quiz_kind', 'title', 'instructions', 'status', 'revision_of_id', 'version_number', 'published_at'];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('position');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(QuizAssignment::class);
    }
}
