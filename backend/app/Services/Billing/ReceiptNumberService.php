<?php

namespace App\Services\Billing;

use App\Models\Payment;
use App\Models\Receipt;
use App\Models\ReceiptSequence;
use Illuminate\Support\Facades\DB;

class ReceiptNumberService
{
    public function generateForPayment(Payment $payment, ?int $generatedBy = null): Receipt
    {
        return DB::transaction(function () use ($payment, $generatedBy): Receipt {
            $payment->loadMissing('school');

            if ($payment->status !== 'verified') {
                throw new \RuntimeException('Only verified payments can receive receipts.');
            }

            $existing = Receipt::query()
                ->where('payment_id', $payment->id)
                ->where('status', 'active')
                ->first();

            if ($existing) {
                return $existing;
            }

            $year = (int) $payment->payment_date->format('Y');
            $prefix = $payment->school->receipt_prefix ?: $payment->school->code;

            $sequence = ReceiptSequence::query()
                ->where('school_id', $payment->school_id)
                ->where('year', $year)
                ->where('prefix', $prefix)
                ->lockForUpdate()
                ->first();

            if (! $sequence) {
                $sequence = ReceiptSequence::query()->create([
                    'school_id' => $payment->school_id,
                    'year' => $year,
                    'prefix' => $prefix,
                    'current_number' => 0,
                ]);
            }

            $sequence->increment('current_number');

            return Receipt::query()->create([
                'school_id' => $payment->school_id,
                'payment_id' => $payment->id,
                'student_id' => $payment->student_id,
                'receipt_no' => sprintf('%s-%d-%06d', $prefix, $year, $sequence->current_number),
                'receipt_date' => $payment->payment_date,
                'amount' => $payment->amount,
                'status' => 'active',
                'generated_by' => $generatedBy,
            ]);
        });
    }
}
