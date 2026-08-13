<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\ClassScheduleEntry;
use App\Services\Schedule\ClassScheduleService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClassScheduleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'integer'], 'class_id' => ['nullable', 'integer']]);
        $items = ClassScheduleEntry::query()->with(['academicYear', 'schoolClass', 'subject', 'teachingAssignment.teacher'])->where('school_id', SchoolContext::fromRequest($request)->schoolId)
            ->where('academic_year_id', $data['academic_year_id'])->when($data['class_id'] ?? null, fn ($query, $id) => $query->where('class_id', $id))->orderBy('day_of_week')->orderBy('starts_at')->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, ClassScheduleService $service, AuditContextFactory $contexts): JsonResponse
    {
        $entry = $service->create(SchoolContext::fromRequest($request)->schoolId, $this->validated($request), $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $entry], 201);
    }

    public function update(Request $request, ClassScheduleEntry $classScheduleEntry, ClassScheduleService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['sometimes', 'integer'], 'class_id' => ['sometimes', 'integer'], 'subject_id' => ['sometimes', 'nullable', 'integer'], 'teaching_assignment_id' => ['sometimes', 'nullable', 'integer'],
            'title' => ['sometimes', 'string', 'max:150'], 'day_of_week' => ['sometimes', 'integer', 'between:1,7'], 'starts_at' => ['sometimes', 'date_format:H:i'], 'ends_at' => ['sometimes', 'date_format:H:i', 'after:starts_at'],
            'location' => ['sometimes', 'nullable', 'string', 'max:150'], 'effective_from' => ['sometimes', 'nullable', 'date'], 'effective_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:effective_from'], 'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
        ]);

        return response()->json(['data' => $service->update(SchoolContext::fromRequest($request)->schoolId, $classScheduleEntry, $data, $contexts->fromRequest($request))]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'academic_year_id' => ['required', 'integer'], 'class_id' => ['required', 'integer'], 'subject_id' => ['nullable', 'integer'], 'teaching_assignment_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:150'], 'day_of_week' => ['required', 'integer', 'between:1,7'], 'starts_at' => ['required', 'date_format:H:i'], 'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
            'location' => ['nullable', 'string', 'max:150'], 'effective_from' => ['nullable', 'date'], 'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'], 'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
        ]);
    }
}
