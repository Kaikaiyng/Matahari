<?php

namespace App\Services\Billing;

use App\Models\FeeAgreement;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FeeRecordManualChargeService
{
    /**
     * @param array<string, mixed> $data
     */
    public function create(Student $student, array $data): FeeRecordCharge
    {
        return DB::transaction(function () use ($student, $data): FeeRecordCharge {
            $academicYear = (string) $data['academic_year'];
            $agreement = $this->activeAgreement($student, $academicYear);
            $feeItem = $this->feeItem($student, $data['fee_item_id'] ?? null);
            $feeCode = trim((string) ($data['fee_code'] ?? '')) ?: $feeItem?->code;
            $expectedAmount = round((float) $data['expected_amount'], 2);

            return FeeRecordCharge::query()->create([
                'school_id' => $student->school_id,
                'student_id' => $student->id,
                'fee_agreement_id' => $agreement->id,
                'fee_agreement_item_id' => null,
                'fee_item_id' => $feeItem?->id,
                'academic_year' => $academicYear,
                'billing_month' => $data['billing_month'],
                'fee_record_category' => $data['fee_record_category'] ?? 'OTHERS',
                'fee_code' => $feeCode ?: null,
                'description' => trim((string) $data['description']),
                'remark' => isset($data['remark']) ? trim((string) $data['remark']) : null,
                'expected_amount' => $expectedAmount,
                'paid_amount_cached' => 0,
                'outstanding_amount_cached' => $expectedAmount,
                'billing_status' => 'billable',
                'collection_status' => 'unpaid',
                'charge_origin' => 'manual',
                'source_type' => 'manual_charge',
                'activated_at' => now(),
            ]);
        });
    }

    private function activeAgreement(Student $student, string $academicYear): FeeAgreement
    {
        $agreement = FeeAgreement::query()
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->where('academic_year', $academicYear)
            ->where('is_current', true)
            ->where('status', 'active')
            ->lockForUpdate()
            ->first();

        if (! $agreement) {
            throw ValidationException::withMessages([
                'academic_year' => 'No active current Fee Agreement exists for this student and academic year.',
            ]);
        }

        return $agreement;
    }

    private function feeItem(Student $student, mixed $feeItemId): ?FeeItem
    {
        if (! $feeItemId) {
            return null;
        }

        $feeItem = FeeItem::query()
            ->where('school_id', $student->school_id)
            ->find($feeItemId);

        if (! $feeItem) {
            throw ValidationException::withMessages([
                'fee_item_id' => 'Fee item does not belong to this school.',
            ]);
        }

        return $feeItem;
    }
}
