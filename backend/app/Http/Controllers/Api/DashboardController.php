<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Services\Billing\FeeRecordSummaryService;
use App\Support\SchoolScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function school(
        Request $request,
        FeeRecordSummaryService $feeRecordSummaryService,
        SchoolScopeResolver $schoolScopeResolver,
    ): JsonResponse {
        $data = $request->validate([
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}$/'],
            'school_id' => ['sometimes', 'integer'],
        ]);
        $schoolId = $schoolScopeResolver->resolve($request->user(), $data['school_id'] ?? null);
        $school = School::query()->findOrFail($schoolId);
        $today = now()->toDateString();
        $currentMonth = (string) $request->query('invoice_month', now()->format('Y-m'));
        $academicYear = $data['academic_year'] ?? now()->format('Y');
        $feeRecordRows = $feeRecordSummaryService->summary($school->id, [
            'academic_year' => $academicYear,
            'student_status' => 'active',
        ]);

        $verifiedPayments = Payment::query()
            ->where('school_id', $school->id)
            ->where('status', 'verified');

        $metrics = [
            'today_collection' => (float) (clone $verifiedPayments)
                ->whereDate('payment_date', $today)
                ->sum('amount'),
            'monthly_collection' => (float) (clone $verifiedPayments)
                ->where('payment_date', 'like', $currentMonth.'%')
                ->sum('amount'),
            'outstanding_fees' => (float) collect($feeRecordRows)->sum('total_outstanding'),
            'active_students' => Student::query()
                ->where('school_id', $school->id)
                ->where('status', 'active')
                ->count(),
            'overdue_accounts' => Invoice::query()
                ->where('school_id', $school->id)
                ->where('status', '!=', 'void')
                ->where('outstanding_amount', '>', 0)
                ->whereDate('due_date', '<', $today)
                ->count(),
            'invoices_this_month' => Invoice::query()
                ->where('school_id', $school->id)
                ->where('invoice_month', $currentMonth)
                ->count(),
        ];

        $recentPayments = Payment::query()
            ->with('student')
            ->where('school_id', $school->id)
            ->where('status', 'verified')
            ->latest('payment_date')
            ->limit(5)
            ->get()
            ->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'student' => $payment->student->full_name,
                'amount' => (float) $payment->amount,
                'method' => $payment->payment_method,
                'status' => $payment->status,
                'payment_date' => $payment->payment_date->toDateString(),
            ]);

        $outstandingStudents = Invoice::query()
            ->with(['student.class'])
            ->where('school_id', $school->id)
            ->where('status', '!=', 'void')
            ->where('outstanding_amount', '>', 0)
            ->orderByDesc('outstanding_amount')
            ->limit(5)
            ->get()
            ->map(fn (Invoice $invoice) => [
                'invoice_id' => $invoice->id,
                'student' => $invoice->student->full_name,
                'class_name' => $invoice->student->class?->name,
                'amount' => (float) $invoice->outstanding_amount,
                'due_date' => $invoice->due_date->toDateString(),
                'status' => $invoice->status,
            ]);

        return response()->json([
            'school' => [
                'id' => $school->id,
                'code' => $school->code,
                'name' => $school->name,
            ],
            'metrics' => $metrics,
            'recent_payments' => $recentPayments,
            'outstanding_students' => $outstandingStudents,
        ]);
    }
}
