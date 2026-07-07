<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class VoidReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        $receipt = $this->route('receipt');
        $userSchoolId = $this->user()?->school_id;

        return $this->user() !== null
            && (! $userSchoolId || (int) $receipt?->school_id === (int) $userSchoolId);
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
            $receipt = $this->route('receipt');

            if ($receipt && $receipt->status !== 'issued') {
                $validator->errors()->add('receipt', 'Only issued receipts can be voided.');
            }
        });
    }
}
