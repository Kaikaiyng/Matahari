<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFeeAgreementRequest;
use App\Models\FeeAgreement;
use App\Models\Student;
use App\Services\FeeAgreements\FeeAgreementVersioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentFeeAgreementController extends Controller
{
    public function index(Request $request, Student $student): JsonResponse
    {
        $this->assertSchoolScope($request, $student);

        $agreements = $student->feeAgreements()
            ->with(['items', 'discounts.selectedItems'])
            ->orderByDesc('academic_year')
            ->orderByDesc('version_no')
            ->get()
            ->map(fn (FeeAgreement $agreement) => $this->feeAgreementResponse($agreement));

        return response()->json(['data' => $agreements]);
    }

    public function store(
        StoreFeeAgreementRequest $request,
        Student $student,
        FeeAgreementVersioningService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);

        $agreement = $service->createCurrent($student, $request->validated(), $request->user()?->id);

        return response()->json(['fee_agreement' => $this->feeAgreementResponse($agreement)], 201);
    }

    private function assertSchoolScope(Request $request, Student $student): void
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function feeAgreementResponse(FeeAgreement $agreement): array
    {
        $agreement->loadMissing(['student', 'items', 'discounts.selectedItems']);

        return [
            'id' => $agreement->id,
            'academic_year' => $agreement->academic_year,
            'version_no' => $agreement->version_no,
            'payment_plan' => $agreement->payment_plan,
            'effective_from' => $agreement->effective_from->toDateString(),
            'effective_to' => $agreement->effective_to?->toDateString(),
            'is_current' => $agreement->is_current,
            'status' => $agreement->status,
            'remarks' => $agreement->remarks,
            'student' => [
                'id' => $agreement->student->id,
                'student_no' => $agreement->student->student_no,
                'full_name' => $agreement->student->full_name,
            ],
            'items' => $agreement->items->map(fn ($item) => [
                'id' => $item->id,
                'fee_item_id' => $item->fee_item_id,
                'fee_code' => $item->fee_code,
                'fee_category' => $item->fee_category,
                'description' => $item->description,
                'amount' => (float) $item->amount,
                'is_mandatory' => $item->is_mandatory,
            ])->values(),
            'discounts' => $agreement->discounts->map(fn ($discount) => [
                'id' => $discount->id,
                'discount_label' => $discount->discount_label,
                'discount_type' => $discount->discount_type,
                'scope' => $discount->scope,
                'value' => (float) $discount->value,
                'remark' => $discount->remark,
                'selected_fee_codes' => $discount->selectedItems->pluck('fee_code')->values(),
            ])->values(),
        ];
    }
}
