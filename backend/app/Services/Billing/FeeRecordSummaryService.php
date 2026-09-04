<?php

namespace App\Services\Billing;

use App\Models\FeeRecordCharge;
use App\Models\Receipt;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class FeeRecordSummaryService
{
    public function __construct(private readonly FeeRecordCategoryMapper $categoryMapper) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    public function summary(?int $schoolId, array $filters): array
    {
        $academicYear = (string) $filters['academic_year'];
        $billingMonth = $filters['billing_month'] ?? null;
        $studentStatus = $filters['student_status'] ?? 'active';

        $students = Student::query()
            ->with(['class', 'feeRecordCharges' => function ($query) use ($academicYear, $billingMonth): void {
                $query->where('academic_year', $academicYear)
                    ->when($billingMonth, fn ($monthQuery, string $month) => $monthQuery->where('billing_month', $month))
                    ->orderBy('billing_month')
                    ->orderBy('fee_record_category')
                    ->orderBy('id');
            }])
            ->when($schoolId, fn (Builder $query) => $query->where('school_id', $schoolId))
            ->when($studentStatus, fn (Builder $query) => $query->where('status', $studentStatus))
            ->when($filters['level_group'] ?? null, fn (Builder $query, string $levelGroup) => $query->where('level_group', $levelGroup))
            ->when($filters['class_id'] ?? null, fn (Builder $query, int $classId) => $query->where('class_id', $classId))
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery->whereLike('student_no', "%{$search}%")
                        ->orWhereLike('full_name', "%{$search}%");
                });
            })
            ->whereHas('feeRecordCharges', function (Builder $query) use ($academicYear, $billingMonth): void {
                $query->where('academic_year', $academicYear)
                    ->when($billingMonth, fn (Builder $monthQuery, string $month) => $monthQuery->where('billing_month', $month));
            })
            ->orderBy('full_name')
            ->orderBy('student_no')
            ->get();

        $latestReceipts = $this->latestReceipts($students->pluck('id'), $schoolId);

        return $students
            ->map(fn (Student $student) => $this->summaryRow($student, $academicYear, $latestReceipts->get($student->id)))
            ->filter(fn (array $row) => ! ($filters['outstanding_only'] ?? false) || $row['total_outstanding'] > 0)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, int>  $studentIds
     * @return Collection<int, Receipt>
     */
    private function latestReceipts(Collection $studentIds, ?int $schoolId): Collection
    {
        if ($studentIds->isEmpty()) {
            return collect();
        }

        return Receipt::query()
            ->whereIn('student_id', $studentIds->all())
            ->when($schoolId, fn (Builder $query) => $query->where('school_id', $schoolId))
            ->where('status', 'issued')
            ->orderByDesc('receipt_date')
            ->orderByDesc('id')
            ->get()
            ->unique('student_id')
            ->keyBy('student_id');
    }

    /**
     * @return array<string, mixed>
     */
    private function summaryRow(Student $student, string $academicYear, ?Receipt $latestReceipt): array
    {
        $charges = $student->feeRecordCharges;
        $totalExpected = (float) $charges->sum('expected_amount');
        $totalPaid = (float) $charges->sum('paid_amount_cached');
        $totalOutstanding = (float) $charges->sum('outstanding_amount_cached');
        $outstandingCharges = $charges
            ->where('billing_status', 'billable')
            ->filter(fn (FeeRecordCharge $charge) => (float) $charge->outstanding_amount_cached > 0);

        return [
            'student_id' => $student->id,
            'student_no' => $student->student_no,
            'student_name' => $student->full_name,
            'level_group' => $student->level_group,
            'class_name' => $student->class?->name,
            'student_status' => $student->status,
            'academic_year' => $academicYear,
            'total_expected' => $totalExpected,
            'total_paid' => $totalPaid,
            'total_outstanding' => $totalOutstanding,
            'outstanding_months' => $outstandingCharges
                ->pluck('billing_month')
                ->unique()
                ->values()
                ->all(),
            'outstanding_categories' => $outstandingCharges
                ->map(fn (FeeRecordCharge $charge) => $this->categoryMapper->category($charge->fee_code, $charge->fee_record_category))
                ->unique()
                ->values()
                ->all(),
            'latest_receipt_no' => $latestReceipt?->receipt_no,
            'latest_receipt_date' => $latestReceipt?->receipt_date?->toDateString(),
            'collection_status_summary' => $this->collectionStatusSummary($totalExpected, $totalPaid, $totalOutstanding),
        ];
    }

    private function collectionStatusSummary(float $totalExpected, float $totalPaid, float $totalOutstanding): string
    {
        if ($totalExpected <= 0) {
            return 'no_charges';
        }

        if ($totalOutstanding <= 0) {
            return 'paid';
        }

        if ($totalPaid > 0) {
            return 'partial';
        }

        return 'unpaid';
    }
}
