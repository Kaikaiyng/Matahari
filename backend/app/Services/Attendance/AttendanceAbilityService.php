<?php

namespace App\Services\Attendance;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Permission;
use App\Models\User;
use App\Models\UserAttendanceAbility;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceAbilityService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function grant(int $schoolId, array $data, User $actor, AuditContext $context): UserAttendanceAbility
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): UserAttendanceAbility {
            $user = User::query()->whereKey($data['user_id'])->lockForUpdate()->firstOrFail();
            if ((int) $user->school_id !== $schoolId) {
                abort(403, 'User belongs to a different school.');
            }

            $permission = Permission::query()->where('slug', $data['permission'])->firstOrFail();
            if (! str_starts_with($permission->slug, 'attendance.')) {
                throw ValidationException::withMessages(['permission' => 'Only Attendance abilities can be granted here.']);
            }

            $ability = UserAttendanceAbility::query()->create([
                'school_id' => $schoolId,
                'user_id' => $user->id,
                'permission_id' => $permission->id,
                'effective_from' => $data['effective_from'],
                'expires_at' => $data['expires_at'] ?? null,
                'granted_by' => $actor->id,
                'reason' => $data['reason'],
            ]);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::AttendanceAbilityGranted,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::UserAttendanceAbility,
                subjectId: $ability->id,
                newValues: $this->snapshot($ability->load('permission')),
                reason: $data['reason'],
            ), $context);

            return $ability;
        });
    }

    public function revoke(int $schoolId, UserAttendanceAbility $ability, string $reason, User $actor, AuditContext $context): UserAttendanceAbility
    {
        return DB::transaction(function () use ($schoolId, $ability, $reason, $actor, $context): UserAttendanceAbility {
            $locked = UserAttendanceAbility::query()->whereKey($ability->id)->lockForUpdate()->firstOrFail();
            if ((int) $locked->school_id !== $schoolId) {
                abort(403, 'Attendance ability belongs to a different school.');
            }
            if ($locked->revoked_at !== null) {
                return $locked->load('permission');
            }

            $before = $this->snapshot($locked->load('permission'));
            $locked->update([
                'revoked_by' => $actor->id,
                'revoked_at' => now(),
            ]);
            $locked->refresh()->load('permission');

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::AttendanceAbilityRevoked,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::UserAttendanceAbility,
                subjectId: $locked->id,
                oldValues: $before,
                newValues: $this->snapshot($locked),
                reason: $reason,
            ), $context);

            return $locked;
        });
    }

    private function snapshot(UserAttendanceAbility $ability): array
    {
        return [
            'user_id' => $ability->user_id,
            'permission' => $ability->permission->slug,
            'effective_from' => $ability->effective_from?->toIso8601String(),
            'expires_at' => $ability->expires_at?->toIso8601String(),
            'revoked_at' => $ability->revoked_at?->toIso8601String(),
        ];
    }
}
