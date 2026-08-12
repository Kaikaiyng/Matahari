<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Services\Foundation\AcademicYearService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AcademicYearController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $years = AcademicYear::query()->where('school_id', $schoolId)->orderByDesc('code')->get();

        return response()->json(['data' => $years->map(fn (AcademicYear $year) => $this->response($year))]);
    }

    public function store(Request $request, AcademicYearService $service, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('academic_years')->where('school_id', $schoolId)],
            'name' => ['required', 'string', 'max:100'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);
        $year = $service->create($schoolId, $data, $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($year)], 201);
    }

    public function update(Request $request, AcademicYear $academicYear, AcademicYearService $service, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertContext($request, $academicYear);
        $this->authorize('update', $academicYear);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('academic_years')->where('school_id', $academicYear->school_id)->ignore($academicYear)],
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'starts_on' => ['sometimes', 'nullable', 'date'],
            'ends_on' => ['sometimes', 'nullable', 'date', 'after_or_equal:starts_on'],
            'status' => ['sometimes', 'string', Rule::in(['draft', 'closed', 'archived'])],
        ]);
        unset($data['current_slot']);

        return response()->json(['data' => $this->response($service->update($academicYear, $data, $contexts->fromRequest($request)))]);
    }

    public function activate(Request $request, AcademicYear $academicYear, AcademicYearService $service, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertContext($request, $academicYear);
        $this->authorize('update', $academicYear);

        return response()->json(['data' => $this->response($service->activate($academicYear, $contexts->fromRequest($request)))]);
    }

    private function assertContext(Request $request, AcademicYear $year): void
    {
        if ((int) $year->school_id !== SchoolContext::fromRequest($request)->schoolId) {
            abort(403, 'Academic year belongs to a different school.');
        }
    }

    private function response(AcademicYear $year): array
    {
        return [
            'id' => $year->id, 'school_id' => $year->school_id, 'code' => $year->code, 'name' => $year->name,
            'starts_on' => $year->starts_on?->toDateString(), 'ends_on' => $year->ends_on?->toDateString(),
            'status' => $year->status, 'is_current' => $year->current_slot === 1,
        ];
    }
}
