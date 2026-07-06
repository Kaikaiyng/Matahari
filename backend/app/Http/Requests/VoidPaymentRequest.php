<?php

namespace App\Http\Requests;

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
        });
    }
}
