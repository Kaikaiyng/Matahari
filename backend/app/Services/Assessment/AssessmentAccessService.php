<?php

namespace App\Services\Assessment;

use App\Models\Assessment;
use App\Models\TeachingAssignment;
use App\Models\User;

class AssessmentAccessService
{
    public function assertCanManageTargets(User $actor, int $schoolId, int $yearId, int $subjectId, array $classIds): void
    {
        if ($actor->hasPermissionTo('assessments.manage_school')) {
            return;
        }

        $authorized = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('teacher_user_id', $actor->id)
            ->where('academic_year_id', $yearId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->whereIn('class_id', $classIds)
            ->pluck('class_id')->map(fn ($id) => (int) $id)->unique()->all();

        if (array_diff($classIds, $authorized) !== []) {
            abort(403, 'One or more classes are outside the teacher assignment scope.');
        }
    }

    public function assertCanManage(User $actor, int $schoolId, Assessment $assessment): void
    {
        if ((int) $assessment->school_id !== $schoolId) {
            abort(403, 'Assessment belongs to a different school.');
        }

        $this->assertCanManageTargets(
            $actor,
            $schoolId,
            $assessment->academic_year_id,
            $assessment->subject_id,
            $assessment->classTargets()->pluck('class_id')->map(fn ($id) => (int) $id)->all(),
        );
    }
}
