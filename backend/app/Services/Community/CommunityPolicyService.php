<?php

namespace App\Services\Community;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityUserRestriction;
use App\Models\Student;
use App\Models\StudentCommunityAuthorization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CommunityPolicyService
{
    public function __construct(private readonly AuditLoggerContract $audit) {}

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

    public function assertNotRestricted(User $user, int $tenantId, int $schoolId, string $scope): void
    {
        $restricted = CommunityUserRestriction::query()
            ->where('tenant_id', $tenantId)->where('school_id', $schoolId)->where('user_id', $user->id)
            ->where('status', CommunityUserRestriction::STATUS_ACTIVE)->whereNull('revoked_at')
            ->where('starts_at', '<=', now())
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->whereIn('scope', [$scope, 'all'])->exists();
        if ($restricted) {
            throw ValidationException::withMessages(['community_restriction' => 'This Community action is temporarily restricted.']);
        }
    }

    /** @return array<string, array<string, mixed>> */
    public function currentPolicies(User $user, int $tenantId, int $schoolId): array
    {
        $result = [];
        foreach (CommunityPolicyVersion::query()
            ->where('effective_at', '<=', now())
            ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))
            ->orderBy('policy_type')->orderByDesc('effective_at')->orderByDesc('id')->get()->unique('policy_type') as $policy) {
            $result[$policy->policy_type] = [
                'id' => $policy->id,
                'version' => $policy->version,
                'title' => $policy->title,
                'public_path' => $policy->public_path,
                'effective_at' => $policy->effective_at?->toIso8601String(),
                'accepted' => CommunityPolicyAcceptance::query()
                    ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
                    ->where('user_id', $user->id)->where('community_policy_version_id', $policy->id)->exists(),
            ];
        }

        return $result;
    }

    public function acceptPolicy(User $user, int $tenantId, int $schoolId, CommunityPolicyVersion $policy, array $securityContext, AuditContext $context): CommunityPolicyAcceptance
    {
        $current = CommunityPolicyVersion::query()
            ->where('policy_type', $policy->policy_type)
            ->where('effective_at', '<=', now())
            ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))
            ->latest('effective_at')->latest('id')->first();
        if (! $current || ! $current->is($policy)) {
            throw ValidationException::withMessages(['community_policy' => 'Only the current effective policy can be accepted.']);
        }

        return DB::transaction(function () use ($user, $tenantId, $schoolId, $policy, $securityContext, $context): CommunityPolicyAcceptance {
            $acceptance = CommunityPolicyAcceptance::query()->firstOrCreate([
                'tenant_id' => $tenantId,
                'school_id' => $schoolId,
                'user_id' => $user->id,
                'community_policy_version_id' => $policy->id,
            ], [
                'accepted_at' => now(),
                'security_context' => $securityContext,
            ]);
            if ($acceptance->wasRecentlyCreated) {
                $this->audit->record(new AuditEvent(
                    action: AuditAction::CommunityPolicyAccepted,
                    module: AuditModule::Community,
                    schoolId: $schoolId,
                    subjectType: AuditSubject::CommunityPolicyAcceptance,
                    subjectId: $acceptance->id,
                    newValues: ['policy_type' => $policy->policy_type, 'version' => $policy->version],
                ), $context);
            }

            return $acceptance;
        });
    }

    public function authorizeStudent(User $actor, int $tenantId, int $schoolId, Student $student, AuditContext $context): StudentCommunityAuthorization
    {
        abort_unless((int) $student->school_id === $schoolId && $student->portalUser?->status === 'active', 403);
        abort_unless($this->canAuthorizeStudent($actor, $tenantId, $schoolId, $student), 403);

        return DB::transaction(function () use ($actor, $tenantId, $schoolId, $student, $context): StudentCommunityAuthorization {
            $authorization = StudentCommunityAuthorization::query()->lockForUpdate()->firstOrNew([
                'tenant_id' => $tenantId,
                'school_id' => $schoolId,
                'student_user_id' => $student->user_id,
                'capability' => StudentCommunityAuthorization::CAPABILITY_FREEFORM_INTERACTION,
            ]);
            $authorization->fill([
                'authorized_by_user_id' => $actor->id,
                'effective_at' => now(),
                'revoked_at' => null,
                'revoked_by_user_id' => null,
                'revocation_reason' => null,
            ])->save();
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityStudentAuthorized,
                module: AuditModule::Community,
                schoolId: $schoolId,
                subjectType: AuditSubject::StudentCommunityAuthorization,
                subjectId: $authorization->id,
                newValues: ['student_user_id' => $student->user_id, 'capability' => $authorization->capability],
            ), $context);

            return $authorization;
        });
    }

    public function revokeStudentAuthorization(User $actor, int $tenantId, int $schoolId, Student $student, AuditContext $context): StudentCommunityAuthorization
    {
        abort_unless((int) $student->school_id === $schoolId && $student->user_id !== null, 403);

        return DB::transaction(function () use ($actor, $tenantId, $schoolId, $student, $context): StudentCommunityAuthorization {
            $authorization = StudentCommunityAuthorization::query()
                ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
                ->where('student_user_id', $student->user_id)
                ->where('capability', StudentCommunityAuthorization::CAPABILITY_FREEFORM_INTERACTION)
                ->whereNull('revoked_at')->lockForUpdate()->firstOrFail();
            abort_unless($authorization->authorized_by_user_id === $actor->id || $actor->hasPermissionTo('community.moderate'), 403);
            $authorization->update([
                'revoked_at' => now(),
                'revoked_by_user_id' => $actor->id,
                'revocation_reason' => 'Revoked by an authorized adult.',
            ]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityStudentAuthorizationRevoked,
                module: AuditModule::Community,
                schoolId: $schoolId,
                subjectType: AuditSubject::StudentCommunityAuthorization,
                subjectId: $authorization->id,
                newValues: ['student_user_id' => $student->user_id, 'revoked_by_user_id' => $actor->id],
            ), $context);

            return $authorization;
        });
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

    private function canAuthorizeStudent(User $actor, int $tenantId, int $schoolId, Student $student): bool
    {
        if ($actor->hasPermissionTo('community.moderate')) {
            return true;
        }

        $guardianId = $actor->guardianProfile()->where('school_id', $schoolId)->value('id');

        return $guardianId !== null && DB::table('student_parent_links')
            ->where('school_id', $schoolId)
            ->where('student_id', $student->id)
            ->where('parent_id', $guardianId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->exists();
    }
}
