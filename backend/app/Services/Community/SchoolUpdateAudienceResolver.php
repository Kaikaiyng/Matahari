<?php

namespace App\Services\Community;

use App\Models\ClassEnrolment;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\StudentParentLink;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Services\Authorization\UserPermissionResolver;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SchoolUpdateAudienceResolver
{
    public function __construct(private readonly UserPermissionResolver $permissions) {}

    /** @return list<int> */
    public function visibleClassIds(User $user, int $schoolId): array
    {
        if ($this->permissions->has($user, 'community.moderate', $schoolId)) {
            return SchoolClass::query()
                ->where('school_id', $schoolId)
                ->where('status', 'active')
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        $ids = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('teacher_user_id', $user->id)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->pluck('class_id');

        if ($user->studentProfile?->school_id === $schoolId && $user->studentProfile->status === 'active') {
            $ids = $ids->merge(ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('student_id', $user->studentProfile->id)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->pluck('class_id'));
        }

        if ($user->guardianProfile) {
            $studentIds = $user->guardianProfile->students()
                ->where('students.status', 'active')
                ->wherePivot('school_id', $schoolId)
                ->wherePivot('status', 'active')
                ->wherePivot('current_slot', 1)
                ->pluck('students.id');
            $ids = $ids->merge(ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->whereIn('student_id', $studentIds)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->pluck('class_id'));
        }

        return $ids->map(fn ($id): int => (int) $id)->unique()->sort()->values()->all();
    }

    /**
     * @param  list<array{type:'school'|'class',class_id?:int}>  $audiences
     * @return list<int>
     */
    public function recipientUserIds(int $schoolId, array $audiences, ?int $excludeUserId = null): array
    {
        $eligibleUserIds = $this->eligibleCommunityUserIds($schoolId);
        if (collect($audiences)->contains(fn (array $audience): bool => $audience['type'] === 'school')) {
            return $this->normalizeRecipientIds($eligibleUserIds->all(), $excludeUserId);
        }

        $classIds = collect($audiences)->where('type', 'class')->pluck('class_id')
            ->map(fn ($id): int => (int) $id)->unique()->values()->all();
        if ($classIds === []) {
            return [];
        }

        $studentUserIds = ClassEnrolment::query()
            ->where('class_enrolments.school_id', $schoolId)->whereIn('class_enrolments.class_id', $classIds)
            ->where('class_enrolments.status', 'active')->where('class_enrolments.current_slot', 1)
            ->join('students', 'students.id', '=', 'class_enrolments.student_id')
            ->where('students.status', 'active')->whereNotNull('students.user_id')
            ->pluck('students.user_id')->all();
        $guardianUserIds = StudentParentLink::query()
            ->where('student_parent_links.school_id', $schoolId)->where('student_parent_links.status', 'active')->where('student_parent_links.current_slot', 1)
            ->join('students', function ($join): void {
                $join->on('students.id', '=', 'student_parent_links.student_id')->where('students.status', '=', 'active');
            })
            ->join('class_enrolments', function ($join) use ($schoolId, $classIds): void {
                $join->on('class_enrolments.student_id', '=', 'student_parent_links.student_id')
                    ->where('class_enrolments.school_id', '=', $schoolId)->whereIn('class_enrolments.class_id', $classIds)
                    ->where('class_enrolments.status', '=', 'active')->where('class_enrolments.current_slot', '=', 1);
            })
            ->join('parents', 'parents.id', '=', 'student_parent_links.parent_id')->whereNotNull('parents.user_id')
            ->pluck('parents.user_id')->all();
        $teacherUserIds = TeachingAssignment::query()
            ->where('school_id', $schoolId)->whereIn('class_id', $classIds)
            ->where('status', 'active')->where('current_slot', 1)->pluck('teacher_user_id')->all();

        return $this->normalizeRecipientIds(
            array_values(array_intersect(array_merge($studentUserIds, $guardianUserIds, $teacherUserIds), $eligibleUserIds->all())),
            $excludeUserId,
        );
    }

    /**
     * @param  list<array{type:'school'|'class',class_id?:int}>  $audiences
     * @return array{recipient_count:int,class_ids:list<int>,audience_label:string}
     */
    public function preview(int $schoolId, array $audiences, ?int $excludeUserId = null): array
    {
        $classIds = collect($audiences)->where('type', 'class')->pluck('class_id')
            ->map(fn ($id): int => (int) $id)->unique()->values()->all();
        $isSchoolAudience = collect($audiences)->contains(fn (array $audience): bool => $audience['type'] === 'school');

        return [
            'recipient_count' => count($this->recipientUserIds($schoolId, $audiences, $excludeUserId)),
            'class_ids' => $classIds,
            'audience_label' => $isSchoolAudience ? 'Whole school' : count($classIds).' '.(count($classIds) === 1 ? 'class' : 'classes'),
        ];
    }

    /** @return Collection<int, int> */
    private function eligibleCommunityUserIds(int $schoolId): Collection
    {
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');
        $viewPermissionId = DB::table('permissions')->where('slug', 'community.view')->value('id');
        $teacherAccessPermissionId = DB::table('permissions')->where('slug', 'app.teacher_access')->value('id');
        if ($tenantId === 0 || $viewPermissionId === null || $teacherAccessPermissionId === null) {
            return collect();
        }

        return DB::table('users')
            ->join('tenant_user_memberships as memberships', function ($join) use ($tenantId): void {
                $join->on('memberships.user_id', '=', 'users.id')
                    ->where('memberships.tenant_id', '=', $tenantId)
                    ->where('memberships.status', '=', 'active');
            })
            ->where('users.status', 'active')
            ->where('users.is_platform_owner', false)
            ->where(function (Builder $scope) use ($schoolId): void {
                $scope->where('memberships.access_all_schools', true)
                    ->orWhereExists(function (Builder $schoolScope) use ($schoolId): void {
                        $schoolScope->selectRaw('1')
                            ->from('tenant_membership_schools as membership_schools')
                            ->whereColumn('membership_schools.tenant_user_membership_id', 'memberships.id')
                            ->where('membership_schools.school_id', $schoolId);
                    });
            })
            ->where(fn (Builder $query) => $this->wherePermissionAllowed($query, (int) $viewPermissionId, $schoolId))
            ->where(function (Builder $persona) use ($teacherAccessPermissionId, $schoolId): void {
                $persona->whereExists(fn (Builder $role) => $this->membershipRoleExists($role, 'parent'))
                    ->orWhereExists(fn (Builder $role) => $this->membershipRoleExists($role, 'teacher'))
                    ->orWhere(function (Builder $studentPersona) use ($schoolId): void {
                        $studentPersona->whereExists(fn (Builder $role) => $this->membershipRoleExists($role, 'student'))
                            ->whereExists(function (Builder $student) use ($schoolId): void {
                                $student->selectRaw('1')->from('students')
                                    ->whereColumn('students.user_id', 'users.id')
                                    ->where('students.school_id', $schoolId)
                                    ->where('students.status', 'active');
                            });
                    })
                    ->orWhere(fn (Builder $query) => $this->wherePermissionAllowed($query, (int) $teacherAccessPermissionId, $schoolId));
            })
            ->distinct()
            ->pluck('users.id')
            ->map(fn ($id): int => (int) $id);
    }

    private function wherePermissionAllowed(Builder $query, int $permissionId, int $schoolId): Builder
    {
        return $query->where(function (Builder $allowed) use ($permissionId, $schoolId): void {
            $allowed->whereExists(function (Builder $rolePermission) use ($permissionId): void {
                $rolePermission->selectRaw('1')
                    ->from('tenant_membership_roles as membership_roles')
                    ->join('role_permissions', 'role_permissions.role_id', '=', 'membership_roles.role_id')
                    ->whereColumn('membership_roles.tenant_user_membership_id', 'memberships.id')
                    ->where('role_permissions.permission_id', $permissionId);
            })->orWhereExists(function (Builder $override) use ($permissionId, $schoolId): void {
                $override->selectRaw('1')->from('user_permission_overrides as permission_overrides')
                    ->whereColumn('permission_overrides.user_id', 'users.id')
                    ->where('permission_overrides.school_id', $schoolId)
                    ->where('permission_overrides.permission_id', $permissionId)
                    ->where('permission_overrides.allowed', true);
            });
        })->whereNotExists(function (Builder $override) use ($permissionId, $schoolId): void {
            $override->selectRaw('1')->from('user_permission_overrides as permission_overrides')
                ->whereColumn('permission_overrides.user_id', 'users.id')
                ->where('permission_overrides.school_id', $schoolId)
                ->where('permission_overrides.permission_id', $permissionId)
                ->where('permission_overrides.allowed', false);
        });
    }

    private function membershipRoleExists(Builder $query, string $roleSlug): Builder
    {
        return $query->selectRaw('1')
            ->from('tenant_membership_roles as persona_membership_roles')
            ->join('roles as persona_roles', 'persona_roles.id', '=', 'persona_membership_roles.role_id')
            ->whereColumn('persona_membership_roles.tenant_user_membership_id', 'memberships.id')
            ->where('persona_roles.slug', $roleSlug);
    }

    /** @param list<int|string> $ids @return list<int> */
    private function normalizeRecipientIds(array $ids, ?int $excludeUserId): array
    {
        return collect($ids)->map(fn ($id): int => (int) $id)
            ->when($excludeUserId !== null, fn ($recipientIds) => $recipientIds->reject(fn (int $id): bool => $id === $excludeUserId))
            ->unique()->sort()->values()->all();
    }
}
