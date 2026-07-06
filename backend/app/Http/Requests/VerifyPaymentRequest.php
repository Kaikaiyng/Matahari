<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class VerifyPaymentRequest extends FormRequest
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
            'received_date' => ['required', 'date'],
            'bank_account' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'remark' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $payment = $this->route('payment');

            if (! $payment) {
                return;
            }

            if ($payment->status === 'voided') {
                $validator->errors()->add('payment', 'Voided payments cannot be verified.');
            } elseif ($payment->status === 'verified') {
                $validator->errors()->add('payment', 'Payment is already verified.');
            } elseif ($payment->status !== 'pending_verification') {
                $validator->errors()->add('payment', 'Only pending payments can be verified.');
            }
        });
    }
}
