<?php

namespace App\Support;

use App\Models\School;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;

class SchoolScopeResolver
{
    public function resolve(?User $user, mixed $requestedSchoolId): int
    {
        if (! $user) {
            throw new AuthenticationException;
        }

        $tenantContext = app()->bound(TenantContext::class) ? app(TenantContext::class) : null;
        if ($tenantContext) {
            return $this->resolveWithinTenant($user, $requestedSchoolId, $tenantContext);
        }

        if ($user->school_id !== null) {
            if ($requestedSchoolId !== null && (int) $requestedSchoolId !== (int) $user->school_id) {
                abort(403, 'This school scope is not permitted.');
            }

            return (int) $user->school_id;
        }

        if (! is_numeric($requestedSchoolId) || (int) $requestedSchoolId < 1) {
            throw ValidationException::withMessages([
                'school_id' => 'A valid school selection is required.',
            ]);
        }

        $schoolId = (int) $requestedSchoolId;

        if (! School::query()->whereKey($schoolId)->exists()) {
            throw ValidationException::withMessages([
                'school_id' => 'The selected school is invalid.',
            ]);
        }

        return $schoolId;
    }

    private function resolveWithinTenant(User $user, mixed $requestedSchoolId, TenantContext $context): int
    {
        $membership = $user->is_platform_owner ? null : $user->tenantMembership($context->tenantId());
        if (! $user->is_platform_owner && (! $membership || $membership->status !== 'active')) {
            abort(403, 'This tenant scope is not permitted.');
        }

        $schoolId = is_numeric($requestedSchoolId) && (int) $requestedSchoolId > 0
            ? (int) $requestedSchoolId
            : (int) ($membership?->default_school_id ?? $user->school_id);
        if ($schoolId < 1) {
            throw ValidationException::withMessages(['school_id' => 'A valid school selection is required.']);
        }

        $school = School::query()->whereKey($schoolId)->where('tenant_id', $context->tenantId())->first();
        if (! $school) {
            abort(403, 'This school does not belong to the active tenant.');
        }

        if (! $user->is_platform_owner && ! $membership->access_all_schools
            && ! $membership->schools()->whereKey($schoolId)->exists()) {
            abort(403, 'This school scope is not permitted.');
        }

        return $schoolId;
    }
}
