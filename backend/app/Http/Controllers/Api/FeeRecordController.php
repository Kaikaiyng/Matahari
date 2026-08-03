<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreManualFeeRecordChargeRequest;
use App\Models\FeeRecordCharge;
use App\Models\Student;
use App\Services\Billing\FeeRecordCategoryMapper;
use App\Services\Billing\FeeRecordCategoryMonthlyService;
use App\Services\Billing\FeeRecordChargeGenerationService;
use App\Services\Billing\FeeRecordManualChargeService;
use App\Services\Billing\FeeRecordSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
            'billing_month' => ['nullable', 'string', 'date_format:Y-m'],
            'level_group' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
            'student_status' => ['nullable', 'string', 'in:active,withdraw,graduate,inactive'],
            'outstanding_only' => ['nullable', 'in:true,false,1,0'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $academicYear = $data['academic_year'] ?? now()->format('Y');
        $billingMonth = $data['billing_month'] ?? null;

        if ($billingMonth && ! str_starts_with($billingMonth, $academicYear.'-')) {
            throw ValidationException::withMessages([
                'billing_month' => 'The billing month must belong to the selected academic year.',
            ]);
        }

        $filters = [
            'academic_year' => $academicYear,
            'billing_month' => $billingMonth,
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
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json($service->activate(
            $student,
            $data['academic_year'],
            $request->user(),
            $contextFactory->fromRequest($request),
        ), 201);
    }

    public function storeManualCharge(
        StoreManualFeeRecordChargeRequest $request,
        Student $student,
        FeeRecordManualChargeService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);

        $charge = $service->create(
            $student,
            $request->validated(),
            $request->user(),
            $contextFactory->fromRequest($request),
        );

        return response()->json(['data' => $this->chargeResponse($charge)], 201);
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

    /**
     * @return array<string, mixed>
     */
    private function chargeResponse(FeeRecordCharge $charge): array
    {
        return [
            'id' => $charge->id,
            'school_id' => $charge->school_id,
            'student_id' => $charge->student_id,
            'fee_agreement_id' => $charge->fee_agreement_id,
            'fee_agreement_item_id' => $charge->fee_agreement_item_id,
            'fee_item_id' => $charge->fee_item_id,
            'academic_year' => $charge->academic_year,
            'billing_month' => $charge->billing_month,
            'fee_record_category' => $charge->fee_record_category,
            'fee_code' => $charge->fee_code,
            'description' => $charge->description,
            'remark' => $charge->remark,
            'expected_amount' => (float) $charge->expected_amount,
            'paid_amount' => (float) $charge->paid_amount_cached,
            'outstanding_amount' => (float) $charge->outstanding_amount_cached,
            'billing_status' => $charge->billing_status,
            'collection_status' => $charge->collection_status,
            'charge_origin' => $charge->charge_origin,
            'source_type' => $charge->source_type,
            'skipped_reason' => $charge->skipped_reason,
            'activated_at' => $charge->activated_at?->toISOString(),
        ];
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
