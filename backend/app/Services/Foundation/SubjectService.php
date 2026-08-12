<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Subject;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class SubjectService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(int $schoolId, array $data, AuditContext $context): Subject
    {
        return DB::transaction(function () use ($schoolId, $data, $context): Subject {
            $subject = Subject::query()->create([...$data, 'school_id' => $schoolId]);
            $this->audit($subject, AuditAction::SubjectCreated, [], $subject->getAttributes(), $context);

            return $subject;
        });
    }

    public function update(Subject $subject, array $data, AuditContext $context): Subject
    {
        return DB::transaction(function () use ($subject, $data, $context): Subject {
            $locked = Subject::query()->whereKey($subject->id)->lockForUpdate()->firstOrFail();
            $before = Arr::only($locked->getAttributes(), array_keys($data));
            $locked->update($data);
            $this->audit($locked, AuditAction::SubjectUpdated, $before, Arr::only($locked->getAttributes(), array_keys($data)), $context);

            return $locked;
        });
    }

    private function audit(Subject $subject, AuditAction $action, array $old, array $new, AuditContext $context): void
    {
        $this->auditLogger->record(new AuditEvent(
            action: $action,
            module: AuditModule::Academics,
            schoolId: $subject->school_id,
            subjectType: AuditSubject::Subject,
            subjectId: $subject->id,
            oldValues: $old,
            newValues: $new,
        ), $context);
    }
}
