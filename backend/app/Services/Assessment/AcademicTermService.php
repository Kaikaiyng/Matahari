<?php

namespace App\Services\Assessment;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicTerm;
use App\Models\AcademicYear;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AcademicTermService
{
    public function __construct(private readonly AuditLoggerContract $audit) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): AcademicTerm
    {
        AcademicYear::query()->where('school_id', $schoolId)->findOrFail($data['academic_year_id']);

        return DB::transaction(function () use ($schoolId, $data, $context): AcademicTerm {
            $term = AcademicTerm::query()->create([...$data, 'school_id' => $schoolId]);
            $this->audit->record(new AuditEvent(action: AuditAction::AcademicTermCreated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::AcademicTerm, subjectId: $term->id, newValues: $term->only(['academic_year_id', 'code', 'name', 'starts_on', 'ends_on', 'status'])), $context);

            return $term;
        });
    }

    public function update(int $schoolId, AcademicTerm $term, array $data, User $actor, AuditContext $context): AcademicTerm
    {
        abort_unless((int) $term->school_id === $schoolId, 403, 'Academic term belongs to a different school.');

        return DB::transaction(function () use ($schoolId, $term, $data, $context): AcademicTerm {
            $old = $term->only(array_keys($data));
            $term->update($data);
            $this->audit->record(new AuditEvent(action: AuditAction::AcademicTermUpdated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::AcademicTerm, subjectId: $term->id, oldValues: $old, newValues: $term->only(array_keys($data))), $context);

            return $term;
        });
    }
}
