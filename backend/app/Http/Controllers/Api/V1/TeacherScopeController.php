<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\TeachingAssignment;
use App\Services\Foundation\TeacherScopeService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherScopeController extends Controller
{
    public function assignments(Request $request, TeacherScopeService $service): JsonResponse
    {
        SchoolContext::fromRequest($request);

        return response()->json(['data' => $service->assignments($request->user())->map(fn (TeachingAssignment $item) => [
            'id' => $item->id,
            'academic_year' => ['id' => $item->academicYear->id, 'code' => $item->academicYear->code],
            'class' => ['id' => $item->schoolClass->id, 'name' => $item->schoolClass->name],
            'subject' => ['id' => $item->subject->id, 'code' => $item->subject->code, 'name' => $item->subject->name],
        ])]);
    }

    public function students(Request $request, SchoolClass $schoolClass, TeacherScopeService $service): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
        ]);
        $students = $service->students($request->user(), $schoolClass, $data['academic_year_id'], $data['subject_id']);

        return response()->json(['data' => $students->map(fn ($student) => [
            'id' => $student->id,
            'student_no' => $student->student_no,
            'full_name' => $student->full_name,
        ])->values()]);
    }

    public function schoolAssignments(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $items = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->whereNull('ended_at')
            ->with(['academicYear', 'schoolClass', 'subject'])
            ->orderBy('class_id')->orderBy('subject_id')->get();

        return response()->json(['data' => $items->map(fn (TeachingAssignment $item) => [
            'id' => $item->id,
            'academic_year' => ['id' => $item->academicYear->id, 'code' => $item->academicYear->code],
            'class' => ['id' => $item->schoolClass->id, 'name' => $item->schoolClass->name],
            'subject' => ['id' => $item->subject->id, 'code' => $item->subject->code, 'name' => $item->subject->name],
        ])]);
    }

    public function schoolStudents(Request $request, TeachingAssignment $teachingAssignment): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        abort_unless((int) $teachingAssignment->school_id === $schoolId, 403, 'Teaching assignment belongs to a different school.');
        $students = ClassEnrolment::query()
            ->where('school_id', $schoolId)
            ->where('academic_year_id', $teachingAssignment->academic_year_id)
            ->where('class_id', $teachingAssignment->class_id)
            ->where('status', 'active')->where('current_slot', 1)->with('student')->get()->pluck('student')->filter();

        return response()->json(['data' => $students->map(fn ($student) => [
            'id' => $student->id, 'student_no' => $student->student_no, 'full_name' => $student->full_name,
        ])->values()]);
    }
}
