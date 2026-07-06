<?php

namespace App\Services\Billing;

use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\Payment;
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
                    ...$this->allocationSnapshot($student, $allocation),
                    'school_id' => $student->school_id,
                    'amount' => $allocation['amount'],
                    'sort_order' => $index,
                ]);
            }

            return $payment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy']);
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function verify(Payment $payment, array $data, User $verifiedBy): Payment
    {
        $this->assertSchoolScope($payment->student, $verifiedBy);

        $updates = [
            'status' => 'verified',
            'received_date' => $data['received_date'],
            'bank_account' => $data['bank_account'] ?? $payment->bank_account,
            'reference_no' => $data['reference_no'] ?? $payment->reference_no,
            'remark' => $data['remark'] ?? $payment->remark,
            'verified_by' => $verifiedBy->id,
            'verified_at' => now(),
        ];

        $query = Payment::query()
            ->whereKey($payment->id)
            ->where('status', 'pending_verification');

        if ($verifiedBy->school_id) {
            $query->where('school_id', $verifiedBy->school_id);
        }

        if ($query->update($updates) === 0) {
            $payment->refresh();

            if ($payment->status === 'voided') {
                throw ValidationException::withMessages(['payment' => 'Voided payments cannot be verified.']);
            }

            if ($payment->status === 'verified') {
                throw ValidationException::withMessages(['payment' => 'Payment is already verified.']);
            }

            throw ValidationException::withMessages(['payment' => 'Only pending payments can be verified.']);
        }

        return $payment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy']);
    }

    public function void(Payment $payment, string $voidReason, User $voidedBy): Payment
    {
        $this->assertSchoolScope($payment->student, $voidedBy);

        $query = Payment::query()
            ->whereKey($payment->id)
            ->where('status', '!=', 'voided');

        if ($voidedBy->school_id) {
            $query->where('school_id', $voidedBy->school_id);
        }

        if ($query->update([
            'status' => 'voided',
            'voided_by' => $voidedBy->id,
            'voided_at' => now(),
            'void_reason' => $voidReason,
        ]) === 0) {
            throw ValidationException::withMessages(['payment' => 'Payment is already voided.']);
        }

        return $payment->refresh()->load(['allocations', 'recordedBy', 'verifiedBy', 'voidedBy']);
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
    private function allocationSnapshot(Student $student, array $allocation): array
    {
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
                'fee_code' => $feeItem->code,
                'description' => $allocation['description'] ?? $feeItem->name,
            ];
        }

        return [
            'fee_item_id' => null,
            'fee_agreement_item_id' => null,
            'fee_code' => null,
            'description' => $allocation['description'],
        ];
    }

    private function moneyToCents(mixed $value): int
    {
        return (int) round(((float) $value) * 100);
    }
}
