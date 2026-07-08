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
            'paid_by' => ['nullable', 'string', 'max:255'],
            'bank_account' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'payment_proof' => ['nullable', 'string'],
            'remark' => ['nullable', 'string'],
            'academic_year' => ['nullable', 'string', 'regex:/^\d{4}$/'],
            'allocations' => ['required', 'array', 'min:1'],
            'allocations.*.allocation_type' => ['nullable', 'string', Rule::in(['charge', 'manual', 'legacy'])],
            'allocations.*.fee_record_charge_id' => ['nullable', 'integer', 'exists:fee_record_charges,id'],
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
                $allocationType = $allocation['allocation_type'] ?? null;
                $hasCharge = filled($allocation['fee_record_charge_id'] ?? null);
                $hasFeeItem = filled($allocation['fee_item_id'] ?? null);
                $hasFeeAgreementItem = filled($allocation['fee_agreement_item_id'] ?? null);
                $hasDescription = filled($allocation['description'] ?? null);

                if ($allocationType === 'charge' && ! $hasCharge) {
                    $validator->errors()->add(
                        "allocations.{$index}.fee_record_charge_id",
                        'Charge allocations require a Fee Record charge cell.',
                    );
                }

                if ($hasCharge && $allocationType && $allocationType !== 'charge') {
                    $validator->errors()->add(
                        "allocations.{$index}.allocation_type",
                        'Only charge allocations may reference a Fee Record charge cell.',
                    );
                }

                if (($allocationType === 'manual' || (! $hasCharge && ! $hasFeeItem && ! $hasFeeAgreementItem)) && ! $hasDescription) {
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
