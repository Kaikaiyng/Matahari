<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait ValidatesFeeAgreementBillingConfiguration
{
    /**
     * @return array<string, mixed>
     */
    private function billingConfigurationRules(): array
    {
        return [
            'items.*.classification' => ['nullable', 'string', Rule::in([
                'recurring',
                'optional_service',
                'one_time',
                'manual',
            ])],
            'items.*.billing_frequency' => ['nullable', 'string', Rule::in([
                'monthly',
                'termly',
                'yearly',
                'custom',
                'one_time',
            ])],
            'items.*.billing_months' => ['nullable', 'array'],
            'items.*.billing_months.*' => ['integer', 'between:1,12', 'distinct'],
            'items.*.requires_preview_confirmation' => ['sometimes', 'boolean'],
        ];
    }

    private function validateBillingConfiguration(Validator $validator): void
    {
        foreach ($this->input('items', []) as $index => $item) {
            $frequency = $item['billing_frequency'] ?? null;
            $months = array_values(array_filter($item['billing_months'] ?? [], fn ($month) => $month !== null && $month !== ''));
            $monthCount = count($months);

            if (in_array($frequency, ['termly', 'custom'], true) && $monthCount === 0) {
                $validator->errors()->add("items.{$index}.billing_months", 'Billing months are required for termly and custom billing.');
            }

            if (in_array($frequency, ['yearly', 'one_time'], true) && $monthCount !== 1) {
                $validator->errors()->add("items.{$index}.billing_months", 'Yearly and one-time billing require exactly one billing month.');
            }
        }
    }
}
