<?php

namespace App\Services\Billing;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeRecordCharge;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FeeRecordChargeGenerationService
{
    public function __construct(private readonly FeeRecordCategoryMapper $categoryMapper) {}

    /**
     * @return array<string, mixed>
     */
    public function preview(Student $student, string $academicYear): array
    {
        $agreement = $this->activeAgreement($student, $academicYear);
        $charges = [];
        $warnings = [];

        foreach ($agreement->items->sortBy('sort_order')->values() as $item) {
            $months = $this->billingMonths($agreement, $item);

            if ($months === null) {
                $warnings[] = $this->missingMonthWarning($item);

                continue;
            }

            foreach ($months as $month) {
                if (! $this->monthIsInsideAgreementWindow($agreement, (int) $academicYear, $month)) {
                    continue;
                }

                $charges[] = $this->previewCharge($agreement, $item, $academicYear, $month);
            }
        }

        return [
            'fee_agreement' => [
                'id' => $agreement->id,
                'academic_year' => $agreement->academic_year,
                'payment_plan' => $agreement->payment_plan,
                'effective_from' => $agreement->effective_from->toDateString(),
                'effective_to' => $agreement->effective_to?->toDateString(),
            ],
            'needs_confirmation' => $warnings !== [],
            'warnings' => $warnings,
            'charges' => array_values($charges),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function activate(Student $student, string $academicYear): array
    {
        return DB::transaction(function () use ($student, $academicYear): array {
            $agreement = $this->activeAgreement($student, $academicYear, lock: true);

            $existingCharges = FeeRecordCharge::query()
                ->where('school_id', $student->school_id)
                ->where('student_id', $student->id)
                ->where('fee_agreement_id', $agreement->id)
                ->where('academic_year', $academicYear)
                ->lockForUpdate()
                ->exists();

            if ($existingCharges) {
                throw ValidationException::withMessages([
                    'fee_record' => 'Fee Record charges already exist for this student, agreement, and academic year.',
                ]);
            }

            $preview = $this->preview($student, $academicYear);

            if ($preview['needs_confirmation']) {
                throw ValidationException::withMessages([
                    'fee_record' => 'Billing months must be confirmed before activation.',
                ]);
            }

            $created = [];
            $activatedAt = now();

            foreach ($preview['charges'] as $charge) {
                $expectedAmount = (float) $charge['expected_amount'];
                $created[] = FeeRecordCharge::query()->create([
                    'school_id' => $student->school_id,
                    'student_id' => $student->id,
                    'fee_agreement_id' => $agreement->id,
                    'fee_agreement_item_id' => $charge['fee_agreement_item_id'],
                    'fee_item_id' => $charge['fee_item_id'],
                    'academic_year' => $academicYear,
                    'billing_month' => $charge['billing_month'],
                    'fee_record_category' => $charge['fee_record_category'],
                    'fee_code' => $charge['fee_code'],
                    'description' => $charge['description'],
                    'expected_amount' => $expectedAmount,
                    'paid_amount_cached' => 0,
                    'outstanding_amount_cached' => $expectedAmount,
                    'billing_status' => $expectedAmount > 0 ? 'billable' : 'no_charge',
                    'collection_status' => $expectedAmount > 0 ? 'unpaid' : 'paid',
                    'charge_origin' => 'scheduled',
                    'source_type' => 'agreement_item',
                    'skipped_reason' => null,
                    'activated_at' => $activatedAt,
                ]);
            }

            return [
                'created_count' => count($created),
                'data' => array_map(fn (FeeRecordCharge $charge) => $this->chargeResponse($charge), $created),
            ];
        });
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function outstanding(Student $student, string $academicYear): array
    {
        return FeeRecordCharge::query()
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->where('academic_year', $academicYear)
            ->where('billing_status', 'billable')
            ->whereIn('collection_status', ['unpaid', 'partial'])
            ->where('outstanding_amount_cached', '>', 0)
            ->orderBy('billing_month')
            ->orderBy('fee_record_category')
            ->orderBy('id')
            ->get()
            ->map(fn (FeeRecordCharge $charge) => $this->chargeResponse($charge))
            ->values()
            ->all();
    }

    private function activeAgreement(Student $student, string $academicYear, bool $lock = false): FeeAgreement
    {
        $query = FeeAgreement::query()
            ->with('items')
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->where('academic_year', $academicYear)
            ->where('is_current', true)
            ->where('status', 'active');

        if ($lock) {
            $query->lockForUpdate();
        }

        $agreement = $query->first();

        if (! $agreement) {
            throw ValidationException::withMessages([
                'academic_year' => 'No active current Fee Agreement exists for this student and academic year.',
            ]);
        }

        return $agreement;
    }

    /**
     * @return array<int, int>|null
     */
    private function billingMonths(FeeAgreement $agreement, FeeAgreementItem $item): ?array
    {
        $classification = $item->classification ?: 'recurring';
        $frequency = $item->billing_frequency ?: (
            in_array($classification, ['one_time', 'manual'], true) ? 'one_time' : $agreement->payment_plan
        );
        $configuredMonths = $this->normalizedMonthNumbers($item->billing_months);

        if ($configuredMonths !== []) {
            return $configuredMonths;
        }

        if ($frequency === 'monthly') {
            return range(1, 12);
        }

        if (in_array($frequency, ['termly', 'yearly', 'custom', 'one_time'], true)) {
            return null;
        }

        return null;
    }

    /**
     * @param mixed $months
     * @return array<int, int>
     */
    private function normalizedMonthNumbers(mixed $months): array
    {
        if (! is_array($months)) {
            return [];
        }

        return collect($months)
            ->filter(fn (mixed $month) => is_numeric($month) && (int) $month >= 1 && (int) $month <= 12)
            ->map(fn (mixed $month) => (int) $month)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function monthIsInsideAgreementWindow(FeeAgreement $agreement, int $year, int $month): bool
    {
        $monthStart = Carbon::create($year, $month, 1)->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $effectiveFrom = $agreement->effective_from->copy()->startOfDay();
        $effectiveTo = $agreement->effective_to?->copy()->endOfDay();

        if ($monthEnd->lt($effectiveFrom)) {
            return false;
        }

        return ! $effectiveTo || ! $monthStart->gt($effectiveTo);
    }

    /**
     * @return array<string, mixed>
     */
    private function previewCharge(
        FeeAgreement $agreement,
        FeeAgreementItem $item,
        string $academicYear,
        int $month,
    ): array {
        return [
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => $item->id,
            'fee_item_id' => $item->fee_item_id,
            'academic_year' => $academicYear,
            'billing_month' => sprintf('%s-%02d', $academicYear, $month),
            'fee_record_category' => $this->categoryMapper->category($item->fee_code, $item->fee_category),
            'fee_code' => $item->fee_code,
            'description' => $item->description,
            'expected_amount' => (float) $item->amount,
            'billing_status' => (float) $item->amount > 0 ? 'billable' : 'no_charge',
            'collection_status' => (float) $item->amount > 0 ? 'unpaid' : 'paid',
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
            'requires_preview_confirmation' => $item->requires_preview_confirmation,
            'warning' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function missingMonthWarning(FeeAgreementItem $item): array
    {
        return [
            'fee_agreement_item_id' => $item->id,
            'fee_code' => $item->fee_code,
            'description' => $item->description,
            'reason' => 'billing_months_required',
            'message' => 'Billing months must be configured before charge generation.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function chargeResponse(FeeRecordCharge $charge): array
    {
        return [
            'id' => $charge->id,
            'school_id' => $charge->school_id,
            'student_id' => $charge->student_id,
            'fee_agreement_id' => $charge->fee_agreement_id,
            'fee_agreement_item_id' => $charge->fee_agreement_item_id,
            'fee_item_id' => $charge->fee_item_id,
            'academic_year' => $charge->academic_year,
            'billing_month' => $charge->billing_month,
            'fee_record_category' => $charge->fee_record_category,
            'fee_code' => $charge->fee_code,
            'description' => $charge->description,
            'expected_amount' => (float) $charge->expected_amount,
            'paid_amount' => (float) $charge->paid_amount_cached,
            'outstanding_amount' => (float) $charge->outstanding_amount_cached,
            'billing_status' => $charge->billing_status,
            'collection_status' => $charge->collection_status,
            'charge_origin' => $charge->charge_origin,
            'source_type' => $charge->source_type,
            'skipped_reason' => $charge->skipped_reason,
            'activated_at' => $charge->activated_at?->toISOString(),
        ];
    }
}
