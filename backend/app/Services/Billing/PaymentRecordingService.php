<?php

namespace App\Services\Billing;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentRecordingService
{
    public function __construct(
        private readonly ReceiptNumberService $receiptNumberService,
    ) {}

    public function recordForInvoice(
        int $invoiceId,
        string $paymentDate,
        float $amount,
        string $method,
        ?string $referenceNo = null,
        ?int $receivedBy = null,
        ?string $notes = null,
        bool $generateReceipt = true,
    ): Payment {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Payment amount must be greater than zero.');
        }

        return DB::transaction(function () use (
            $invoiceId,
            $paymentDate,
            $amount,
            $method,
            $referenceNo,
            $receivedBy,
            $notes,
            $generateReceipt,
        ): Payment {
            /** @var Invoice $invoice */
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoiceId);

            if ($invoice->status === 'void') {
                throw new \RuntimeException('Cannot record payment for a void invoice.');
            }

            $payment = Payment::query()->create([
                'school_id' => $invoice->school_id,
                'student_id' => $invoice->student_id,
                'payment_date' => $paymentDate,
                'amount' => $amount,
                'method' => $method,
                'reference_no' => $referenceNo,
                'status' => 'confirmed',
                'received_by' => $receivedBy,
                'notes' => $notes,
            ]);

            $payment->allocations()->create([
                'school_id' => $invoice->school_id,
                'invoice_id' => $invoice->id,
                'amount' => $amount,
            ]);

            $this->recalculateInvoiceBalance($invoice);

            if ($generateReceipt) {
                $this->receiptNumberService->generateForPayment($payment, $receivedBy);
            }

            return $payment->refresh();
        });
    }

    public function recalculateInvoiceBalance(Invoice $invoice): Invoice
    {
        $paidAmount = (float) $invoice->allocations()
            ->whereHas('payment', fn ($query) => $query->where('status', 'confirmed'))
            ->sum('amount');

        $grandTotal = (float) $invoice->grand_total;
        $outstanding = max(0, $grandTotal - $paidAmount);

        $status = match (true) {
            $paidAmount <= 0 => 'pending',
            $paidAmount < $grandTotal => 'partial',
            default => 'paid',
        };

        $invoice->update([
            'paid_amount' => $paidAmount,
            'outstanding_amount' => $outstanding,
            'status' => $status,
        ]);

        return $invoice->refresh();
    }
}
