<?php

namespace App\Services\Foundation;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FoundationAccountService
{
    private const FOUNDATION_ROLES = ['teacher', 'parent', 'student'];

    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function updateRoles(User $user, array $roleSlugs, AuditContext $context): User
    {
        return DB::transaction(function () use ($user, $roleSlugs, $context): User {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $before = $locked->roles()->pluck('slug')->sort()->values()->all();
            $roleIds = Role::query()->whereIn('slug', $roleSlugs)->pluck('id', 'slug');

            if ($roleIds->count() !== count(array_unique($roleSlugs))) {
                throw ValidationException::withMessages(['roles' => 'One or more foundation roles are unavailable.']);
            }

            $existingFoundationIds = Role::query()->whereIn('slug', self::FOUNDATION_ROLES)->pluck('id');
            $locked->roles()->detach($existingFoundationIds);
            $locked->roles()->attach($roleIds->values());
            $after = $locked->roles()->pluck('slug')->sort()->values()->all();
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::UserRoleChanged,
                module: AuditModule::Users,
                schoolId: $locked->school_id,
                subjectType: AuditSubject::User,
                subjectId: $locked->id,
                oldValues: ['roles' => $before],
                newValues: ['roles' => $after],
                metadata: ['foundation_roles_only' => true],
            ), $context);

            return $locked->load('roles.permissions');
        });
    }
}
