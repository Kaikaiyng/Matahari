<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcademicYearService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(int $schoolId, array $data, AuditContext $context): AcademicYear
    {
        return DB::transaction(function () use ($schoolId, $data, $context): AcademicYear {
            $year = AcademicYear::query()->create([...$data, 'school_id' => $schoolId, 'current_slot' => null]);
            $this->audit($year, AuditAction::AcademicYearCreated, [], $year->getAttributes(), $context);

            return $year;
        });
    }

    public function update(AcademicYear $year, array $data, AuditContext $context): AcademicYear
    {
        return DB::transaction(function () use ($year, $data, $context): AcademicYear {
            $locked = AcademicYear::query()->whereKey($year->id)->lockForUpdate()->firstOrFail();
            $startsOn = $data['starts_on'] ?? $locked->starts_on?->toDateString();
            $endsOn = $data['ends_on'] ?? $locked->ends_on?->toDateString();

            if ($startsOn && $endsOn && $startsOn > $endsOn) {
                throw ValidationException::withMessages(['ends_on' => 'The academic year end date cannot be before its start date.']);
            }
            $before = Arr::only($locked->getAttributes(), array_keys($data));
            $locked->update($data);
            $this->audit($locked, AuditAction::AcademicYearUpdated, $before, Arr::only($locked->getAttributes(), array_keys($data)), $context);

            return $locked;
        });
    }

    public function activate(AcademicYear $year, AuditContext $context): AcademicYear
    {
        return DB::transaction(function () use ($year, $context): AcademicYear {
            $years = AcademicYear::query()->where('school_id', $year->school_id)->lockForUpdate()->get();
            $locked = $years->firstWhere('id', $year->id) ?? abort(404);
            AcademicYear::query()
                ->where('school_id', $year->school_id)
                ->where('id', '!=', $year->id)
                ->whereNotNull('current_slot')
                ->update(['current_slot' => null]);
            $before = Arr::only($locked->getAttributes(), ['status', 'current_slot']);
            $locked->update(['status' => 'active', 'current_slot' => 1]);
            $this->audit($locked, AuditAction::AcademicYearActivated, $before, ['status' => 'active', 'current_slot' => 1], $context);

            return $locked;
        });
    }

    private function audit(AcademicYear $year, AuditAction $action, array $old, array $new, AuditContext $context): void
    {
        $this->auditLogger->record(new AuditEvent(
            action: $action,
            module: AuditModule::Academics,
            schoolId: $year->school_id,
            subjectType: AuditSubject::AcademicYear,
            subjectId: $year->id,
            oldValues: $old,
            newValues: $new,
        ), $context);
    }
}
