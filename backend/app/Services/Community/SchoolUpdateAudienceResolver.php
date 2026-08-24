<?php

namespace App\Services\Community;

use App\Models\ClassEnrolment;
use App\Models\School;
use App\Models\StudentParentLink;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Services\Authorization\UserPermissionResolver;

class SchoolUpdateAudienceResolver
{
    public function __construct(private readonly UserPermissionResolver $permissions) {}

    /** @return list<int> */
    public function visibleClassIds(User $user, int $schoolId): array
    {
        $ids = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('teacher_user_id', $user->id)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->pluck('class_id');

        if ($user->studentProfile) {
            $ids = $ids->merge(ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('student_id', $user->studentProfile->id)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->pluck('class_id'));
        }

        if ($user->guardianProfile) {
            $studentIds = $user->guardianProfile->students()
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
        $eligibleUsers = $this->eligibleCommunityUsers($schoolId);
        if (collect($audiences)->contains(fn (array $audience): bool => $audience['type'] === 'school')) {
            return $this->normalizeRecipientIds($eligibleUsers->pluck('id')->all(), $excludeUserId);
        }

        $classIds = collect($audiences)->where('type', 'class')->pluck('class_id')
            ->map(fn ($id): int => (int) $id)->unique()->values()->all();
        if ($classIds === []) {
            return [];
        }

        $studentUserIds = ClassEnrolment::query()
            ->where('class_enrolments.school_id', $schoolId)->whereIn('class_enrolments.class_id', $classIds)
            ->where('class_enrolments.status', 'active')->where('class_enrolments.current_slot', 1)
            ->join('students', 'students.id', '=', 'class_enrolments.student_id')->whereNotNull('students.user_id')
            ->pluck('students.user_id')->all();
        $guardianUserIds = StudentParentLink::query()
            ->where('student_parent_links.school_id', $schoolId)->where('student_parent_links.status', 'active')->where('student_parent_links.current_slot', 1)
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
        $moderatorUserIds = $eligibleUsers
            ->filter(fn (User $user): bool => $this->permissions->has($user, 'community.moderate', $schoolId))
            ->pluck('id')->all();
        $eligibleUserIds = $eligibleUsers->pluck('id')->map(fn ($id): int => (int) $id)->all();

        return $this->normalizeRecipientIds(
            array_values(array_intersect(array_merge($studentUserIds, $guardianUserIds, $teacherUserIds, $moderatorUserIds), $eligibleUserIds)),
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

    private function eligibleCommunityUsers(int $schoolId)
    {
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');

        return User::query()->where('status', 'active')
            ->whereHas('tenantMemberships', function ($query) use ($tenantId, $schoolId): void {
                $query->where('tenant_id', $tenantId)->where('status', 'active')
                    ->where(function ($membershipQuery) use ($schoolId): void {
                        $membershipQuery->where('access_all_schools', true)
                            ->orWhereHas('schools', fn ($schoolQuery) => $schoolQuery->whereKey($schoolId));
                    });
            })->get()
            ->filter(fn (User $user): bool => $this->permissions->has($user, 'community.view', $schoolId));
    }

    /** @param list<int|string> $ids @return list<int> */
    private function normalizeRecipientIds(array $ids, ?int $excludeUserId): array
    {
        return collect($ids)->map(fn ($id): int => (int) $id)
            ->when($excludeUserId !== null, fn ($recipientIds) => $recipientIds->reject(fn (int $id): bool => $id === $excludeUserId))
            ->unique()->sort()->values()->all();
    }
}
