<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClassEnrolmentService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): ClassEnrolment
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): ClassEnrolment {
            $year = AcademicYear::query()->whereKey($data['academic_year_id'])->lockForUpdate()->firstOrFail();
            $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
            $student = Student::query()->whereKey($data['student_id'])->lockForUpdate()->firstOrFail();
            $this->assertAllBelongToSchool($schoolId, $year, $class, $student);

            if (ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('academic_year_id', $year->id)
                ->where('student_id', $student->id)
                ->where('current_slot', 1)
                ->exists()) {
                throw ValidationException::withMessages(['student_id' => 'The student already has a current enrolment for this academic year.']);
            }

            $enrolment = ClassEnrolment::query()->create([
                ...$data,
                'school_id' => $schoolId,
                'status' => 'active',
                'current_slot' => 1,
                'created_by' => $actor->id,
            ]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::ClassEnrolmentCreated,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::ClassEnrolment,
                subjectId: $enrolment->id,
                newValues: $enrolment->getAttributes(),
            ), $context);

            return $enrolment;
        });
    }

    public function end(ClassEnrolment $enrolment, string $endedOn, User $actor, AuditContext $context): ClassEnrolment
    {
        return DB::transaction(function () use ($enrolment, $endedOn, $actor, $context): ClassEnrolment {
            $locked = ClassEnrolment::query()->whereKey($enrolment->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'active' || $locked->current_slot === null) {
                throw ValidationException::withMessages(['class_enrolment' => 'Only a current active enrolment can be ended.']);
            }

            if ($locked->starts_on && $locked->starts_on->gt($endedOn)) {
                throw ValidationException::withMessages(['ended_on' => 'The end date cannot be before the enrolment start date.']);
            }

            $before = ['status' => $locked->status, 'current_slot' => $locked->current_slot, 'ended_on' => $locked->ended_on?->toDateString()];
            $locked->update([
                'status' => 'ended',
                'current_slot' => null,
                'ended_on' => $endedOn,
                'ended_by' => $actor->id,
                'ended_at' => now(),
            ]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::ClassEnrolmentEnded,
                module: AuditModule::Academics,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::ClassEnrolment,
                subjectId: $locked->id,
                oldValues: $before,
                newValues: ['status' => 'ended', 'current_slot' => null, 'ended_on' => $endedOn],
            ), $context);

            return $locked;
        });
    }

    private function assertAllBelongToSchool(int $schoolId, mixed ...$records): void
    {
        foreach ($records as $record) {
            if ((int) $record->school_id !== $schoolId) {
                abort(403, 'Academic record belongs to a different school.');
            }
        }
    }
}
