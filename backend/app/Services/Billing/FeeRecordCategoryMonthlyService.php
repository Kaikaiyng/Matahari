<?php

namespace App\Services\Billing;

use App\Models\FeeRecordCharge;
use App\Models\PaymentAllocation;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class FeeRecordCategoryMonthlyService
{
    public function __construct(private readonly FeeRecordCategoryMapper $categoryMapper) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    public function monthly(?int $schoolId, array $filters): array
    {
        $academicYear = (string) $filters['academic_year'];
        $category = (string) $filters['category'];
        $studentStatus = $filters['student_status'] ?? 'active';

        $students = Student::query()
            ->with(['class', 'feeRecordCharges' => function ($query) use ($academicYear): void {
                $query->where('academic_year', $academicYear)
                    ->orderBy('billing_month')
                    ->orderBy('id');
            }])
            ->when($schoolId, fn (Builder $query) => $query->where('school_id', $schoolId))
            ->when($studentStatus, fn (Builder $query) => $query->where('status', $studentStatus))
            ->when($filters['level_group'] ?? null, fn (Builder $query, string $levelGroup) => $query->where('level_group', $levelGroup))
            ->when($filters['class_id'] ?? null, fn (Builder $query, int $classId) => $query->where('class_id', $classId))
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery->where('student_no', 'like', "%{$search}%")
                        ->orWhere('full_name', 'like', "%{$search}%");
                });
            })
            ->whereHas('feeRecordCharges', function (Builder $query) use ($academicYear): void {
                $query->where('academic_year', $academicYear);
            })
            ->orderBy('full_name')
            ->orderBy('student_no')
            ->get();

        $receiptRefsByChargeId = $this->receiptRefsByChargeId(
            $students
                ->flatMap(fn (Student $student) => $student->feeRecordCharges->pluck('id'))
                ->unique()
                ->values(),
            $schoolId,
        );

        return $students
            ->map(fn (Student $student) => $this->monthlyRow($student, $academicYear, $category, $receiptRefsByChargeId))
            ->filter()
            ->filter(fn (array $row) => ! ($filters['outstanding_only'] ?? false) || $row['total_outstanding'] > 0)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, int>  $chargeIds
     * @return Collection<int, array<int, string>>
     */
    private function receiptRefsByChargeId(Collection $chargeIds, ?int $schoolId): Collection
    {
        if ($chargeIds->isEmpty()) {
            return collect();
        }

        return PaymentAllocation::query()
            ->with(['payment.issuedReceipt'])
            ->whereIn('fee_record_charge_id', $chargeIds->all())
            ->where('allocation_type', 'charge')
            ->when($schoolId, fn (Builder $query) => $query->where('school_id', $schoolId))
            ->get()
            ->groupBy('fee_record_charge_id')
            ->map(fn (Collection $allocations) => $allocations
                ->map(fn (PaymentAllocation $allocation) => $allocation->payment?->status === 'verified'
                    ? $allocation->payment?->issuedReceipt?->receipt_no
                    : null)
                ->filter()
                ->unique()
                ->values()
                ->all());
    }

    /**
     * @param  Collection<int, array<int, string>>  $receiptRefsByChargeId
     * @return array<string, mixed>|null
     */
    private function monthlyRow(
        Student $student,
        string $academicYear,
        string $category,
        Collection $receiptRefsByChargeId,
    ): ?array {
        $charges = $student->feeRecordCharges
            ->filter(fn (FeeRecordCharge $charge) => $this->categoryMapper->category($charge->fee_code, $charge->fee_record_category) === $category)
            ->values();

        if ($charges->isEmpty()) {
            return null;
        }

        $months = $this->emptyMonths($academicYear);

        foreach ($charges as $charge) {
            $monthNumber = $this->monthNumber($charge->billing_month);

            if ($monthNumber === null) {
                continue;
            }

            $cell = $months[$monthNumber - 1];
            $cell['expected_amount'] += (float) $charge->expected_amount;
            $cell['paid_amount'] += (float) $charge->paid_amount_cached;
            $cell['outstanding_amount'] += (float) $charge->outstanding_amount_cached;
            $cell['charge_count']++;
            $cell['receipt_refs'] = array_values(array_unique([
                ...$cell['receipt_refs'],
                ...($receiptRefsByChargeId->get($charge->id, [])),
            ]));
            $cell['raw_categories'] = array_values(array_unique([
                ...$cell['raw_categories'],
                (string) $charge->fee_record_category,
            ]));
            $cell['fee_codes'] = array_values(array_unique([
                ...$cell['fee_codes'],
                (string) $charge->fee_code,
            ]));
            $months[$monthNumber - 1] = $cell;
        }

        $months = array_map(fn (array $cell) => [
            ...$cell,
            'expected_amount' => round($cell['expected_amount'], 2),
            'paid_amount' => round($cell['paid_amount'], 2),
            'outstanding_amount' => round($cell['outstanding_amount'], 2),
            'collection_status' => $this->collectionStatusSummary(
                $cell['charge_count'],
                $cell['expected_amount'],
                $cell['paid_amount'],
                $cell['outstanding_amount'],
            ),
        ], $months);

        return [
            'student_id' => $student->id,
            'student_no' => $student->student_no,
            'student_name' => $student->full_name,
            'level_group' => $student->level_group,
            'class_name' => $student->class?->name,
            'student_status' => $student->status,
            'academic_year' => $academicYear,
            'category' => $category,
            'months' => $months,
            'total_expected' => round((float) $charges->sum('expected_amount'), 2),
            'total_paid' => round((float) $charges->sum('paid_amount_cached'), 2),
            'total_outstanding' => round((float) $charges->sum('outstanding_amount_cached'), 2),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function emptyMonths(string $academicYear): array
    {
        $months = [];

        for ($month = 1; $month <= 12; $month++) {
            $months[] = [
                'month' => sprintf('%s-%02d', $academicYear, $month),
                'month_number' => $month,
                'expected_amount' => 0.0,
                'paid_amount' => 0.0,
                'outstanding_amount' => 0.0,
                'collection_status' => 'no_charge',
                'receipt_refs' => [],
                'charge_count' => 0,
                'raw_categories' => [],
                'fee_codes' => [],
            ];
        }

        return $months;
    }

    private function monthNumber(?string $billingMonth): ?int
    {
        if (! $billingMonth || ! preg_match('/^\d{4}-(\d{2})$/', $billingMonth, $matches)) {
            return null;
        }

        $monthNumber = (int) $matches[1];

        return $monthNumber >= 1 && $monthNumber <= 12 ? $monthNumber : null;
    }

    private function collectionStatusSummary(int $chargeCount, float $expected, float $paid, float $outstanding): string
    {
        if ($chargeCount === 0 || $expected <= 0) {
            return 'no_charge';
        }

        if ($outstanding <= 0) {
            return 'paid';
        }

        if ($paid > 0) {
            return 'partial';
        }

        return 'unpaid';
    }
}
