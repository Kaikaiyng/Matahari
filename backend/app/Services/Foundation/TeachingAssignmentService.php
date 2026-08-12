<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeachingAssignmentService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): TeachingAssignment
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): TeachingAssignment {
            $year = AcademicYear::query()->whereKey($data['academic_year_id'])->firstOrFail();
            $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
            $subject = Subject::query()->whereKey($data['subject_id'])->firstOrFail();
            $teacher = User::query()->whereKey($data['teacher_user_id'])->lockForUpdate()->firstOrFail();
            foreach ([$year, $class, $subject, $teacher] as $record) {
                if ((int) $record->school_id !== $schoolId) {
                    abort(403, 'Teaching assignment record belongs to a different school.');
                }
            }

            if (! $teacher->roles()->where('slug', 'teacher')->exists()) {
                throw ValidationException::withMessages(['teacher_user_id' => 'The selected user does not have the teacher role.']);
            }

            if (TeachingAssignment::query()
                ->where('school_id', $schoolId)
                ->where('academic_year_id', $year->id)
                ->where('class_id', $class->id)
                ->where('subject_id', $subject->id)
                ->where('teacher_user_id', $teacher->id)
                ->where('current_slot', 1)
                ->exists()) {
                throw ValidationException::withMessages(['teacher_user_id' => 'This current teaching assignment already exists.']);
            }

            $assignment = TeachingAssignment::query()->create([
                ...$data,
                'school_id' => $schoolId,
                'status' => 'active',
                'current_slot' => 1,
                'created_by' => $actor->id,
            ]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TeachingAssignmentCreated,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::TeachingAssignment,
                subjectId: $assignment->id,
                newValues: $assignment->getAttributes(),
            ), $context);

            return $assignment;
        });
    }

    public function end(TeachingAssignment $assignment, string $endedOn, User $actor, AuditContext $context): TeachingAssignment
    {
        return DB::transaction(function () use ($assignment, $endedOn, $actor, $context): TeachingAssignment {
            $locked = TeachingAssignment::query()->whereKey($assignment->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'active' || $locked->current_slot === null) {
                throw ValidationException::withMessages(['teaching_assignment' => 'Only a current active teaching assignment can be ended.']);
            }

            if ($locked->starts_on && $locked->starts_on->gt($endedOn)) {
                throw ValidationException::withMessages(['ended_on' => 'The end date cannot be before the teaching assignment start date.']);
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
                action: AuditAction::TeachingAssignmentEnded,
                module: AuditModule::Academics,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::TeachingAssignment,
                subjectId: $locked->id,
                oldValues: $before,
                newValues: ['status' => 'ended', 'current_slot' => null, 'ended_on' => $endedOn],
            ), $context);

            return $locked;
        });
    }
}
