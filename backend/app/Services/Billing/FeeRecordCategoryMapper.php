<?php

namespace App\Services\Billing;

class FeeRecordCategoryMapper
{
    private const BUSINESS_CATEGORIES = ['SF+MF', 'TR', 'MP', 'HS', 'HT', 'PAYMENT', 'OTHERS'];

    /**
     * @return array<int, string>
     */
    public function categories(): array
    {
        return self::BUSINESS_CATEGORIES;
    }

    /**
     * Temporary mapper until the school confirms final Fee Record category codes.
     */
    public function category(?string $feeCode, ?string $sourceCategory): string
    {
        $code = strtoupper(trim((string) $feeCode));
        $category = strtoupper(trim((string) $sourceCategory));

        if (in_array($category, self::BUSINESS_CATEGORIES, true)) {
            return $category;
        }

        if (in_array($code, ['TUITION', 'MISC'], true)) {
            return 'SF+MF';
        }

        if ($code === 'TRANSPORT') {
            return 'TR';
        }

        if (in_array($code, ['MEAL', 'MEAL_PLAN'], true)) {
            return 'MP';
        }

        if (in_array($code, ['HIGH_SCOPE', 'HS'], true)) {
            return 'HS';
        }

        if ($code === 'HOSTEL') {
            return 'HT';
        }

        if (in_array($code, ['APPLICATION', 'DEPOSIT', 'ENROLMENT', 'ENROLLMENT', 'REG', 'REGISTRATION'], true)) {
            return 'PAYMENT';
        }

        if (in_array($code, ['UNIFORM', 'BOOK', 'BOOKS', 'PE', 'WORKSHEET'], true)) {
            return 'OTHERS';
        }

        if (in_array($category, ['MANDATORY', 'OPTIONAL', 'OPTIONAL_SERVICE', 'RECURRING', 'ONE_TIME', 'MANUAL'], true)) {
            return 'OTHERS';
        }

        return $category !== '' ? $category : 'OTHERS';
    }
}
