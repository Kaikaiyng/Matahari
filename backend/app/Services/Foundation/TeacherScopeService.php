<?php

namespace App\Services\Foundation;

use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Collection;

class TeacherScopeService
{
    public function assignments(User $teacher): Collection
    {
        return TeachingAssignment::query()
            ->with(['academicYear', 'schoolClass', 'subject'])
            ->where('school_id', $teacher->school_id)
            ->where('teacher_user_id', $teacher->id)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->orderBy('academic_year_id')
            ->orderBy('class_id')
            ->orderBy('subject_id')
            ->get();
    }

    public function students(User $teacher, SchoolClass $class, int $academicYearId, int $subjectId): Collection
    {
        if ((int) $class->school_id !== (int) $teacher->school_id) {
            abort(403, 'Class belongs to a different school.');
        }

        $authorized = TeachingAssignment::query()
            ->where('school_id', $teacher->school_id)
            ->where('teacher_user_id', $teacher->id)
            ->where('academic_year_id', $academicYearId)
            ->where('class_id', $class->id)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->exists();

        if (! $authorized) {
            abort(403, 'This class and subject are outside the teacher assignment scope.');
        }

        return ClassEnrolment::query()
            ->with('student')
            ->where('school_id', $teacher->school_id)
            ->where('academic_year_id', $academicYearId)
            ->where('class_id', $class->id)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->orderBy('student_id')
            ->get()
            ->pluck('student')
            ->filter();
    }
}
