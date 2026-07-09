<?php

namespace App\Services\Billing;

use App\Models\FeeAgreementItem;
use App\Models\FeeRecordCharge;
use App\Models\FeeItem;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentRecordingService
{
    /**
     * @param array<string, mixed> $data
     */
    public function createForStudent(Student $student, array $data, User $recordedBy): Payment
    {
        $this->assertSchoolScope($student, $recordedBy);
        $this->assertAllocationTotal((float) $data['amount'], $data['allocations'] ?? []);

        return DB::transaction(function () use ($student, $data, $recordedBy): Payment {
            $isCash = $data['payment_method'] === 'cash';

            $payment = Payment::query()->create([
                'school_id' => $student->school_id,
                'student_id' => $student->id,
                'payment_method' => $data['payment_method'],
                'payment_date' => $data['payment_date'],
                'received_date' => $data['received_date'] ?? null,
                'amount' => $data['amount'],
                'paid_by' => $data['paid_by'] ?? null,
                'bank_account' => $data['bank_account'] ?? null,
                'reference_no' => $data['reference_no'] ?? null,
                'payment_proof' => $data['payment_proof'] ?? null,
                'remark' => $data['remark'] ?? null,
                'status' => $isCash ? 'verified' : 'pending_verification',
                'recorded_by' => $recordedBy->id,
                'verified_by' => $isCash ? $recordedBy->id : null,
                'verified_at' => $isCash ? now() : null,
            ]);

            foreach (array_values($data['allocations']) as $index => $allocation) {
                $payment->allocations()->create([
                    ...$this->allocationSnapshot($student, $allocation, $data['academic_year'] ?? null),
                    'school_id' => $student->school_id,
                    'amount' => $allocation['amount'],
                    'sort_order' => $index,
                ]);
            }

            if ($isCash) {
                $this->applyChargeAllocations($payment->refresh()->load('allocations'));
            }

            return $payment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy', 'issuedReceipt']);
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function verify(Payment $payment, array $data, User $verifiedBy): Payment
    {
        return DB::transaction(function () use ($payment, $data, $verifiedBy): Payment {
            $lockedPayment = Payment::query()
                ->with(['student', 'allocations'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertSchoolScope($lockedPayment->student, $verifiedBy);

            if ($lockedPayment->status === 'voided') {
                throw ValidationException::withMessages(['payment' => 'Voided payments cannot be verified.']);
            }

            if ($lockedPayment->status === 'verified') {
                throw ValidationException::withMessages(['payment' => 'Payment is already verified.']);
            }

            if ($lockedPayment->status !== 'pending_verification') {
                throw ValidationException::withMessages(['payment' => 'Only pending payments can be verified.']);
            }

            $this->applyChargeAllocations($lockedPayment);

            $lockedPayment->update([
                'status' => 'verified',
                'received_date' => $data['received_date'],
                'bank_account' => $data['bank_account'] ?? $lockedPayment->bank_account,
                'reference_no' => $data['reference_no'] ?? $lockedPayment->reference_no,
                'remark' => $data['remark'] ?? $lockedPayment->remark,
                'verified_by' => $verifiedBy->id,
                'verified_at' => now(),
            ]);

            return $lockedPayment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy', 'issuedReceipt']);
        });
    }

    public function void(Payment $payment, string $voidReason, User $voidedBy): Payment
    {
        return DB::transaction(function () use ($payment, $voidReason, $voidedBy): Payment {
            $lockedPayment = Payment::query()
                ->with(['student', 'allocations'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertSchoolScope($lockedPayment->student, $voidedBy);

            if ($lockedPayment->status === 'voided') {
                throw ValidationException::withMessages(['payment' => 'Payment is already voided.']);
            }

            $this->assertNoIssuedReceipt($lockedPayment);

            if ($lockedPayment->status === 'verified') {
                $this->reverseChargeAllocations($lockedPayment);
            }

            $lockedPayment->update([
                'status' => 'voided',
                'voided_by' => $voidedBy->id,
                'voided_at' => now(),
                'void_reason' => $voidReason,
            ]);

            return $lockedPayment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy', 'issuedReceipt']);
        });
    }

    private function assertSchoolScope(Student $student, User $user): void
    {
        if ($user->school_id && (int) $user->school_id !== (int) $student->school_id) {
            abort(403, 'Student belongs to a different school.');
        }
    }

    /**
     * @param array<int, array<string, mixed>> $allocations
     */
    private function assertAllocationTotal(float $paymentAmount, array $allocations): void
    {
        $paymentCents = $this->moneyToCents($paymentAmount);
        $allocationCents = collect($allocations)
            ->sum(fn (array $allocation) => $this->moneyToCents($allocation['amount'] ?? 0));

        if ($paymentCents !== $allocationCents) {
            throw ValidationException::withMessages(['allocations' => 'Allocation total must equal payment amount.']);
        }
    }

    /**
     * @param array<string, mixed> $allocation
     * @return array<string, mixed>
     */
    private function allocationSnapshot(Student $student, array $allocation, ?string $academicYear): array
    {
        $allocationType = $this->allocationType($allocation);

        if ($allocationType === 'charge') {
            $charge = $this->lockUsableCharge($student, $allocation, $academicYear);

            return [
                'fee_item_id' => $charge->fee_item_id,
                'fee_agreement_item_id' => $charge->fee_agreement_item_id,
                'fee_record_charge_id' => $charge->id,
                'allocation_type' => 'charge',
                'fee_code' => $charge->fee_code,
                'description' => $allocation['description'] ?? $charge->description,
            ];
        }

        if (! empty($allocation['fee_agreement_item_id'])) {
            $agreementItem = FeeAgreementItem::query()
                ->where('school_id', $student->school_id)
                ->whereHas('feeAgreement', fn ($query) => $query->where('student_id', $student->id))
                ->find($allocation['fee_agreement_item_id']);

            if (! $agreementItem) {
                throw ValidationException::withMessages([
                    'allocations' => 'Fee agreement item does not belong to this school.',
                ]);
            }

            return [
                'fee_item_id' => $agreementItem->fee_item_id,
                'fee_agreement_item_id' => $agreementItem->id,
                'fee_record_charge_id' => null,
                'allocation_type' => $allocationType,
                'fee_code' => $agreementItem->fee_code,
                'description' => $allocation['description'] ?? $agreementItem->description,
            ];
        }

        if (! empty($allocation['fee_item_id'])) {
            $feeItem = FeeItem::query()
                ->where('school_id', $student->school_id)
                ->find($allocation['fee_item_id']);

            if (! $feeItem) {
                throw ValidationException::withMessages([
                    'allocations' => 'Fee item does not belong to this school.',
                ]);
            }

            return [
                'fee_item_id' => $feeItem->id,
                'fee_agreement_item_id' => null,
                'fee_record_charge_id' => null,
                'allocation_type' => $allocationType,
                'fee_code' => $feeItem->code,
                'description' => $allocation['description'] ?? $feeItem->name,
            ];
        }

        return [
            'fee_item_id' => null,
            'fee_agreement_item_id' => null,
            'fee_record_charge_id' => null,
            'allocation_type' => $allocationType,
            'fee_code' => null,
            'description' => $allocation['description'],
        ];
    }

    /**
     * @param array<string, mixed> $allocation
     */
    private function allocationType(array $allocation): string
    {
        if (! empty($allocation['allocation_type'])) {
            return $allocation['allocation_type'];
        }

        if (! empty($allocation['fee_record_charge_id'])) {
            return 'charge';
        }

        if (! empty($allocation['fee_item_id']) || ! empty($allocation['fee_agreement_item_id'])) {
            return 'legacy';
        }

        return 'manual';
    }

    /**
     * @param array<string, mixed> $allocation
     */
    private function lockUsableCharge(Student $student, array $allocation, ?string $academicYear): FeeRecordCharge
    {
        $charge = FeeRecordCharge::query()
            ->whereKey($allocation['fee_record_charge_id'] ?? null)
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->lockForUpdate()
            ->first();

        if (! $charge) {
            throw ValidationException::withMessages([
                'allocations' => 'Fee Record charge cell does not belong to this student.',
            ]);
        }

        if ($academicYear && $charge->academic_year !== $academicYear) {
            throw ValidationException::withMessages([
                'allocations' => 'Fee Record charge cell does not match the selected academic year.',
            ]);
        }

        $this->assertChargeCanAcceptAllocation($charge, (float) $allocation['amount']);

        return $charge;
    }

    private function assertChargeCanAcceptAllocation(FeeRecordCharge $charge, float $amount): void
    {
        if ($charge->billing_status !== 'billable') {
            throw ValidationException::withMessages([
                'allocations' => 'Only billable Fee Record charge cells can receive payments.',
            ]);
        }

        if ($this->moneyToCents($charge->outstanding_amount_cached) <= 0) {
            throw ValidationException::withMessages([
                'allocations' => 'Fee Record charge cell has no outstanding amount.',
            ]);
        }

        if ($this->moneyToCents($amount) > $this->moneyToCents($charge->outstanding_amount_cached)) {
            throw ValidationException::withMessages([
                'allocations' => 'Allocation amount cannot exceed Fee Record charge outstanding amount.',
            ]);
        }
    }

    private function assertNoIssuedReceipt(Payment $payment): void
    {
        $hasIssuedReceipt = Receipt::query()
            ->where('school_id', $payment->school_id)
            ->where('payment_id', $payment->id)
            ->where('status', 'issued')
            ->exists();

        if ($hasIssuedReceipt) {
            throw ValidationException::withMessages([
                'payment' => 'Void the issued receipt before voiding this payment.',
            ]);
        }
    }

    private function applyChargeAllocations(Payment $payment): void
    {
        foreach ($payment->allocations as $allocation) {
            if ($allocation->allocation_type !== 'charge') {
                continue;
            }

            $charge = FeeRecordCharge::query()
                ->whereKey($allocation->fee_record_charge_id)
                ->where('school_id', $payment->school_id)
                ->where('student_id', $payment->student_id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertChargeCanAcceptAllocation($charge, (float) $allocation->amount);

            $paidCents = $this->moneyToCents($charge->paid_amount_cached) + $this->moneyToCents($allocation->amount);
            $outstandingCents = $this->moneyToCents($charge->outstanding_amount_cached) - $this->moneyToCents($allocation->amount);

            $charge->update([
                'paid_amount_cached' => $this->centsToMoney($paidCents),
                'outstanding_amount_cached' => $this->centsToMoney($outstandingCents),
                'collection_status' => $this->collectionStatus($paidCents, $outstandingCents),
            ]);
        }
    }

    private function reverseChargeAllocations(Payment $payment): void
    {
        foreach ($payment->allocations as $allocation) {
            if ($allocation->allocation_type !== 'charge') {
                continue;
            }

            $charge = FeeRecordCharge::query()
                ->whereKey($allocation->fee_record_charge_id)
                ->where('school_id', $payment->school_id)
                ->where('student_id', $payment->student_id)
                ->lockForUpdate()
                ->firstOrFail();

            $paidCents = $this->moneyToCents($charge->paid_amount_cached) - $this->moneyToCents($allocation->amount);
            $outstandingCents = $this->moneyToCents($charge->outstanding_amount_cached) + $this->moneyToCents($allocation->amount);
            $expectedCents = $this->moneyToCents($charge->expected_amount);

            if ($paidCents < 0 || $outstandingCents > $expectedCents) {
                throw ValidationException::withMessages([
                    'allocations' => 'Voiding this payment would make Fee Record charge balances invalid.',
                ]);
            }

            $charge->update([
                'paid_amount_cached' => $this->centsToMoney($paidCents),
                'outstanding_amount_cached' => $this->centsToMoney($outstandingCents),
                'collection_status' => $this->collectionStatus($paidCents, $outstandingCents),
            ]);
        }
    }

    private function collectionStatus(int $paidCents, int $outstandingCents): string
    {
        if ($outstandingCents <= 0) {
            return 'paid';
        }

        if ($paidCents > 0) {
            return 'partial';
        }

        return 'unpaid';
    }

    private function moneyToCents(mixed $value): int
    {
        return (int) round(((float) $value) * 100);
    }

    private function centsToMoney(int $cents): float
    {
        return round($cents / 100, 2);
    }
}
