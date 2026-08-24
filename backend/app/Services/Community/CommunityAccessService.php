<?php

namespace App\Services\Community;

use App\Models\CommunityPost;
use App\Models\School;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class CommunityAccessService
{
    public function __construct(private readonly SchoolUpdateAudienceResolver $audiences) {}

    public function visiblePosts(User $user, int $schoolId): Builder
    {
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');
        $classIds = $this->audiences->visibleClassIds($user, $schoolId);
        $studentId = $user->studentProfile?->id;

        return CommunityPost::query()
            ->where('tenant_id', $tenantId)
            ->where('school_id', $schoolId)
            ->whereNull('hidden_at')
            ->where(function (Builder $query) use ($classIds, $studentId, $user): void {
                $query->where(fn (Builder $my) => $my->where('author_user_id', $user->id)->whereIn('status', ['published', 'pending_review']))
                    ->orWhere(function (Builder $published) use ($classIds, $studentId): void {
                        $published->where('status', 'published')
                            ->whereHas('audiences', function (Builder $nested) use ($classIds, $studentId): void {
                                $nested->where('audience_type', 'school')
                                    ->when($classIds !== [], fn (Builder $q) => $q->orWhere(fn (Builder $inner) => $inner->where('audience_type', 'class')->whereIn('class_id', $classIds)))
                                    ->when($studentId, fn (Builder $q) => $q->orWhere(fn (Builder $inner) => $inner->where('audience_type', 'student')->where('student_id', $studentId)));
                            });
                    });
            });
    }

    public function findVisible(User $user, int $schoolId, CommunityPost $post): CommunityPost
    {
        if ((int) $post->school_id !== $schoolId || ! $this->visiblePosts($user, $schoolId)->whereKey($post->id)->exists()) {
            abort(403, 'This community post is outside your authorized audience.');
        }

        return $post;
    }

    public function assertCanPublish(User $user, int $schoolId, array $audiences): void
    {
        abort_unless($user->hasPermissionTo('community.publish', $schoolId), 403, 'This action is not permitted.');
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');
        $canPublishSchool = $user->is_platform_owner || $user->tenantMembership($tenantId)?->roles()
            ->whereIn('slug', ['school-admin', 'finance'])
            ->exists();
        $teacherClassIds = TeachingAssignment::query()
            ->where('school_id', $schoolId)->where('teacher_user_id', $user->id)
            ->where('status', 'active')->where('current_slot', 1)->pluck('class_id')->map(fn ($id) => (int) $id)->all();

        foreach ($audiences as $audience) {
            if ($audience['type'] === 'school' && ! $canPublishSchool) {
                abort(403, 'Only authorized school staff may publish school-wide posts.');
            }
            if ($audience['type'] === 'class' && ! $canPublishSchool && ! in_array((int) $audience['class_id'], $teacherClassIds, true)) {
                abort(403, 'This class is outside the teacher assignment scope.');
            }
        }
    }
}
