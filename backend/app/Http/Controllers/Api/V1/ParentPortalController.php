<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AssessmentResult;
use App\Models\AttendanceRecord;
use App\Models\CampusAttendanceEvent;
use App\Models\Guardian;
use App\Models\Receipt;
use App\Models\Student;
use App\Services\Billing\FeeRecordChargeGenerationService;
use App\Services\Schedule\ScheduleReadService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParentPortalController extends Controller
{
    /**
     * Return the authenticated user's linked guardian record and their accessible children.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        SchoolContext::fromRequest($request);

        $guardian = Guardian::where('user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->first();

        if (! $guardian) {
            return response()->json(['data' => null, 'children' => []], 200);
        }

        $children = $guardian->students()
            ->wherePivot('status', 'active')
            ->with([
                'class',
                'classEnrolments' => fn ($query) => $query
                    ->where('current_slot', 1)
                    ->with('academicYear'),
            ])
            ->get()
            ->map(fn (Student $s) => $this->studentSummary($s));

        return response()->json([
            'data' => [
                'id' => $guardian->id,
                'full_name' => $guardian->full_name,
                'phone' => $guardian->phone,
                'email' => $guardian->email,
            ],
            'children' => $children,
        ]);
    }

    /**
     * Return outstanding charges for a specific child, enforcing active guardian-child link.
     */
    public function childOutstanding(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertGuardianAccess($request, $student, 'can_view_finance');

        $data = $request->validate([
            'academic_year' => ['required', 'string', 'regex:/^\d{4}$/'],
        ]);

        return response()->json(['data' => $service->outstanding($student, $data['academic_year'])]);
    }

    /**
     * Return payment history for a specific child.
     */
    public function childPayments(Request $request, Student $student): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_finance');

        $payments = $student->payments()
            ->with(['issuedReceipt'])
            ->latest('payment_date')
            ->latest('id')
            ->get()
            ->map(fn ($payment) => [
                'id' => $payment->id,
                'payment_date' => $payment->payment_date->toDateString(),
                'amount' => (float) $payment->amount,
                'paid_by' => $payment->paid_by,
                'payment_method' => $payment->payment_method,
                'status' => $payment->status,
                'issued_receipt' => $payment->issuedReceipt ? [
                    'id' => $payment->issuedReceipt->id,
                    'receipt_no' => $payment->issuedReceipt->receipt_no,
                    'receipt_date' => $payment->issuedReceipt->receipt_date->toDateString(),
                    'status' => $payment->issuedReceipt->status,
                ] : null,
            ]);

        return response()->json(['data' => $payments]);
    }

    /**
     * Return receipts for a specific child.
     */
    public function childReceipts(Request $request, Student $student): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_finance');

        $receipts = $student->receipts()
            ->with(['items'])
            ->latest('receipt_date')
            ->latest('id')
            ->get()
            ->map(fn (Receipt $receipt) => $this->receiptResponse($receipt));

        return response()->json(['data' => $receipts]);
    }

    /**
     * Return one immutable receipt snapshot for a finance-enabled linked child.
     */
    public function childReceipt(Request $request, Student $student, Receipt $receipt): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_finance');

        if ((int) $receipt->school_id !== (int) $student->school_id
            || (int) $receipt->student_id !== (int) $student->id) {
            abort(403, 'Receipt does not belong to this student.');
        }

        return response()->json(['data' => $this->receiptResponse($receipt->load('items'))]);
    }

    public function childAttendance(Request $request, Student $student): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_academics');
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $records = AttendanceRecord::query()
            ->with(['session.schoolClass'])
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->when($data['from'] ?? null, fn ($query, $date) => $query->whereHas('session', fn ($session) => $session->whereDate('attendance_date', '>=', $date)))
            ->when($data['to'] ?? null, fn ($query, $date) => $query->whereHas('session', fn ($session) => $session->whereDate('attendance_date', '<=', $date)))
            ->latest('id')
            ->get();

        return response()->json(['data' => $this->attendanceResponse($records)]);
    }

    public function childCampusAttendance(Request $request, Student $student): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_academics');
        $data = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $date = $data['date'] ?? now()->toDateString();
        $events = CampusAttendanceEvent::query()->with('device:id,name')
            ->where('school_id', $student->school_id)->where('student_id', $student->id)
            ->whereDate('event_date', $date)->orderBy('occurred_at')->get();
        $latest = $events->last();

        return response()->json(['data' => [
            'date' => $date,
            'current_status' => $latest ? ($latest->direction === 'entry' ? 'on_campus' : 'off_campus') : 'no_record',
            'first_entry' => $events->firstWhere('direction', 'entry')?->occurred_at?->toIso8601String(),
            'last_exit' => $events->where('direction', 'exit')->last()?->occurred_at?->toIso8601String(),
            'events' => $events->map(fn ($event) => ['id' => $event->id, 'direction' => $event->direction, 'method' => $event->method, 'occurred_at' => $event->occurred_at->toIso8601String(), 'device_name' => $event->device?->name]),
        ]]);
    }

    public function childAssessmentResults(Request $request, Student $student): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_academics');

        return response()->json(['data' => $this->publishedResults($student)]);
    }

    public function childSchedule(Request $request, Student $student, ScheduleReadService $service): JsonResponse
    {
        $this->assertGuardianAccess($request, $student, 'can_view_academics');

        return response()->json(['data' => $service->forStudent($student)]);
    }

    private function publishedResults(Student $student): array
    {
        return AssessmentResult::query()->with('assessment.subject')->where('school_id', $student->school_id)->where('student_id', $student->id)
            ->where('status', 'published')->whereHas('assessment', fn ($q) => $q->where('status', 'published'))->latest('published_at')->get()
            ->map(fn (AssessmentResult $result) => ['id' => $result->id, 'assessment_id' => $result->assessment_id, 'title' => $result->assessment->title, 'assessment_type' => $result->assessment->assessment_type, 'subject' => $result->assessment->subject->name, 'score' => (float) $result->score, 'max_score' => (float) $result->assessment->max_score, 'grade_label' => $result->grade_label, 'teacher_comment' => $result->teacher_comment, 'published_at' => $result->published_at?->toIso8601String()])->values()->all();
    }

    /**
     * Enforce that the authenticated user is an active guardian of the student
     * with the required access flag.
     */
    private function assertGuardianAccess(Request $request, Student $student, string $flag): void
    {
        $user = $request->user();

        if ((int) $student->school_id !== (int) $user->school_id) {
            abort(403, 'Student belongs to a different school.');
        }

        $guardian = Guardian::where('user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->first();

        if (! $guardian) {
            abort(403, 'No guardian record linked to this account.');
        }

        $link = $guardian->students()
            ->where('students.id', $student->id)
            ->wherePivot('status', 'active')
            ->wherePivot($flag, true)
            ->first();

        if (! $link) {
            abort(403, 'Access to this student record is not authorized.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function studentSummary(Student $student): array
    {
        $currentEnrolment = $student->classEnrolments->first();

        return [
            'id' => $student->id,
            'student_no' => $student->student_no,
            'full_name' => $student->full_name,
            'status' => $student->status,
            'class' => $student->class ? ['id' => $student->class->id, 'name' => $student->class->name] : null,
            'academic_year' => $currentEnrolment?->academicYear ? [
                'id' => $currentEnrolment->academicYear->id,
                'code' => $currentEnrolment->academicYear->code,
                'name' => $currentEnrolment->academicYear->name,
            ] : null,
            'can_view_finance' => (bool) $student->pivot?->can_view_finance,
            'can_view_academics' => (bool) $student->pivot?->can_view_academics,
        ];
    }

    /** @return array<string, mixed> */
    private function receiptResponse(Receipt $receipt): array
    {
        return [
            'id' => $receipt->id,
            'receipt_no' => $receipt->receipt_no,
            'receipt_date' => $receipt->receipt_date->toDateString(),
            'student_no' => $receipt->student_no,
            'student_name' => $receipt->student_name,
            'amount' => (float) $receipt->amount,
            'amount_in_words' => $receipt->amount_in_words,
            'paid_by' => $receipt->paid_by,
            'payment_method' => $receipt->payment_method,
            'payment_date' => $receipt->payment_date->toDateString(),
            'received_date' => $receipt->received_date?->toDateString(),
            'status' => $receipt->status,
            'issued_at' => $receipt->issued_at?->toIso8601String(),
            'voided_at' => $receipt->voided_at?->toIso8601String(),
            'void_reason' => $receipt->void_reason,
            'items' => $receipt->items->map(fn ($item) => [
                'fee_code' => $item->fee_code,
                'description' => $item->description,
                'amount' => (float) $item->amount,
            ])->values(),
        ];
    }

    private function attendanceResponse($records): array
    {
        return $records->map(fn (AttendanceRecord $record) => [
            'id' => $record->id,
            'attendance_date' => $record->session->attendance_date->toDateString(),
            'session_type' => $record->session->session_type,
            'status' => $record->status,
            'public_note' => $record->public_note,
            'class' => ['id' => $record->session->schoolClass->id, 'name' => $record->session->schoolClass->name],
        ])->values()->all();
    }
}
