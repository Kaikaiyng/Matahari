<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Services\Billing\FeeRecordCategoryMapper;
use App\Services\Billing\FeeRecordCategoryMonthlyService;
use App\Services\Billing\FeeRecordChargeGenerationService;
use App\Services\Billing\FeeRecordSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FeeRecordController extends Controller
{
    public function categoryMonthly(
        Request $request,
        FeeRecordCategoryMonthlyService $service,
        FeeRecordCategoryMapper $categoryMapper,
    ): JsonResponse {
        $data = $request->validate([
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}$/'],
            'category' => ['required', 'string', Rule::in($categoryMapper->categories())],
            'level_group' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
            'student_status' => ['nullable', 'string', 'in:active,withdraw,graduate,inactive'],
            'outstanding_only' => ['nullable', 'in:true,false,1,0'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $filters = [
            'academic_year' => $data['academic_year'] ?? now()->format('Y'),
            'category' => $data['category'],
            'level_group' => $data['level_group'] ?? null,
            'class_id' => isset($data['class_id']) ? (int) $data['class_id'] : null,
            'student_status' => $data['student_status'] ?? 'active',
            'outstanding_only' => filter_var($data['outstanding_only'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'search' => $data['search'] ?? null,
        ];

        return response()->json([
            'data' => $service->monthly($request->user()?->school_id, $filters),
            'meta' => [
                'filters' => $filters,
                'categories' => $categoryMapper->categories(),
                'category_mapper' => 'temporary_fee_record_mapper_v0_1',
            ],
        ]);
    }

    public function summary(Request $request, FeeRecordSummaryService $service): JsonResponse
    {
        $data = $request->validate([
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}$/'],
            'level_group' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
            'student_status' => ['nullable', 'string', 'in:active,withdraw,graduate,inactive'],
            'outstanding_only' => ['nullable', 'in:true,false,1,0'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $filters = [
            'academic_year' => $data['academic_year'] ?? now()->format('Y'),
            'level_group' => $data['level_group'] ?? null,
            'class_id' => isset($data['class_id']) ? (int) $data['class_id'] : null,
            'student_status' => $data['student_status'] ?? 'active',
            'outstanding_only' => filter_var($data['outstanding_only'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'search' => $data['search'] ?? null,
        ];

        return response()->json([
            'data' => $service->summary($request->user()?->school_id, $filters),
            'meta' => ['filters' => $filters],
        ]);
    }

    public function preview(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json($service->preview($student, $data['academic_year']));
    }

    public function activate(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json($service->activate($student, $data['academic_year']), 201);
    }

    public function outstanding(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json(['data' => $service->outstanding($student, $data['academic_year'])]);
    }

    private function assertSchoolScope(Request $request, Student $student): void
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function academicYearRules(): array
    {
        return [
            'academic_year' => ['required', 'string', 'regex:/^\d{4}$/'],
        ];
    }
}
