<?php

namespace App\Http\Requests;

use App\Models\Receipt;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class VoidPaymentRequest extends FormRequest
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
            'void_reason' => ['required', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $payment = $this->route('payment');

            if ($payment && $payment->status === 'voided') {
                $validator->errors()->add('payment', 'Payment is already voided.');
            }

            if ($payment && $payment->status !== 'voided' && $this->hasIssuedReceipt((int) $payment->id, (int) $payment->school_id)) {
                $validator->errors()->add('payment', 'Void the issued receipt before voiding this payment.');
            }
        });
    }

    private function hasIssuedReceipt(int $paymentId, int $schoolId): bool
    {
        return Receipt::query()
            ->where('school_id', $schoolId)
            ->where('payment_id', $paymentId)
            ->where('status', 'issued')
            ->exists();
    }
}
