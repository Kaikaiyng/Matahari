<?php

namespace App\Services\Authorization;

use App\Models\Permission;
use App\Models\User;
use App\Models\UserPermissionOverride;
use App\Support\TenantContext;

class UserPermissionResolver
{
    public function has(User $user, string $slug, ?int $schoolId = null): bool
    {
        if ($user->is_platform_owner) {
            return true;
        }

        return in_array($slug, $this->effectiveSlugs($user, $schoolId), true);
    }

    /** @return array<int, string> */
    public function effectiveSlugs(User $user, ?int $schoolId = null): array
    {
        if ($user->is_platform_owner) {
            return Permission::query()->orderBy('slug')->pluck('slug')->all();
        }

        $schoolId ??= $user->school_id ? (int) $user->school_id : null;
        $roleQuery = $this->roleQuery($user);
        $slugs = $roleQuery
            ->with('permissions:id,slug')
            ->get()
            ->flatMap(fn ($role) => $role->permissions->pluck('slug'))
            ->unique()
            ->values();

        // Keep time-bound Attendance grants compatible until historical records are retired.
        if ($schoolId) {
            $attendance = $user->attendanceAbilities()
                ->where('school_id', $schoolId)
                ->whereNull('revoked_at')
                ->where('effective_from', '<=', now())
                ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->with('permission:id,slug')
                ->get()
                ->pluck('permission.slug');
            $slugs = $slugs->merge($attendance);
        }

        // Explicit per-user decisions are final, including denials of older Attendance grants.
        if ($schoolId) {
            $overrides = UserPermissionOverride::query()
                ->where('school_id', $schoolId)
                ->where('user_id', $user->id)
                ->with('permission:id,slug')
                ->get();
            foreach ($overrides as $override) {
                if ($override->allowed) {
                    $slugs->push($override->permission->slug);
                } else {
                    $slugs = $slugs->reject(fn (string $slug): bool => $slug === $override->permission->slug);
                }
            }
        }

        return $slugs->unique()->sort()->values()->all();
    }

    private function roleQuery(User $user)
    {
        if (app()->bound(TenantContext::class)) {
            $membership = $user->tenantMembership(app(TenantContext::class)->tenantId());
            if ($membership && $membership->status === 'active') {
                return $membership->roles();
            }
        }

        return $user->roles();
    }
}
