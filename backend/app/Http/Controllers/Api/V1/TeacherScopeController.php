<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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
}
