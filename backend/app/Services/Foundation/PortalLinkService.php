<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PortalLinkService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function linkGuardian(Guardian $guardian, ?int $userId, AuditContext $context): Guardian
    {
        return DB::transaction(function () use ($guardian, $userId, $context): Guardian {
            $locked = Guardian::query()->whereKey($guardian->id)->lockForUpdate()->firstOrFail();
            $user = $this->portalUser($userId, $locked->school_id, 'parent');
            if ($user && Guardian::query()->where('user_id', $user->id)->whereKeyNot($locked->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => 'This portal user is already linked to another parent record.']);
            }
            $oldUserId = $locked->user_id;
            $locked->update(['user_id' => $user?->id]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::GuardianPortalUserLinked,
                module: AuditModule::PortalAccess,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::Guardian,
                subjectId: $locked->id,
                oldValues: ['user_id' => $oldUserId],
                newValues: ['user_id' => $locked->user_id],
            ), $context);

            return $locked;
        });
    }

    public function linkStudent(Student $student, ?int $userId, AuditContext $context): Student
    {
        return DB::transaction(function () use ($student, $userId, $context): Student {
            $locked = Student::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();
            $user = $this->portalUser($userId, $locked->school_id, 'student');
            if ($user && Student::query()->where('user_id', $user->id)->whereKeyNot($locked->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => 'This portal user is already linked to another student record.']);
            }
            $oldUserId = $locked->user_id;
            $locked->update(['user_id' => $user?->id]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::StudentPortalUserLinked,
                module: AuditModule::PortalAccess,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::Student,
                subjectId: $locked->id,
                oldValues: ['user_id' => $oldUserId],
                newValues: ['user_id' => $locked->user_id],
            ), $context);

            return $locked;
        });
    }

    public function updateGuardianAccess(StudentParentLink $link, array $data, AuditContext $context): StudentParentLink
    {
        return DB::transaction(function () use ($link, $data, $context): StudentParentLink {
            $locked = StudentParentLink::query()->whereKey($link->id)->lockForUpdate()->firstOrFail();
            $locked->loadMissing(['student', 'guardian']);

            if ((int) $locked->student->school_id !== (int) $locked->school_id
                || (int) $locked->guardian->school_id !== (int) $locked->school_id) {
                abort(403, 'Guardian relationship crosses school boundaries.');
            }

            if ($data['status'] === 'active' && $locked->guardian->user_id === null) {
                throw ValidationException::withMessages(['status' => 'A reviewed parent portal user link is required before access can be activated.']);
            }

            if ($data['status'] === 'active' && StudentParentLink::query()
                ->where('student_id', $locked->student_id)
                ->where('parent_id', $locked->parent_id)
                ->where('current_slot', 1)
                ->whereKeyNot($locked->id)
                ->exists()) {
                throw ValidationException::withMessages(['status' => 'This guardian relationship already has an active portal access record.']);
            }

            $before = $this->accessSnapshot($locked);
            $values = [
                ...$data,
                'current_slot' => $data['status'] === 'active' ? 1 : null,
                'ended_on' => $data['status'] === 'ended' ? ($data['ended_on'] ?? now()->toDateString()) : null,
            ];
            $locked->update($values);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::GuardianAccessUpdated,
                module: AuditModule::PortalAccess,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::StudentParentLink,
                subjectId: $locked->id,
                oldValues: $before,
                newValues: $this->accessSnapshot($locked->fresh()),
            ), $context);

            return $locked;
        });
    }

    private function portalUser(?int $userId, int $schoolId, string $requiredRole): ?User
    {
        if ($userId === null) {
            return null;
        }

        $user = User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();

        if ((int) $user->school_id !== $schoolId) {
            abort(403, 'Portal user belongs to a different school.');
        }

        if ($user->status !== 'active' || ! $user->roles()->where('slug', $requiredRole)->exists()) {
            throw ValidationException::withMessages(['user_id' => "The selected user must be active and have the {$requiredRole} role."]);
        }

        return $user;
    }

    private function accessSnapshot(StudentParentLink $link): array
    {
        return [
            'status' => $link->status,
            'can_view_finance' => $link->can_view_finance,
            'can_view_academics' => $link->can_view_academics,
            'starts_on' => $link->starts_on?->toDateString(),
            'ended_on' => $link->ended_on?->toDateString(),
            'current_slot' => $link->current_slot,
        ];
    }
}
