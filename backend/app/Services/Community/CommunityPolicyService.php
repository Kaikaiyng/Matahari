<?php

namespace App\Services\Community;

use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\StudentCommunityAuthorization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CommunityPolicyService
{
    public function assertCanContribute(User $user, int $tenantId, int $schoolId): void
    {
        $this->assertCurrentPoliciesAccepted($user, $tenantId, $schoolId);

        if ($this->isStudent($user, $tenantId)) {
            $authorized = StudentCommunityAuthorization::query()
                ->where('tenant_id', $tenantId)
                ->where('school_id', $schoolId)
                ->where('student_user_id', $user->id)
                ->where('capability', StudentCommunityAuthorization::CAPABILITY_FREEFORM_INTERACTION)
                ->where('effective_at', '<=', now())
                ->whereNull('revoked_at')
                ->get()
                ->contains(fn (StudentCommunityAuthorization $authorization): bool => $this->isValidAdultAuthorization($authorization, $user, $tenantId, $schoolId));

            if (! $authorized) {
                throw ValidationException::withMessages([
                    'community_policy' => 'Student freeform Community interaction requires active adult authorization.',
                ]);
            }
        }
    }

    private function assertCurrentPoliciesAccepted(User $user, int $tenantId, int $schoolId): void
    {
        foreach ((array) config('community_safety.required_acceptance_policy_types', []) as $type) {
            $policy = CommunityPolicyVersion::query()
                ->where('policy_type', $type)
                ->where('effective_at', '<=', now())
                ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))
                ->latest('effective_at')
                ->latest('id')
                ->first();

            if (! $policy || ! CommunityPolicyAcceptance::query()
                ->where('tenant_id', $tenantId)
                ->where('school_id', $schoolId)
                ->where('user_id', $user->id)
                ->where('community_policy_version_id', $policy->id)
                ->exists()) {
                throw ValidationException::withMessages([
                    'community_policy' => 'Accept the current Terms and Community Standards before contributing.',
                ]);
            }
        }
    }

    private function isStudent(User $user, int $tenantId): bool
    {
        return $user->tenantMemberships()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->where('slug', 'student'))
            ->exists();
    }

    private function isValidAdultAuthorization(StudentCommunityAuthorization $authorization, User $studentUser, int $tenantId, int $schoolId): bool
    {
        $authorizer = User::query()->whereKey($authorization->authorized_by_user_id)->where('status', 'active')->first();
        if (! $authorizer) {
            return false;
        }

        $membership = $authorizer->tenantMemberships()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->where(function ($query) use ($schoolId): void {
                $query->where('access_all_schools', true)
                    ->orWhereHas('schools', fn ($schoolQuery) => $schoolQuery->whereKey($schoolId));
            })
            ->first();

        if ($membership?->roles()->whereHas('permissions', fn ($query) => $query->where('slug', 'community.moderate'))->exists()) {
            return true;
        }

        $studentId = $studentUser->studentProfile()->where('school_id', $schoolId)->value('id');
        $guardianId = $authorizer->guardianProfile()->where('school_id', $schoolId)->value('id');

        return $studentId !== null && $guardianId !== null && DB::table('student_parent_links')
            ->where('school_id', $schoolId)
            ->where('student_id', $studentId)
            ->where('parent_id', $guardianId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->exists();
    }
}
