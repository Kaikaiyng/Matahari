<?php

namespace App\Services\Authorization;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class EmployeeAccessService
{
    public function __construct(
        private readonly EmployeeAccessCatalog $catalog,
        private readonly UserPermissionResolver $resolver,
        private readonly AuditLoggerContract $audit,
    ) {}

    public function payload(User $user, int $schoolId): array
    {
        $this->assertTarget($user, $schoolId);
        $position = $this->position($user);
        $defaults = $this->defaultPermissions($position);
        $effective = array_values(array_intersect($this->catalog->slugs(), $this->resolver->effectiveSlugs($user, $schoolId)));

        return [
            'position' => $position,
            'positions' => [
                ['value' => 'school-admin', 'label' => 'School Admin'],
                ['value' => 'finance', 'label' => 'Finance'],
                ['value' => 'teacher', 'label' => 'Teacher'],
            ],
            'groups' => $this->catalog->groups(),
            'dependencies' => $this->catalog->dependencies(),
            'position_defaults' => collect(EmployeeAccessCatalog::POSITIONS)->mapWithKeys(fn (string $slug): array => [
                $slug => array_values(array_diff($this->defaultPermissions($slug), ['app.teacher_access'])),
            ])->all(),
            'default_permissions' => array_values(array_diff($defaults, ['app.teacher_access'])),
            'permissions' => array_values(array_diff($effective, ['app.teacher_access'])),
            'teacher_app_access' => in_array('app.teacher_access', $effective, true),
        ];
    }

    public function update(User $target, int $schoolId, array $data, User $actor, AuditContext $context): array
    {
        if ($target->is($actor)) {
            abort(403, 'You cannot edit your own position or abilities.');
        }
        $this->assertTarget($target, $schoolId);

        return DB::transaction(function () use ($target, $schoolId, $data, $actor, $context): array {
            $locked = User::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->assertTarget($locked, $schoolId);
            $before = $this->payload($locked, $schoolId);
            $position = $data['position'];
            $desired = $this->normalize($data['permissions']);
            if ($data['teacher_app_access']) {
                $desired[] = 'app.teacher_access';
            }
            $desired = array_values(array_unique($desired));

            $this->syncPosition($locked, $position);
            $defaults = $this->defaultPermissions($position);
            $permissions = Permission::query()->whereIn('slug', $this->catalog->slugs())->get()->keyBy('slug');
            foreach ($this->catalog->slugs() as $slug) {
                $permission = $permissions->get($slug);
                if (! $permission) {
                    continue;
                }
                $wanted = in_array($slug, $desired, true);
                $default = in_array($slug, $defaults, true);
                if ($wanted === $default) {
                    UserPermissionOverride::query()->where([
                        'school_id' => $schoolId, 'user_id' => $locked->id, 'permission_id' => $permission->id,
                    ])->delete();
                } else {
                    UserPermissionOverride::query()->updateOrCreate(
                        ['school_id' => $schoolId, 'user_id' => $locked->id, 'permission_id' => $permission->id],
                        ['allowed' => $wanted, 'reason' => $data['reason'], 'updated_by' => $actor->id],
                    );
                }
            }

            $locked->unsetRelation('roles');
            $after = $this->payload($locked, $schoolId);
            if ($before['position'] !== $after['position']) {
                $this->record(AuditAction::EmployeePositionChanged, $locked, $schoolId, $before, $after, $data['reason'], $context);
            }
            if ($before['permissions'] !== $after['permissions']) {
                $this->record(AuditAction::EmployeeAbilitiesUpdated, $locked, $schoolId, $before, $after, $data['reason'], $context);
            }
            if ($before['teacher_app_access'] !== $after['teacher_app_access']) {
                $this->record(AuditAction::EmployeeAppAccessChanged, $locked, $schoolId, $before, $after, $data['reason'], $context);
            }

            return $after;
        });
    }

    private function syncPosition(User $user, string $position): void
    {
        $employeeRoleIds = Role::query()->whereIn('slug', EmployeeAccessCatalog::POSITIONS)->pluck('id');
        $role = Role::query()->where('slug', $position)->firstOrFail();
        $user->roles()->detach($employeeRoleIds);
        $user->roles()->syncWithoutDetaching([$role->id]);
        $school = $user->school()->first();
        $membership = $school?->tenant_id ? $user->tenantMembership((int) $school->tenant_id) : null;
        if ($membership) {
            $membership->roles()->detach($employeeRoleIds);
            $membership->roles()->syncWithoutDetaching([$role->id]);
        }
    }

    private function defaultPermissions(string $position): array
    {
        return Role::query()->where('slug', $position)->firstOrFail()->permissions()
            ->whereIn('slug', $this->catalog->slugs())->pluck('slug')->all();
    }

    private function position(User $user): string
    {
        $position = $user->roles()->whereIn('slug', EmployeeAccessCatalog::POSITIONS)->value('slug');
        if (! $position) {
            throw ValidationException::withMessages(['user' => 'This account is not a school employee.']);
        }

        return $position;
    }

    private function normalize(array $permissions): array
    {
        $allowed = array_values(array_intersect(array_unique($permissions), $this->catalog->slugs()));
        if (count($allowed) !== count(array_unique($permissions))) {
            throw ValidationException::withMessages(['permissions' => 'One or more abilities cannot be assigned.']);
        }
        foreach ($this->catalog->dependencies() as $manage => $view) {
            if (in_array($manage, $allowed, true) && ! in_array($view, $allowed, true)) {
                $allowed[] = $view;
            }
        }

        return array_values(array_unique($allowed));
    }

    private function assertTarget(User $user, int $schoolId): void
    {
        if ($user->is_platform_owner || (int) $user->school_id !== $schoolId) {
            abort(403, 'This employee cannot be managed from the current school.');
        }
        $this->position($user);
    }

    private function record(AuditAction $action, User $user, int $schoolId, array $before, array $after, string $reason, AuditContext $context): void
    {
        $this->audit->record(new AuditEvent(
            action: $action,
            module: AuditModule::Users,
            schoolId: $schoolId,
            subjectType: AuditSubject::User,
            subjectId: $user->id,
            oldValues: $before,
            newValues: $after,
            reason: $reason,
        ), $context);
    }
}
