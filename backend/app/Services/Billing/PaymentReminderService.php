<?php

namespace App\Services\Billing;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\ClassEnrolment;
use App\Models\Student;
use App\Models\User;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Notifications\NotificationMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PaymentReminderService
{
    public function __construct(
        private readonly FeeRecordChargeGenerationService $feeRecords,
        private readonly AuditLoggerContract $audit,
        private readonly NotificationDispatcher $notifications,
    ) {}

    /** @return array{student_id:int, academic_year:string, outstanding_amount:float, recipient_count:int} */
    public function send(Student $student, User $actor, AuditContext $context): array
    {
        return DB::transaction(function () use ($student, $actor, $context): array {
            $lockedStudent = Student::query()->with('school')->lockForUpdate()->findOrFail($student->id);
            $enrolment = ClassEnrolment::query()
                ->with('academicYear')
                ->where('school_id', $lockedStudent->school_id)
                ->where('student_id', $lockedStudent->id)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->lockForUpdate()
                ->first();

            if (! $enrolment?->academicYear) {
                throw ValidationException::withMessages([
                    'academic_year' => 'A confirmed current enrolment is required before sending a payment reminder.',
                ]);
            }

            $academicYear = $enrolment->academicYear->code;
            $charges = $this->feeRecords->outstanding($lockedStudent, $academicYear);
            $outstanding = collect($charges)->reduce(
                fn (string $sum, array $charge): string => bcadd($sum, number_format((float) $charge['outstanding_amount'], 2, '.', ''), 2),
                '0.00',
            );
            if (bccomp($outstanding, '0.00', 2) <= 0) {
                throw ValidationException::withMessages([
                    'outstanding' => 'No positive outstanding balance is available for a reminder.',
                ]);
            }

            $recipients = $lockedStudent->parents()
                ->wherePivot('school_id', $lockedStudent->school_id)
                ->wherePivot('status', 'active')
                ->wherePivot('can_view_finance', true)
                ->whereNotNull('parents.user_id')
                ->whereHas('portalUser', fn ($query) => $query
                    ->where('users.school_id', $lockedStudent->school_id)
                    ->where('users.status', 'active')
                    ->whereHas('tenantMemberships', fn ($membership) => $membership
                        ->where('tenant_id', $lockedStudent->school->tenant_id)
                        ->where('status', 'active')))
                ->get()
                ->pluck('user_id')
                ->unique()
                ->values();

            if ($recipients->isEmpty()) {
                throw ValidationException::withMessages([
                    'recipients' => 'No active finance-enabled guardian account is available for this student.',
                ]);
            }

            $calculatedAt = now();
            $this->notifications->sendInApp(new NotificationMessage(
                tenantId: (int) $lockedStudent->school->tenant_id,
                schoolId: (int) $lockedStudent->school_id,
                type: 'payment_reminder',
                title: "Payment reminder for {$lockedStudent->full_name}",
                body: 'The current outstanding school balance is RM '.number_format((float) $outstanding, 2).'.',
                context: [
                    'student_id' => $lockedStudent->id,
                    'student_name' => $lockedStudent->full_name,
                    'academic_year' => $academicYear,
                    'outstanding_amount' => (float) $outstanding,
                    'calculated_at' => $calculatedAt->toISOString(),
                ],
            ), $recipients);

            $this->audit->record(new AuditEvent(
                action: AuditAction::PaymentReminderSent,
                module: AuditModule::Payments,
                schoolId: $lockedStudent->school_id,
                subjectType: AuditSubject::Student,
                subjectId: $lockedStudent->id,
                newValues: [
                    'academic_year' => $academicYear,
                    'outstanding_amount' => $outstanding,
                    'recipient_count' => $recipients->count(),
                ],
                metadata: [
                    'recipient_user_ids' => $recipients->all(),
                    'sent_by' => $actor->id,
                ],
            ), $context);

            return [
                'student_id' => $lockedStudent->id,
                'academic_year' => $academicYear,
                'outstanding_amount' => (float) $outstanding,
                'recipient_count' => $recipients->count(),
            ];
        });
    }
}
