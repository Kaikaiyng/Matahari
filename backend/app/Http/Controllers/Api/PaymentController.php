<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Billing\PaymentRecordingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function store(Request $request, PaymentRecordingService $service): JsonResponse
    {
        $data = $request->validate([
            'invoice_id' => ['required', 'integer', 'exists:invoices,id'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['required', 'string', 'in:cash,bank_transfer,qr,online'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'received_by' => ['nullable', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
            'generate_receipt' => ['sometimes', 'boolean'],
        ]);

        $payment = $service->recordForInvoice(
            invoiceId: (int) $data['invoice_id'],
            paymentDate: $data['payment_date'],
            amount: (float) $data['amount'],
            method: $data['method'],
            referenceNo: $data['reference_no'] ?? null,
            receivedBy: $data['received_by'] ?? null,
            notes: $data['notes'] ?? null,
            generateReceipt: $data['generate_receipt'] ?? true,
        )->load(['receipt', 'allocations.invoice']);

        return response()->json([
            'payment' => [
                'id' => $payment->id,
                'student_id' => $payment->student_id,
                'amount' => (float) $payment->amount,
                'method' => $payment->method,
                'status' => $payment->status,
                'payment_date' => $payment->payment_date->toDateString(),
                'receipt_no' => $payment->receipt?->receipt_no,
            ],
        ], 201);
    }
}
