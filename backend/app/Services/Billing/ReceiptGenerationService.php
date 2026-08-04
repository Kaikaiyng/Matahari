<?php

namespace App\Services\Billing;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\ReceiptSequence;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceiptGenerationService
{
    public function __construct(
        private readonly AuditLoggerContract $auditLogger,
        private readonly AuditContextFactory $contextFactory,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function generate(
        Payment $payment,
        array $data,
        User $issuedBy,
        ?AuditContext $auditContext = null,
    ): Receipt {
        return DB::transaction(function () use ($payment, $data, $issuedBy, $auditContext): Receipt {
            $lockedPayment = Payment::query()
                ->with(['school', 'student', 'allocations'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertSchoolScope($lockedPayment->school_id, $issuedBy);
            $this->assertVerifiedPayment($lockedPayment);
            $this->assertNoIssuedReceipt($lockedPayment);

            $paidBy = $this->resolvePaidBy($lockedPayment, $data['paid_by'] ?? null);
            $receiptDate = Carbon::parse($data['receipt_date'] ?? now())->startOfDay();
            $receiptNo = $this->nextReceiptNumber($lockedPayment, $receiptDate);

            if (blank($lockedPayment->paid_by) && filled($paidBy)) {
                $lockedPayment->forceFill(['paid_by' => $paidBy])->save();
            }

            $receipt = Receipt::query()->create([
                'school_id' => $lockedPayment->school_id,
                'payment_id' => $lockedPayment->id,
                'active_payment_id' => $lockedPayment->id,
                'student_id' => $lockedPayment->student_id,
                'student_no' => $lockedPayment->student->student_no,
                'student_name' => $lockedPayment->student->full_name,
                'paid_by' => $paidBy,
                'payment_method' => $lockedPayment->payment_method,
                'payment_date' => $lockedPayment->payment_date,
                'received_date' => $lockedPayment->received_date,
                'receipt_date' => $receiptDate->toDateString(),
                'receipt_no' => $receiptNo,
                'amount' => $lockedPayment->amount,
                'amount_in_words' => AmountInWords::ringgit($lockedPayment->amount),
                'issued_by' => $issuedBy->id,
                'issued_at' => now(),
                'status' => 'issued',
            ]);

            foreach ($lockedPayment->allocations->sortBy('sort_order')->values() as $index => $allocation) {
                $receipt->items()->create([
                    'school_id' => $lockedPayment->school_id,
                    'payment_allocation_id' => $allocation->id,
                    'fee_code' => $allocation->fee_code,
                    'description' => $allocation->description,
                    'amount' => $allocation->amount,
                    'sort_order' => $allocation->sort_order ?? $index,
                ]);
            }

            $receipt = $receipt->refresh()->load(['items', 'issuedBy', 'voidedBy']);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::ReceiptIssued,
                module: AuditModule::Receipts,
                schoolId: $receipt->school_id,
                subjectType: AuditSubject::Receipt,
                subjectId: $receipt->id,
                newValues: $this->receiptAuditValues($receipt),
                metadata: [
                    'payment_id' => $receipt->payment_id,
                    'student_id' => $receipt->student_id,
                ],
            ), $auditContext ?? $this->contextFactory->system());

            return $receipt;
        });
    }

    public function void(
        Receipt $receipt,
        string $voidReason,
        User $voidedBy,
        ?AuditContext $auditContext = null,
    ): Receipt {
        return DB::transaction(function () use ($receipt, $voidReason, $voidedBy, $auditContext): Receipt {
            $lockedReceipt = Receipt::query()
                ->whereKey($receipt->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertSchoolScope($lockedReceipt->school_id, $voidedBy);

            if ($lockedReceipt->status !== 'issued') {
                throw ValidationException::withMessages(['receipt' => 'Only issued receipts can be voided.']);
            }

            $lockedReceipt->update([
                'status' => 'voided',
                'active_payment_id' => null,
                'voided_by' => $voidedBy->id,
                'voided_at' => now(),
                'void_reason' => $voidReason,
            ]);

            $lockedReceipt = $lockedReceipt->refresh()->load(['items', 'issuedBy', 'voidedBy']);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::ReceiptVoided,
                module: AuditModule::Receipts,
                schoolId: $lockedReceipt->school_id,
                subjectType: AuditSubject::Receipt,
                subjectId: $lockedReceipt->id,
                oldValues: ['status' => 'issued'],
                newValues: [
                    'status' => $lockedReceipt->status,
                    'active_payment_id' => $lockedReceipt->active_payment_id,
                    'voided_by' => $lockedReceipt->voided_by,
                    'voided_at' => $lockedReceipt->voided_at?->toISOString(),
                ],
                metadata: [
                    'payment_id' => $lockedReceipt->payment_id,
                    'student_id' => $lockedReceipt->student_id,
                ],
                reason: $voidReason,
            ), $auditContext ?? $this->contextFactory->system());

            return $lockedReceipt;
        });
    }

