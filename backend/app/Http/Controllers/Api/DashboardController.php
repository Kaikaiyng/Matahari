<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function school(Request $request): JsonResponse
    {
        $school = School::query()->findOrFail((int) $request->query('school_id', 1));
        $today = now()->toDateString();
        $currentMonth = (string) $request->query('invoice_month', now()->format('Y-m'));

        $confirmedPayments = Payment::query()
            ->where('school_id', $school->id)
            ->where('status', 'confirmed');

        $metrics = [
            'today_collection' => (float) (clone $confirmedPayments)
                ->whereDate('payment_date', $today)
                ->sum('amount'),
            'monthly_collection' => (float) (clone $confirmedPayments)
                ->where('payment_date', 'like', $currentMonth.'%')
                ->sum('amount'),
            'outstanding_fees' => (float) Invoice::query()
                ->where('school_id', $school->id)
                ->where('status', '!=', 'void')
                ->sum('outstanding_amount'),
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
            ->where('status', 'confirmed')
            ->latest('payment_date')
            ->limit(5)
            ->get()
            ->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'student' => $payment->student->full_name,
                'amount' => (float) $payment->amount,
                'method' => $payment->method,
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
