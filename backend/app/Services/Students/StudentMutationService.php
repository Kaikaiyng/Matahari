<?php

namespace App\Services\Students;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Student;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class StudentMutationService
{
    private const AUDITED_FIELDS = [
        'student_no',
        'full_name',
        'level_group',
        'class_id',
        'gender',
        'dob',
        'registration_date',
        'status',
        'notes',
    ];

    public function __construct(
        private readonly AuditLoggerContract $auditLogger,
        private readonly AuditContextFactory $contextFactory,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(int $schoolId, array $data, ?AuditContext $context = null): Student
    {
        return DB::transaction(function () use ($schoolId, $data, $context): Student {
            $student = Student::query()->create([
                ...$data,
                'school_id' => $schoolId,
            ]);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::StudentCreated,
                module: AuditModule::Students,
                schoolId: $schoolId,
                subjectType: AuditSubject::Student,
                subjectId: $student->id,
                newValues: Arr::only($student->getAttributes(), self::AUDITED_FIELDS),
            ), $context ?? $this->contextFactory->system());

            return $student;
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(Student $student, array $data, ?AuditContext $context = null): Student
    {
        return DB::transaction(function () use ($student, $data, $context): Student {
            $locked = Student::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();
            $before = Arr::only($locked->getAttributes(), self::AUDITED_FIELDS);

            $locked->update(Arr::except($data, ['status']));
            $changedFields = array_values(array_intersect(
                array_keys($locked->getChanges()),
                self::AUDITED_FIELDS,
            ));

            if ($changedFields !== []) {
                $this->auditLogger->record(new AuditEvent(
                    action: AuditAction::StudentUpdated,
                    module: AuditModule::Students,
                    schoolId: $locked->school_id,
                    subjectType: AuditSubject::Student,
                    subjectId: $locked->id,
                    oldValues: Arr::only($before, $changedFields),
                    newValues: Arr::only($locked->getAttributes(), $changedFields),
                ), $context ?? $this->contextFactory->system());
            }

            return $locked;
        });
    }

    public function changeStatus(Student $student, string $status, ?AuditContext $context = null): Student
    {
        return DB::transaction(function () use ($student, $status, $context): Student {
            $locked = Student::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();
            $oldStatus = $locked->status;

            if ($oldStatus === $status) {
                return $locked;
            }

            $locked->update(['status' => $status]);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::StudentStatusChanged,
                module: AuditModule::Students,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::Student,
                subjectId: $locked->id,
                oldValues: ['status' => $oldStatus],
                newValues: ['status' => $status],
            ), $context ?? $this->contextFactory->system());

            return $locked;
        });
    }
}
