<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesFeeAgreementBillingConfiguration;
use App\Models\FeeItem;
use App\Rules\DatabaseMoney;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SupersedeFeeAgreementRequest extends FormRequest
{
    use ValidatesFeeAgreementBillingConfiguration;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $schoolId = $this->route('feeAgreement')?->school_id ?? $this->user()?->school_id;

        return [
            'payment_plan' => ['sometimes', 'string', Rule::in(['monthly', 'termly', 'yearly'])],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'remarks' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.fee_item_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('fee_items', 'id')->where(fn ($query) => $query->where('school_id', $schoolId)),
            ],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.amount' => ['required', new DatabaseMoney],
            ...$this->billingConfigurationRules(),
            'discounts' => ['sometimes', 'array'],
            'discounts.*.discount_label' => ['required_with:discounts', 'string', 'max:255'],
            'discounts.*.discount_type' => ['required_with:discounts', 'string', Rule::in(['percentage', 'fixed_amount'])],
            'discounts.*.scope' => ['nullable', 'string', Rule::in(['tuition_only', 'total_payable', 'selected_fee_items'])],
            'discounts.*.value' => ['required_with:discounts', new DatabaseMoney(false)],
            'discounts.*.remark' => ['required_with:discounts', 'string'],
            'discounts.*.selected_fee_codes' => ['sometimes', 'array'],
            'discounts.*.selected_fee_codes.*' => ['string', 'max:50', 'distinct'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $agreement = $this->route('feeAgreement');
            $schoolId = $agreement?->school_id ?? $this->user()?->school_id;
            $feeItems = FeeItem::query()
                ->where('school_id', $schoolId)
                ->whereIn('id', collect($this->input('items', []))->pluck('fee_item_id')->filter()->all())
                ->get()
                ->keyBy('id');

            $codes = $feeItems->pluck('code')->filter()->values();

            if ($agreement && $this->filled('effective_from')
                && $this->date('effective_from')?->format('Y') !== (string) $agreement->academic_year) {
                $validator->errors()->add('effective_from', 'The effective date must belong to the agreement academic year.');
            }

            if (! $codes->contains('TUITION') || ! $codes->contains('MISC')) {
                $validator->errors()->add('items', 'Fee Agreement must include Tuition Fee and Misc Fee.');
            }

            if ($agreement && $this->date('effective_from') <= $agreement->effective_from) {
                $validator->errors()->add('effective_from', 'The new effective date must be after the current agreement effective date.');
            }

            foreach ($this->input('items', []) as $index => $item) {
                $feeItem = $feeItems->get($item['fee_item_id'] ?? null);

                if ($feeItem?->code === 'OTHERS' && blank($item['description'] ?? null)) {
                    $validator->errors()->add("items.{$index}.description", 'Others fee items require a custom description.');
                }
            }

            $this->validateBillingConfiguration($validator);

            foreach ($this->input('discounts', []) as $index => $discount) {
                $scope = $discount['scope'] ?? null;
                $selectedCodes = collect($discount['selected_fee_codes'] ?? [])->filter()->values();

                if ($scope === 'selected_fee_items' && empty($discount['selected_fee_codes'])) {
                    $validator->errors()->add("discounts.{$index}.selected_fee_codes", 'Selected fee item discounts require selected fee codes.');
                }

                if ($scope === 'selected_fee_items' && $selectedCodes->contains(fn ($code) => ! $codes->contains($code))) {
                    $validator->errors()->add("discounts.{$index}.selected_fee_codes", 'Selected fee codes must belong to this Fee Agreement.');
                }

                if (($discount['discount_type'] ?? null) === 'percentage'
                    && is_numeric($discount['value'] ?? null)
                    && (float) $discount['value'] > 100) {
                    $validator->errors()->add("discounts.{$index}.value", 'Percentage discounts cannot exceed 100.');
                }
            }
        });
    }
}
