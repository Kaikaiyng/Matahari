<?php

namespace App\Services\SchoolSettings;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\School;
use App\Models\SchoolSupportSetting;
use Illuminate\Support\Facades\DB;

final class SchoolSettingsService
{
    private const SCHOOL_FIELDS = [
        'name', 'registration_number', 'group_member_line', 'address', 'phone', 'email', 'operating_hours',
    ];

    private const SUPPORT_FIELDS = [
        'call_phone', 'whatsapp_phone', 'support_email', 'operating_hours',
    ];

    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    /** @return array<string, mixed> */
    public function schoolInformation(int $schoolId): array
    {
        return School::query()->findOrFail($schoolId)->only(self::SCHOOL_FIELDS);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function updateSchoolInformation(int $schoolId, array $data, AuditContext $context): array
    {
        return DB::transaction(function () use ($schoolId, $data, $context): array {
            $school = School::query()->whereKey($schoolId)->lockForUpdate()->firstOrFail();
            $before = $school->only(self::SCHOOL_FIELDS);
            $school->update($data);
            $after = $school->fresh()->only(self::SCHOOL_FIELDS);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::SchoolInformationUpdated,
                module: AuditModule::Tenancy,
                schoolId: $schoolId,
                subjectType: AuditSubject::School,
                subjectId: $schoolId,
                oldValues: $before,
                newValues: $after,
                reason: 'School information updated.',
            ), $context);

            return $after;
        });
    }

    /** @return array<string, mixed> */
    public function appSupport(int $schoolId): array
    {
        $settings = SchoolSupportSetting::query()->where('school_id', $schoolId)->first();

        return $settings?->only(self::SUPPORT_FIELDS) ?? array_fill_keys(self::SUPPORT_FIELDS, null);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function updateAppSupport(int $schoolId, int $userId, array $data, AuditContext $context): array
    {
        return DB::transaction(function () use ($schoolId, $userId, $data, $context): array {
            School::query()->whereKey($schoolId)->lockForUpdate()->firstOrFail();
            $settings = SchoolSupportSetting::query()->where('school_id', $schoolId)->lockForUpdate()->first();
            $before = $settings?->only(self::SUPPORT_FIELDS) ?? array_fill_keys(self::SUPPORT_FIELDS, null);
            $settings ??= new SchoolSupportSetting(['school_id' => $schoolId]);
            $settings->fill([...$data, 'updated_by' => $userId]);
            $settings->save();
            $after = $settings->fresh()->only(self::SUPPORT_FIELDS);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::SchoolAppSupportUpdated,
                module: AuditModule::Tenancy,
                schoolId: $schoolId,
                subjectType: AuditSubject::SchoolSupportSetting,
                subjectId: $settings->id,
                oldValues: $before,
                newValues: $after,
                reason: 'School App Support settings updated.',
            ), $context);

            return $after;
        });
    }
}
