<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Http\Requests\GenerateReceiptRequest;
use App\Http\Requests\VoidReceiptRequest;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Student;
use App\Services\Billing\ReceiptGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function index(Request $request, Student $student): JsonResponse
    {
        $this->assertSchoolScope($request, $student->school_id);

        $receipts = $student->receipts()
            ->with(['items', 'issuedBy', 'voidedBy'])
            ->latest('receipt_date')
            ->latest('id')
            ->get()
            ->map(fn (Receipt $receipt) => $this->receiptResponse($receipt));

        return response()->json(['data' => $receipts]);
    }

    public function store(
        GenerateReceiptRequest $request,
        Payment $payment,
        ReceiptGenerationService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $receipt = $service->generate(
            $payment,
            $request->validated(),
            $request->user(),
            $contextFactory->fromRequest($request),
        );

        return response()->json(['receipt' => $this->receiptResponse($receipt)], 201);
    }

    public function show(Request $request, Receipt $receipt): JsonResponse
    {
        $this->assertSchoolScope($request, $receipt->school_id);

        return response()->json(['receipt' => $this->receiptResponse($receipt)]);
    }

    public function print(Request $request, Receipt $receipt): JsonResponse
    {
        $this->assertSchoolScope($request, $receipt->school_id);

        return response()->json(['receipt' => $this->receiptResponse($receipt)]);
    }

    public function void(
        VoidReceiptRequest $request,
        Receipt $receipt,
        ReceiptGenerationService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $receipt = $service->void(
            $receipt,
            $request->validated('void_reason'),
            $request->user(),
            $contextFactory->fromRequest($request),
        );

        return response()->json(['receipt' => $this->receiptResponse($receipt)]);
    }

    private function assertSchoolScope(Request $request, int $schoolId): void
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $schoolId !== (int) $userSchoolId) {
            abort(403, 'Receipt belongs to a different school.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function receiptResponse(Receipt $receipt): array
    {
        $receipt->loadMissing(['items', 'issuedBy', 'voidedBy']);

        return [
            'id' => $receipt->id,
            'school_id' => $receipt->school_id,
            'payment_id' => $receipt->payment_id,
            'active_payment_id' => $receipt->active_payment_id,
            'student_id' => $receipt->student_id,
            'student_no' => $receipt->student_no,
            'student_name' => $receipt->student_name,
            'paid_by' => $receipt->paid_by,
            'payment_method' => $receipt->payment_method,
            'payment_date' => $receipt->payment_date->toDateString(),
            'received_date' => $receipt->received_date?->toDateString(),
            'receipt_date' => $receipt->receipt_date->toDateString(),
            'receipt_no' => $receipt->receipt_no,
            'amount' => (float) $receipt->amount,
            'amount_in_words' => $receipt->amount_in_words,
            'issued_by' => $this->userResponse($receipt->issuedBy),
            'issued_at' => $receipt->issued_at?->toISOString(),
            'status' => $receipt->status,
            'voided_by' => $this->userResponse($receipt->voidedBy),
            'voided_at' => $receipt->voided_at?->toISOString(),
            'void_reason' => $receipt->void_reason,
            'items' => $receipt->items->map(fn ($item) => [
                'id' => $item->id,
                'payment_allocation_id' => $item->payment_allocation_id,
                'fee_code' => $item->fee_code,
                'description' => $item->description,
                'amount' => (float) $item->amount,
                'sort_order' => $item->sort_order,
            ])->values(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function userResponse(mixed $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
        ];
    }
}
