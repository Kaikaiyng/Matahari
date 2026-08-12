<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\ClassEnrolment;
use App\Services\Foundation\ClassEnrolmentService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassEnrolmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'integer'], 'class_id' => ['nullable', 'integer']]);
        $items = ClassEnrolment::query()
            ->with(['academicYear', 'schoolClass', 'student'])
            ->where('school_id', SchoolContext::fromRequest($request)->schoolId)
            ->where('academic_year_id', $data['academic_year_id'])
            ->when($data['class_id'] ?? null, fn ($query, $classId) => $query->where('class_id', $classId))
            ->orderByDesc('current_slot')->orderBy('student_id')->get();

        return response()->json(['data' => $items->map(fn (ClassEnrolment $item) => $this->response($item))]);
    }

    public function store(Request $request, ClassEnrolmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'student_id' => ['required', 'integer', 'exists:students,id'],
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

    public function end(Request $request, ClassEnrolment $classEnrolment, ClassEnrolmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertContext($request, $classEnrolment);
        $this->authorize('update', $classEnrolment);
        $data = $request->validate(['ended_on' => ['required', 'date']]);
        $item = $service->end($classEnrolment, $data['ended_on'], $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($item)]);
    }

    private function assertContext(Request $request, ClassEnrolment $item): void
    {
        if ((int) $item->school_id !== SchoolContext::fromRequest($request)->schoolId) {
            abort(403, 'Class enrolment belongs to a different school.');
        }
    }

    private function response(ClassEnrolment $item): array
    {
        return [
            'id' => $item->id, 'school_id' => $item->school_id, 'academic_year_id' => $item->academic_year_id,
            'class_id' => $item->class_id, 'student_id' => $item->student_id,
            'starts_on' => $item->starts_on?->toDateString(), 'ended_on' => $item->ended_on?->toDateString(),
            'status' => $item->status, 'is_current' => $item->current_slot === 1,
        ];
    }
}
