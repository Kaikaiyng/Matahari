<?php

namespace App\Services\Community;

use App\Models\CommunityPost;
use App\Models\School;
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
        $canModerate = $user->hasPermissionTo('community.moderate', $schoolId);

        return CommunityPost::query()
            ->where('tenant_id', $tenantId)
            ->where('school_id', $schoolId)
            ->whereNull('hidden_at')
            ->where(function (Builder $query) use ($canModerate, $classIds, $studentId, $user): void {
                if ($canModerate) {
                    $query->whereIn('status', [
                        CommunityPost::STATUS_PUBLISHED,
                        CommunityPost::STATUS_PENDING_REVIEW,
                        CommunityPost::STATUS_REJECTED,
                    ]);

                    return;
                }

                $query->where(fn (Builder $my) => $my->where('author_user_id', $user->id)->whereIn('status', [
                    CommunityPost::STATUS_PUBLISHED,
                    CommunityPost::STATUS_PENDING_REVIEW,
                    CommunityPost::STATUS_REJECTED,
                ]))
                    ->orWhere(function (Builder $published) use ($classIds, $studentId): void {
                        $published->where('status', CommunityPost::STATUS_PUBLISHED)
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
    }
}
