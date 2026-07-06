<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $student = $this->route('student');
        $userSchoolId = $this->user()?->school_id;

        return $this->user() !== null
            && (! $userSchoolId || (int) $student?->school_id === (int) $userSchoolId);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'payment_method' => ['required', 'string', Rule::in([
                'cash',
                'bank_transfer',
                'duitnow_qr',
                'cheque',
                'credit_card',
                'fpx',
            ])],
            'payment_date' => ['required', 'date'],
            'received_date' => ['required_if:payment_method,cash', 'nullable', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'bank_account' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'payment_proof' => ['nullable', 'string'],
            'remark' => ['nullable', 'string'],
            'allocations' => ['required', 'array', 'min:1'],
            'allocations.*.fee_item_id' => ['nullable', 'integer', 'exists:fee_items,id'],
            'allocations.*.fee_agreement_item_id' => ['nullable', 'integer', 'exists:fee_agreement_items,id'],
            'allocations.*.description' => ['nullable', 'string', 'max:255'],
            'allocations.*.amount' => ['required', 'numeric', 'min:0.01'],
            'status' => ['prohibited'],
            'recorded_by' => ['prohibited'],
            'verified_by' => ['prohibited'],
            'verified_at' => ['prohibited'],
            'voided_by' => ['prohibited'],
            'voided_at' => ['prohibited'],
            'void_reason' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $amount = $this->moneyToCents($this->input('amount'));
            $allocationTotal = collect($this->input('allocations', []))
                ->sum(fn ($allocation) => $this->moneyToCents($allocation['amount'] ?? null));

            if ($amount > 0 && $allocationTotal !== $amount) {
                $validator->errors()->add('allocations', 'Allocation total must equal payment amount.');
            }

            foreach ($this->input('allocations', []) as $index => $allocation) {
                $hasFeeItem = filled($allocation['fee_item_id'] ?? null);
                $hasFeeAgreementItem = filled($allocation['fee_agreement_item_id'] ?? null);
                $hasDescription = filled($allocation['description'] ?? null);

                if (! $hasFeeItem && ! $hasFeeAgreementItem && ! $hasDescription) {
                    $validator->errors()->add(
                        "allocations.{$index}.description",
                        'Manual allocation rows require a description.',
                    );
                }
            }
        });
    }

    private function moneyToCents(mixed $value): int
    {
        if (! is_numeric($value)) {
            return 0;
        }

        return (int) round(((float) $value) * 100);
    }
}
