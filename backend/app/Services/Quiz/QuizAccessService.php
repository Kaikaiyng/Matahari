<?php

namespace App\Services\Quiz;

use App\Models\Quiz;
use App\Models\TeachingAssignment;
use App\Models\User;

class QuizAccessService
{
    public function assertCanAuthor(User $actor, int $schoolId, ?int $subjectId = null, array $classIds = [], ?int $academicYearId = null): void
    {
        if ($actor->hasPermissionTo('quizzes.manage_school')) {
            return;
        }
        abort_unless($subjectId && $classIds !== [], 403, 'Teachers require subject and class targets.');
        $allowed = TeachingAssignment::query()->where('school_id', $schoolId)->where('teacher_user_id', $actor->id)->where('subject_id', $subjectId)->when($academicYearId, fn ($query) => $query->where('academic_year_id', $academicYearId))->where('status', 'active')->where('current_slot', 1)->whereIn('class_id', $classIds)->pluck('class_id')->map(fn ($id) => (int) $id)->all();
        abort_if(array_diff($classIds, $allowed) !== [], 403, 'Quiz target is outside the teacher assignment scope.');
    }

    public function assertOwns(User $actor, int $schoolId, Quiz $quiz): void
    {
        abort_unless((int) $quiz->school_id === $schoolId, 403, 'Quiz belongs to a different school.');
        if (! $actor->hasPermissionTo('quizzes.manage_school')) {
            abort_unless((int) $quiz->owner_user_id === (int) $actor->id, 403, 'Quiz belongs to another author.');
        }
    }
}
