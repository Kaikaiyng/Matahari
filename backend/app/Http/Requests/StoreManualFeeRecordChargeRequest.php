<?php

namespace App\Http\Requests;

use App\Services\Billing\FeeRecordCategoryMapper;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreManualFeeRecordChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'academic_year' => ['required', 'string', 'regex:/^\d{4}$/'],
            'billing_month' => ['required', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'fee_record_category' => ['nullable', 'string', Rule::in(app(FeeRecordCategoryMapper::class)->categories())],
            'fee_item_id' => ['nullable', 'integer', 'exists:fee_items,id'],
            'fee_code' => ['nullable', 'string', 'max:50'],
            'description' => ['required', 'string', 'max:255'],
            'expected_amount' => ['required', 'numeric', 'gt:0'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $academicYear = (string) $this->input('academic_year');
            $billingMonth = (string) $this->input('billing_month');

            if ($academicYear && $billingMonth && str_starts_with($billingMonth, $academicYear.'-') === false) {
                $validator->errors()->add('billing_month', 'Billing month must belong to the selected academic year.');
            }
        });
    }
}
