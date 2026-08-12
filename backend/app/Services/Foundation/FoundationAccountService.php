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
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class FoundationAccountService
{
    private const FOUNDATION_ROLES = ['teacher', 'parent', 'student'];

    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(int $schoolId, array $data, AuditContext $context): User
    {
        return DB::transaction(function () use ($schoolId, $data, $context): User {
            $roles = $this->foundationRoles($data['roles']);
            $user = User::query()->create([
                'school_id' => $schoolId,
                'name' => $data['name'],
                'username' => $data['username'],
                'password' => Hash::make($data['password']),
                'status' => 'active',
            ]);
            $user->roles()->attach($roles->pluck('id'));
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::UserCreated,
                module: AuditModule::Users,
                schoolId: $schoolId,
                subjectType: AuditSubject::User,
                subjectId: $user->id,
                newValues: [
                    'name' => $user->name,
                    'username' => $user->username,
                    'status' => $user->status,
                    'roles' => $roles->pluck('slug')->sort()->values()->all(),
                ],
            ), $context);

            return $user->load('roles.permissions');
        });
    }

    public function updateRoles(User $user, array $roleSlugs, AuditContext $context): User
    {
        return DB::transaction(function () use ($user, $roleSlugs, $context): User {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $before = $locked->roles()->pluck('slug')->sort()->values()->all();
            $roles = $this->foundationRoles($roleSlugs);

            $existingFoundationIds = Role::query()->whereIn('slug', self::FOUNDATION_ROLES)->pluck('id');
            $locked->roles()->detach($existingFoundationIds);
            $locked->roles()->attach($roles->pluck('id'));
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

    private function foundationRoles(array $roleSlugs): Collection
    {
        $roles = Role::query()->whereIn('slug', $roleSlugs)->get();

        if ($roles->count() !== count(array_unique($roleSlugs))) {
            throw ValidationException::withMessages(['roles' => 'One or more foundation roles are unavailable.']);
        }

        return $roles;
    }
}
