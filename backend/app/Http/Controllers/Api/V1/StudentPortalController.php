<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClassEnrolment;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentPortalController extends Controller
{
    /**
     * Return the authenticated user's linked student record.
     */
    public function me(Request $request): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $student = $this->resolveStudent($request);

        if (! $student) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'id' => $student->id,
                'student_no' => $student->student_no,
                'full_name' => $student->full_name,
                'gender' => $student->gender,
                'dob' => $student->dob?->toDateString(),
                'status' => $student->status,
                'class' => $student->class
                    ? ['id' => $student->class->id, 'name' => $student->class->name]
                    : null,
            ],
        ]);
    }

    /**
     * Return the authenticated student's active class enrolments,
     * including subjects taught in that class via teaching_assignments.
     */
    public function enrolments(Request $request): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $student = $this->resolveStudent($request);

        if (! $student) {
            return response()->json(['data' => []]);
        }

        // Get current (non-ended) class enrolments
        $enrolments = $student->classEnrolments()
            ->with(['academicYear', 'schoolClass'])
            ->whereNull('ended_at')
            ->get();

        $result = $enrolments->map(function (ClassEnrolment $e) use ($student) {
            // Find subjects taught in this class/year combination
            $subjects = TeachingAssignment::where('school_id', $student->school_id)
                ->where('academic_year_id', $e->academic_year_id)
                ->where('class_id', $e->class_id)
                ->where('status', 'active')
                ->with(['subject', 'teacher'])
                ->get()
                ->map(fn (TeachingAssignment $ta) => [
                    'subject_id' => $ta->subject?->id,
                    'subject_code' => $ta->subject?->code,
                    'subject_name' => $ta->subject?->name,
                    'teacher_name' => $ta->teacher?->name,
                ]);

            return [
                'id' => $e->id,
                'academic_year' => $e->academicYear
                    ? ['id' => $e->academicYear->id, 'code' => $e->academicYear->code, 'name' => $e->academicYear->name]
                    : null,
                'class' => $e->schoolClass
                    ? ['id' => $e->schoolClass->id, 'name' => $e->schoolClass->name]
                    : null,
                'starts_on' => $e->starts_on?->toDateString(),
                'status' => $e->status,
                'subjects' => $subjects->values(),
            ];
        });

        return response()->json(['data' => $result->values()]);
    }

    private function resolveStudent(Request $request): ?Student
    {
        $user = $request->user();

        return Student::where('user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->with('class')
            ->first();
    }
}