    private function assertSchoolScope(int $schoolId, User $user): void
    {
        if ($user->school_id && (int) $user->school_id !== $schoolId) {
            abort(403, 'Receipt belongs to a different school.');
        }
    }

    private function assertVerifiedPayment(Payment $payment): void
    {
        if ($payment->status === 'pending_verification') {
            throw ValidationException::withMessages(['payment' => 'Only verified payments can generate receipts.']);
        }

        if ($payment->status === 'voided') {
            throw ValidationException::withMessages(['payment' => 'Voided payments cannot generate receipts.']);
        }

        if ($payment->status !== 'verified') {
            throw ValidationException::withMessages(['payment' => 'Only verified payments can generate receipts.']);
        }
    }

    private function assertNoIssuedReceipt(Payment $payment): void
    {
        $hasIssuedReceipt = Receipt::query()
            ->where('payment_id', $payment->id)
            ->where('status', 'issued')
            ->exists();

        if ($hasIssuedReceipt) {
            throw ValidationException::withMessages(['payment' => 'Payment already has an issued receipt.']);
        }
    }

    private function resolvePaidBy(Payment $payment, mixed $submittedPaidBy): string
    {
        $paidBy = filled($payment->paid_by) ? $payment->paid_by : $submittedPaidBy;

        if (! is_string($paidBy) || blank($paidBy)) {
            throw ValidationException::withMessages(['paid_by' => 'Paid by is required before generating a receipt.']);
        }

        return trim($paidBy);
    }

    private function nextReceiptNumber(Payment $payment, Carbon $receiptDate): string
    {
        $prefix = $payment->school?->receipt_prefix ?: $payment->school?->code ?: 'DEMO';
        $series = 'A';
        $sequence = $this->lockedSequence((int) $payment->school_id, $prefix, $series);

        $sequence->current_number++;
        $sequence->save();

        return sprintf('%s.%s%04d (%s)', $prefix, $series, $sequence->current_number, $receiptDate->format('m/Y'));
    }

    private function lockedSequence(int $schoolId, string $prefix, string $series): ReceiptSequence
    {
        $sequence = ReceiptSequence::query()
            ->where('school_id', $schoolId)
            ->where('prefix', $prefix)
            ->where('series', $series)
            ->lockForUpdate()
            ->first();

        if ($sequence) {
            return $sequence;
        }

        try {
            ReceiptSequence::query()->create([
                'school_id' => $schoolId,
                'prefix' => $prefix,
                'series' => $series,
                'current_number' => 0,
            ]);
        } catch (QueryException) {
            // Unique constraint may win a concurrent first receipt; lock and continue.
        }

        return ReceiptSequence::query()
            ->where('school_id', $schoolId)
            ->where('prefix', $prefix)
            ->where('series', $series)
            ->lockForUpdate()
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function receiptAuditValues(Receipt $receipt): array
    {
        return [
            'receipt_no' => $receipt->receipt_no,
            'payment_id' => $receipt->payment_id,
            'student_id' => $receipt->student_id,
            'receipt_date' => $receipt->receipt_date->toDateString(),
            'amount' => $receipt->amount,
            'status' => $receipt->status,
            'issued_by' => $receipt->issued_by,
            'item_ids' => $receipt->items->pluck('id')->values()->all(),
            'items' => $receipt->items->map(fn ($item) => [
                'id' => $item->id,
                'payment_allocation_id' => $item->payment_allocation_id,
                'fee_code' => $item->fee_code,
                'amount' => $item->amount,
            ])->values()->all(),
        ];
    }
}
