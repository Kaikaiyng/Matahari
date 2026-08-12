<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\TeachingAssignment;
use App\Services\Foundation\TeachingAssignmentService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeachingAssignmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer'],
            'teacher_user_id' => ['nullable', 'integer'],
            'class_id' => ['nullable', 'integer'],
        ]);
        $items = TeachingAssignment::query()
            ->with(['academicYear', 'schoolClass', 'subject', 'teacher'])
            ->where('school_id', SchoolContext::fromRequest($request)->schoolId)
            ->where('academic_year_id', $data['academic_year_id'])
            ->when($data['teacher_user_id'] ?? null, fn ($query, $id) => $query->where('teacher_user_id', $id))
            ->when($data['class_id'] ?? null, fn ($query, $id) => $query->where('class_id', $id))
            ->orderByDesc('current_slot')->orderBy('class_id')->orderBy('subject_id')->get();

        return response()->json(['data' => $items->map(fn (TeachingAssignment $item) => $this->response($item))]);
    }

    public function store(Request $request, TeachingAssignmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'teacher_user_id' => ['required', 'integer', 'exists:users,id'],
            'starts_on' => ['nullable', 'date'],
        ]);
        $item = $service->create(
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $this->response($item)], 201);
    }

    public function end(Request $request, TeachingAssignment $teachingAssignment, TeachingAssignmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        if ((int) $teachingAssignment->school_id !== SchoolContext::fromRequest($request)->schoolId) {
            abort(403, 'Teaching assignment belongs to a different school.');
        }
        $this->authorize('update', $teachingAssignment);
        $data = $request->validate(['ended_on' => ['required', 'date']]);
        $item = $service->end($teachingAssignment, $data['ended_on'], $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($item)]);
    }

    private function response(TeachingAssignment $item): array
    {
        return [
            'id' => $item->id, 'school_id' => $item->school_id, 'academic_year_id' => $item->academic_year_id,
            'class_id' => $item->class_id, 'subject_id' => $item->subject_id, 'teacher_user_id' => $item->teacher_user_id,
            'starts_on' => $item->starts_on?->toDateString(), 'ended_on' => $item->ended_on?->toDateString(),
            'status' => $item->status, 'is_current' => $item->current_slot === 1,
        ];
    }
}
