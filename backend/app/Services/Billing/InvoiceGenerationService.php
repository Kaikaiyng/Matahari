<?php

namespace App\Services\Billing;

use App\Models\Invoice;
use App\Models\InvoiceSequence;
use App\Models\School;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

class InvoiceGenerationService
{
    /**
     * @return array{created_count:int, skipped_count:int, skipped:array<int, array{student_id:int, reason:string}>}
     */
    public function generateMonthly(
        int $schoolId,
        string $invoiceMonth,
        string $issueDate,
        string $dueDate,
        ?int $createdBy = null,
        ?int $classId = null,
    ): array {
        $createdCount = 0;
        $skipped = [];

        $students = Student::query()
            ->with(['feeAssignments.feeItem', 'discountAssignments.discountItem'])
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->when($classId, fn ($query) => $query->where('class_id', $classId))
            ->orderBy('id')
            ->get();

        foreach ($students as $student) {
            if ($this->invoiceExists($schoolId, $student->id, $invoiceMonth)) {
                $skipped[] = ['student_id' => $student->id, 'reason' => 'Invoice already exists.'];

                continue;
            }

            $feeLines = $this->buildFeeLines($student, $invoiceMonth);

            if ($feeLines === []) {
                $skipped[] = ['student_id' => $student->id, 'reason' => 'No active fees assigned.'];

                continue;
            }

            DB::transaction(function () use (
                $schoolId,
                $student,
                $invoiceMonth,
                $issueDate,
                $dueDate,
                $createdBy,
                $feeLines,
                &$createdCount,
            ): void {
                $discountLines = $this->buildDiscountLines($student, $feeLines, $invoiceMonth);
                $subtotal = array_sum(array_column($feeLines, 'line_total'));
                $discountTotal = abs(array_sum(array_column($discountLines, 'line_total')));
                $grandTotal = max(0, $subtotal - $discountTotal);

                $invoice = Invoice::query()->create([
                    'school_id' => $schoolId,
                    'student_id' => $student->id,
                    'invoice_no' => $this->nextInvoiceNumber($schoolId, (int) substr($invoiceMonth, 0, 4)),
                    'invoice_month' => $invoiceMonth,
                    'issue_date' => $issueDate,
                    'due_date' => $dueDate,
                    'subtotal' => $subtotal,
                    'discount_total' => $discountTotal,
                    'grand_total' => $grandTotal,
                    'paid_amount' => 0,
                    'outstanding_amount' => $grandTotal,
                    'status' => 'pending',
                    'created_by' => $createdBy,
                ]);

                foreach (array_values([...$feeLines, ...$discountLines]) as $index => $line) {
                    $invoice->items()->create([
                        ...$line,
                        'school_id' => $schoolId,
                        'sort_order' => $index + 1,
                    ]);
                }

                $createdCount++;
            });
        }

        return [
            'created_count' => $createdCount,
            'skipped_count' => count($skipped),
            'skipped' => $skipped,
        ];
    }

    private function invoiceExists(int $schoolId, int $studentId, string $invoiceMonth): bool
    {
        return Invoice::query()
            ->where('school_id', $schoolId)
            ->where('student_id', $studentId)
            ->where('invoice_month', $invoiceMonth)
            ->where('status', '!=', 'void')
            ->exists();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildFeeLines(Student $student, string $invoiceMonth): array
    {
        return $student->feeAssignments
            ->filter(fn ($assignment) => $assignment->status === 'active')
            ->filter(fn ($assignment) => $this->assignmentApplies($assignment->start_date, $assignment->end_date, $invoiceMonth))
            ->filter(fn ($assignment) => $assignment->feeItem?->fee_type !== 'one_time' || $assignment->billing_month === $invoiceMonth)
            ->map(fn ($assignment) => [
                'item_type' => 'fee',
                'source_type' => 'fee_item',
                'source_id' => $assignment->fee_item_id,
                'description' => $assignment->feeItem->name,
                'quantity' => 1,
                'unit_amount' => $assignment->amount,
                'line_total' => $assignment->amount,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $feeLines
     * @return array<int, array<string, mixed>>
     */
    private function buildDiscountLines(Student $student, array $feeLines, string $invoiceMonth): array
    {
        $subtotal = array_sum(array_column($feeLines, 'line_total'));

        return $student->discountAssignments
            ->filter(fn ($assignment) => $assignment->status === 'active')
            ->filter(fn ($assignment) => $this->assignmentApplies($assignment->start_date, $assignment->end_date, $invoiceMonth))
            ->map(function ($assignment) use ($subtotal) {
                $amount = $assignment->discount_type === 'percentage'
                    ? round($subtotal * ($assignment->value / 100), 2)
                    : $assignment->value;

                return [
                    'item_type' => 'discount',
                    'source_type' => 'discount_item',
                    'source_id' => $assignment->discount_item_id,
                    'description' => $assignment->discountItem->name,
                    'quantity' => 1,
                    'unit_amount' => -$amount,
                    'line_total' => -$amount,
                ];
            })
            ->values()
            ->all();
    }

    private function assignmentApplies(mixed $startDate, mixed $endDate, string $invoiceMonth): bool
    {
        $monthStart = $invoiceMonth.'-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));

        if ($startDate && $startDate->format('Y-m-d') > $monthEnd) {
            return false;
        }

        if ($endDate && $endDate->format('Y-m-d') < $monthStart) {
            return false;
        }

        return true;
    }

    private function nextInvoiceNumber(int $schoolId, int $year): string
    {
        $school = School::query()->findOrFail($schoolId);
        $prefix = $school->invoice_prefix ?: $school->code.'-INV';

        $sequence = InvoiceSequence::query()
            ->where('school_id', $schoolId)
            ->where('year', $year)
            ->where('prefix', $prefix)
            ->lockForUpdate()
            ->first();

        if (! $sequence) {
            $sequence = InvoiceSequence::query()->create([
                'school_id' => $schoolId,
                'year' => $year,
                'prefix' => $prefix,
                'current_number' => 0,
            ]);
        }

        $sequence->increment('current_number');

        return sprintf('%s-%d-%06d', $prefix, $year, $sequence->current_number);
    }
}
