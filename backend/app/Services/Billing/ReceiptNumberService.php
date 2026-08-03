<?php

namespace App\Services\Billing;

use App\Models\Payment;
use App\Models\Receipt;
use App\Models\User;

class ReceiptNumberService
{
    public function __construct(private readonly ReceiptGenerationService $receipts) {}

    public function generateForPayment(Payment $payment, ?int $generatedBy = null): Receipt
    {
        $user = $generatedBy
            ? User::query()->findOrFail($generatedBy)
            : User::query()->findOrFail($payment->recorded_by);

        return $this->receipts->generate($payment, [], $user);
    }
}
