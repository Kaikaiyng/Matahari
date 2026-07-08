<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\VerifyPaymentRequest;
use App\Http\Requests\VoidPaymentRequest;
use App\Models\Payment;
use App\Models\Student;
use App\Services\Billing\PaymentRecordingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request, Student $student): JsonResponse
    {
        $this->assertSchoolScope($request, $student);

        $payments = $student->payments()
            ->with(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy', 'issuedReceipt'])
            ->latest('payment_date')
            ->latest('id')
            ->get()
            ->map(fn (Payment $payment) => $this->paymentResponse($payment));

        return response()->json(['data' => $payments]);
    }

    public function store(
        StorePaymentRequest $request,
        Student $student,
        PaymentRecordingService $service,
    ): JsonResponse {
        $payment = $service->createForStudent($student, $request->validated(), $request->user());

        return response()->json(['payment' => $this->paymentResponse($payment)], 201);
    }

    public function verify(
        VerifyPaymentRequest $request,
        Payment $payment,
        PaymentRecordingService $service,
    ): JsonResponse {
        $payment = $service->verify($payment, $request->validated(), $request->user());

        return response()->json(['payment' => $this->paymentResponse($payment)]);
    }

    public function void(
        VoidPaymentRequest $request,
        Payment $payment,
        PaymentRecordingService $service,
    ): JsonResponse {
        $payment = $service->void($payment, $request->validated('void_reason'), $request->user());

        return response()->json(['payment' => $this->paymentResponse($payment)]);
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
    private function paymentResponse(Payment $payment): array
    {
        $payment->loadMissing(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy', 'issuedReceipt']);

        return [
            'id' => $payment->id,
            'school_id' => $payment->school_id,
            'student_id' => $payment->student_id,
            'payment_method' => $payment->payment_method,
            'payment_date' => $payment->payment_date->toDateString(),
            'received_date' => $payment->received_date?->toDateString(),
            'amount' => (float) $payment->amount,
            'paid_by' => $payment->paid_by,
            'bank_account' => $payment->bank_account,
            'reference_no' => $payment->reference_no,
            'payment_proof' => $payment->payment_proof,
            'remark' => $payment->remark,
            'status' => $payment->status,
            'recorded_by' => $this->userResponse($payment->recordedBy),
            'verified_by' => $this->userResponse($payment->verifiedBy),
            'verified_at' => $payment->verified_at?->toISOString(),
            'voided_by' => $this->userResponse($payment->voidedBy),
            'voided_at' => $payment->voided_at?->toISOString(),
            'void_reason' => $payment->void_reason,
            'issued_receipt' => $payment->issuedReceipt ? [
                'id' => $payment->issuedReceipt->id,
                'receipt_no' => $payment->issuedReceipt->receipt_no,
                'receipt_date' => $payment->issuedReceipt->receipt_date->toDateString(),
                'status' => $payment->issuedReceipt->status,
            ] : null,
            'allocations' => $payment->allocations->map(fn ($allocation) => [
                'id' => $allocation->id,
                'fee_item_id' => $allocation->fee_item_id,
                'fee_agreement_item_id' => $allocation->fee_agreement_item_id,
                'fee_record_charge_id' => $allocation->fee_record_charge_id,
                'allocation_type' => $allocation->allocation_type,
                'fee_code' => $allocation->fee_code,
                'description' => $allocation->description,
                'amount' => (float) $allocation->amount,
                'sort_order' => $allocation->sort_order,
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
