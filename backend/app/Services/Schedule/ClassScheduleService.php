<?php

namespace App\Services\Schedule;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\ClassScheduleEntry;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClassScheduleService
{
    public function __construct(private readonly AuditLoggerContract $audit) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): ClassScheduleEntry
    {
        $this->validateScope($schoolId, $data);

        return DB::transaction(function () use ($schoolId, $data, $actor, $context): ClassScheduleEntry {
            $entry = ClassScheduleEntry::query()->create([...$data, 'school_id' => $schoolId, 'created_by_user_id' => $actor->id]);
            $this->audit->record(new AuditEvent(action: AuditAction::ClassScheduleCreated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::ClassScheduleEntry, subjectId: $entry->id, newValues: $entry->only(['academic_year_id', 'class_id', 'subject_id', 'teaching_assignment_id', 'title', 'day_of_week', 'starts_at', 'ends_at', 'location', 'effective_from', 'effective_to', 'status'])), $context);

            return $entry;
        });
    }

    public function update(int $schoolId, ClassScheduleEntry $entry, array $data, AuditContext $context): ClassScheduleEntry
    {
        abort_unless((int) $entry->school_id === $schoolId, 403, 'Schedule entry belongs to a different school.');
        $candidate = [...$entry->only(['academic_year_id', 'class_id', 'subject_id', 'teaching_assignment_id']), ...$data];
        $this->validateScope($schoolId, $candidate);

        return DB::transaction(function () use ($schoolId, $entry, $data, $context): ClassScheduleEntry {
            $old = $entry->only(array_keys($data));
            $entry->update($data);
            $this->audit->record(new AuditEvent(action: AuditAction::ClassScheduleUpdated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::ClassScheduleEntry, subjectId: $entry->id, oldValues: $old, newValues: $entry->only(array_keys($data))), $context);

            return $entry;
        });
    }

    private function validateScope(int $schoolId, array $data): void
    {
        AcademicYear::query()->where('school_id', $schoolId)->findOrFail($data['academic_year_id']);
        SchoolClass::query()->where('school_id', $schoolId)->findOrFail($data['class_id']);
        if ($data['subject_id'] ?? null) {
            Subject::query()->where('school_id', $schoolId)->findOrFail($data['subject_id']);
        }
        if ($data['teaching_assignment_id'] ?? null) {
            $assignment = TeachingAssignment::query()->where('school_id', $schoolId)->findOrFail($data['teaching_assignment_id']);
            if ((int) $assignment->academic_year_id !== (int) $data['academic_year_id'] || (int) $assignment->class_id !== (int) $data['class_id'] || ($data['subject_id'] ?? null) && (int) $assignment->subject_id !== (int) $data['subject_id']) {
                throw ValidationException::withMessages(['teaching_assignment_id' => 'The teaching assignment must match the selected year, class, and subject.']);
            }
        }
    }
}
