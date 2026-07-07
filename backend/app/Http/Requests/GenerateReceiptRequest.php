<?php

namespace App\Http\Requests;

use App\Models\Receipt;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class GenerateReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        $payment = $this->route('payment');
        $userSchoolId = $this->user()?->school_id;

        return $this->user() !== null
            && (! $userSchoolId || (int) $payment?->school_id === (int) $userSchoolId);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'paid_by' => ['nullable', 'string', 'max:255'],
            'receipt_date' => ['nullable', 'date'],
            'receipt_no' => ['prohibited'],
            'amount' => ['prohibited'],
            'student_id' => ['prohibited'],
            'status' => ['prohibited'],
            'issued_by' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $payment = $this->route('payment');

            if (! $payment) {
                return;
            }

            if ($payment->status === 'pending_verification') {
                $validator->errors()->add('payment', 'Only verified payments can generate receipts.');
            } elseif ($payment->status === 'voided') {
                $validator->errors()->add('payment', 'Voided payments cannot generate receipts.');
            } elseif ($payment->status !== 'verified') {
                $validator->errors()->add('payment', 'Only verified payments can generate receipts.');
            }

            if (blank($payment->paid_by) && blank($this->input('paid_by'))) {
                $validator->errors()->add('paid_by', 'Paid by is required before generating a receipt.');
            }

            $hasIssuedReceipt = Receipt::query()
                ->where('payment_id', $payment->id)
                ->where('status', 'issued')
                ->exists();

            if ($hasIssuedReceipt) {
                $validator->errors()->add('payment', 'Payment already has an issued receipt.');
            }
        });
    }
}
