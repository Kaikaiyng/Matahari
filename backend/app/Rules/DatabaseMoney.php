<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class DatabaseMoney implements ValidationRule
{
    public function __construct(private readonly bool $allowZero = true)
    {
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_int($value) && ! is_float($value) && ! is_string($value)) {
            $fail('The :attribute field must be a valid monetary amount.');

            return;
        }

        $normalized = (string) $value;

        if (! preg_match('/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/', $normalized)) {
            $fail('The :attribute field must be between 0.00 and 99,999,999.99 with at most two decimal places.');

            return;
        }

        if (! $this->allowZero && (float) $normalized <= 0) {
            $fail('The :attribute field must be greater than zero.');
        }
    }
}
