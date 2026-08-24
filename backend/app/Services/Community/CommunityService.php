<?php

namespace App\Services\Community;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\CommunityPostReaction;
use App\Models\CommunityReport;
use App\Models\PortalNotification;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CommunityService
{
    public function __construct(
        private readonly CommunityAccessService $access,
        private readonly SchoolUpdateAudienceResolver $audiences,
        private readonly CommunityPolicyService $policy,
        private readonly CommunitySafetyFilter $safetyFilter,
        private readonly AuditLoggerContract $audit,
    ) {}

    public function publish(int $schoolId, array $data, User $actor, AuditContext $context): CommunityPost
    {
        $school = School::query()->findOrFail($schoolId);
        $tenantId = (int) $school->tenant_id;
        $this->policy->assertCanContribute($actor, $tenantId, $schoolId);
        if (collect($data['audiences'])->contains(fn (array $audience): bool => ! in_array($audience['type'], ['school', 'class'], true))) {
            throw ValidationException::withMessages(['audiences' => 'School updates may target only the whole school or active classes.']);
        }
        $this->access->assertCanPublish($actor, $schoolId, $data['audiences']);
        $inspection = $this->safetyFilter->inspect($data['body']);
        if (! $inspection->allowed) {
            throw ValidationException::withMessages(['body' => 'This content is not allowed under the Community Standards.']);
        }
        $storedPaths = [];
        try {
            return DB::transaction(function () use ($inspection, $tenantId, $schoolId, $data, $actor, $context, &$storedPaths): CommunityPost {
                $now = now();
                $post = CommunityPost::query()->create([
                    'tenant_id' => $tenantId, 'school_id' => $schoolId, 'author_user_id' => $actor->id, 'post_type' => CommunityPost::POST_TYPE_UPDATE,
                    'body' => $inspection->normalized, 'comments_enabled' => false,
                    'status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => $now,
                    'reviewed_at' => $now, 'reviewed_by_user_id' => $actor->id,
                    'moderation_reason_code' => $inspection->reasonCode,
                ]);
                foreach ($data['audiences'] as $audience) {
                    if ($audience['type'] === 'class') {
                        $class = SchoolClass::query()->where('school_id', $schoolId)->findOrFail($audience['class_id']);
                        $key = "class:{$class->id}";
                    } else {
                        $key = 'school';
                    }
                    $post->audiences()->create(['school_id' => $schoolId, 'audience_type' => $audience['type'], 'class_id' => $audience['class_id'] ?? null, 'student_id' => $audience['student_id'] ?? null, 'audience_key' => $key]);
                }
                foreach ($data['media'] ?? [] as $index => $file) {
                    $mimeType = (string) $file->getMimeType();
                    if (! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
                        throw ValidationException::withMessages(['media' => 'School update media must be a JPEG, PNG, or WebP image.']);
                    }
                    $path = $file->storeAs("community/{$schoolId}/{$post->id}", Str::uuid().'.'.$file->extension(), 'local');
                    $storedPaths[] = $path;
                    $post->media()->create([
                        'school_id' => $schoolId, 'media_type' => 'image',
                        'storage_disk' => 'local', 'storage_path' => $path, 'original_name' => $file->getClientOriginalName(),
                        'mime_type' => $mimeType, 'size_bytes' => $file->getSize(), 'sort_order' => $index, 'status' => 'ready',
                    ]);
                }
                $classIds = collect($data['audiences'])->where('type', 'class')->pluck('class_id')->map(fn ($id): int => (int) $id)->unique()->sort()->values()->all();
                $audienceType = $classIds === [] ? 'school' : 'class';
                $recipientIds = [];
                if ($data['notify_audience'] ?? true) {
                    $recipientIds = $this->audiences->recipientUserIds($schoolId, $data['audiences'], $actor->id);
                    PortalNotification::query()->insert(collect($recipientIds)->map(fn (int $recipientId): array => [
                        'school_id' => $schoolId,
                        'recipient_user_id' => $recipientId,
                        'type' => 'school_update',
                        'title' => 'School update',
                        'body' => $post->body,
                        'context_json' => json_encode(['post_id' => $post->id, 'audience_type' => $audienceType, 'class_ids' => $classIds], JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])->all());
                }
                $this->audit->record(new AuditEvent(action: AuditAction::CommunityPostPublished, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['audiences' => $post->audiences()->pluck('audience_key')->all(), 'audience_type' => $audienceType, 'class_ids' => $classIds, 'recipient_count' => count($recipientIds), 'comments_enabled' => $post->comments_enabled, 'status' => $post->status]), $context);

                return $post;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }
    }

    public function updatePost(int $schoolId, CommunityPost $post, array $data, User $actor, AuditContext $context): CommunityPost
    {
        if ((int) $post->school_id !== $schoolId) {
            abort(403, 'Post is outside your school scope.');
        }
        $isManager = $actor->hasPermissionTo('community.moderate', $schoolId);
        if (($post->author_user_id !== $actor->id || ! $actor->hasPermissionTo('community.publish', $schoolId)) && ! $isManager) {
            abort(403, 'Only the author or an authorized moderator may edit this post.');
        }
        $inspection = $this->safetyFilter->inspect($data['body']);
        if (! $inspection->allowed) {
            throw ValidationException::withMessages(['body' => 'This content is not allowed under the Community Standards.']);
        }

        return DB::transaction(function () use ($schoolId, $post, $actor, $context, $inspection): CommunityPost {
            $locked = CommunityPost::query()->whereKey($post->id)->lockForUpdate()->firstOrFail();
            abort_unless((int) $locked->school_id === $schoolId, 403, 'Post is outside your school scope.');
            $isManager = $actor->hasPermissionTo('community.moderate', $schoolId);
            abort_unless(($locked->author_user_id === $actor->id && $actor->hasPermissionTo('community.publish', $schoolId)) || $isManager, 403, 'Only the author or an authorized moderator may edit this post.');
            abort_if($locked->status === CommunityPost::STATUS_DELETED, 409, 'Deleted posts cannot be edited.');
            abort_if($locked->status === CommunityPost::STATUS_HIDDEN && ! $actor->hasPermissionTo('community.moderate', $schoolId), 403, 'Hidden posts cannot be edited by their author.');
            abort_if(
                in_array($locked->status, [CommunityPost::STATUS_PENDING_REVIEW, CommunityPost::STATUS_REJECTED], true) && ! $isManager,
                409,
                'Pending or rejected posts require an authorized manager review before publication.',
            );

            $oldValues = [
                'body' => $locked->body,
                'comments_enabled' => $locked->comments_enabled,
                'status' => $locked->status,
                'published_at' => $locked->published_at?->toIso8601String(),
            ];
            $attributes = [
                'body' => $inspection->normalized,
                'comments_enabled' => false,
                'status' => CommunityPost::STATUS_PUBLISHED,
                'published_at' => $locked->published_at ?? now(),
            ];
            if (in_array($locked->status, [CommunityPost::STATUS_PENDING_REVIEW, CommunityPost::STATUS_REJECTED], true)) {
                $attributes['reviewed_at'] = now();
                $attributes['reviewed_by_user_id'] = $actor->id;
                $attributes['moderation_reason'] = null;
                $attributes['moderation_reason_code'] = $inspection->reasonCode;
            }
            $locked->update($attributes);
            $locked->media()->where('status', 'quarantined')->update(['status' => 'ready']);

            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityPostUpdated,
                module: AuditModule::Community,
                schoolId: $schoolId,
                subjectType: AuditSubject::CommunityPost,
                subjectId: $locked->id,
                oldValues: $oldValues,
                newValues: [
                    'body' => $locked->body,
                    'comments_enabled' => $locked->comments_enabled,
                    'status' => $locked->status,
                    'published_at' => $locked->published_at?->toIso8601String(),
                ],
            ), $context);

            return $locked;
        });
    }

    public function withdrawPost(int $schoolId, CommunityPost $post, User $actor, AuditContext $context, ?string $reason = null): void
    {
        if ((int) $post->school_id !== $schoolId) {
            abort(403, 'Post is outside your school scope.');
        }
        $isManager = $actor->hasPermissionTo('community.moderate', $schoolId);
        $isAuthorizedAuthor = $post->author_user_id === $actor->id && $actor->hasPermissionTo('community.publish', $schoolId);
        if (! $isAuthorizedAuthor && ! $isManager) {
            abort(403, 'Only the author or an authorized manager may withdraw this post.');
        }
        $isManagerWithdrawal = $post->author_user_id !== $actor->id && $isManager;
        if ($isManagerWithdrawal && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A withdrawal reason is required for managers.']);
        }

        DB::transaction(function () use ($schoolId, $post, $actor, $context, $isManager, $reason): void {
            $locked = CommunityPost::query()->whereKey($post->id)->lockForUpdate()->firstOrFail();
            abort_unless((int) $locked->school_id === $schoolId, 403, 'Post is outside your school scope.');
            abort_unless(
                ($locked->author_user_id === $actor->id && $actor->hasPermissionTo('community.publish', $schoolId)) || $isManager,
                403,
                'Only the author or an authorized manager may withdraw this post.',
            );
            abort_if($locked->status === CommunityPost::STATUS_DELETED, 409, 'Post is already deleted.');
            $isManagerWithdrawal = $locked->author_user_id !== $actor->id && $isManager;
            if ($isManagerWithdrawal && trim((string) $reason) === '') {
                throw ValidationException::withMessages(['reason' => 'A withdrawal reason is required for managers.']);
            }
            $withdrawalReason = $isManagerWithdrawal ? trim((string) $reason) : CommunityPost::AUTHOR_WITHDRAWN_REASON;
            $withdrawalAction = $isManagerWithdrawal ? 'manager_withdrawn' : 'author_withdrawn';
            $oldValues = [
                'status' => $locked->status,
                'hidden_at' => $locked->hidden_at?->toIso8601String(),
                'hidden_by_user_id' => $locked->hidden_by_user_id,
                'moderation_reason' => $locked->moderation_reason,
            ];
            $locked->update([
                'status' => CommunityPost::STATUS_DELETED,
                'hidden_at' => now(),
                'hidden_by_user_id' => $actor->id,
                'moderation_reason' => $withdrawalReason,
            ]);

            $locked->reports()
                ->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])
                ->lockForUpdate()
                ->get()
                ->each(function (CommunityReport $report) use ($actor, $withdrawalAction): void {
                    $report->update([
                        'status' => CommunityReport::STATUS_RESOLVED,
                        'resolved_at' => now(),
                        'resolution_code' => $withdrawalAction,
                    ]);
                    $report->actions()->create([
                        'tenant_id' => $report->tenant_id,
                        'school_id' => $report->school_id,
                        'actor_user_id' => $actor->id,
                        'action' => $withdrawalAction,
                        'reason_code' => $withdrawalAction,
                    ]);
                });

            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityPostWithdrawn,
                module: AuditModule::Community,
                schoolId: $schoolId,
                subjectType: AuditSubject::CommunityPost,
                subjectId: $locked->id,
                oldValues: $oldValues,
                newValues: [
                    'status' => $locked->status,
                    'hidden_at' => $locked->hidden_at?->toIso8601String(),
                    'hidden_by_user_id' => $locked->hidden_by_user_id,
                    'moderation_reason' => $locked->moderation_reason,
                ],
                reason: $withdrawalReason,
            ), $context);
        });
    }

    public function toggleReaction(int $schoolId, CommunityPost $post, User $actor, AuditContext $context): CommunityPost
    {
        $this->access->findVisible($actor, $schoolId, $post);
        abort_unless($post->status === CommunityPost::STATUS_PUBLISHED, 409, 'Only published posts can receive reactions.');

        return DB::transaction(function () use ($schoolId, $post, $actor, $context): CommunityPost {
            $existing = CommunityPostReaction::query()->where('community_post_id', $post->id)->where('user_id', $actor->id)->lockForUpdate()->first();
            $active = ! $existing;
            $existing?->delete();
            if ($active) {
                CommunityPostReaction::query()->create(['school_id' => $schoolId, 'community_post_id' => $post->id, 'user_id' => $actor->id, 'reaction_type' => 'appreciate']);
            }
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityReactionUpdated, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['active' => $active]), $context);

            return $post;
        });
    }

    public function comment(int $schoolId, CommunityPost $post, string $body, User $actor, AuditContext $context): CommunityComment
    {
        $this->access->findVisible($actor, $schoolId, $post);
        abort_unless($post->comments_enabled, 409, 'Comments are disabled for this post.');
        $this->policy->assertCanContribute($actor, (int) $post->tenant_id, $schoolId);
        $this->policy->assertNotRestricted($actor, (int) $post->tenant_id, $schoolId, 'comment');
        $inspection = $this->safetyFilter->inspect($body);
        if (! $inspection->allowed) {
            throw ValidationException::withMessages(['body' => 'This content is not allowed under the Community Standards.']);
        }
        $isModerator = $actor->hasPermissionTo('community.moderate', $schoolId);

        return DB::transaction(function () use ($inspection, $isModerator, $schoolId, $post, $actor, $context): CommunityComment {
            $comment = CommunityComment::query()->create([
                'tenant_id' => $post->tenant_id, 'school_id' => $schoolId, 'community_post_id' => $post->id,
                'user_id' => $actor->id, 'body' => $inspection->normalized,
                'status' => $isModerator ? CommunityComment::STATUS_VISIBLE : CommunityComment::STATUS_PENDING_REVIEW,
                'reviewed_at' => $isModerator ? now() : null, 'reviewed_by_user_id' => $isModerator ? $actor->id : null,
                'moderation_reason_code' => $inspection->reasonCode,
            ]);
            if (! $isModerator) {
                $this->createSubmissionCase($post, $comment, $actor, (int) $post->tenant_id, $schoolId, $inspection->reasonCode);
            }
            $this->audit->record(new AuditEvent(action: $isModerator ? AuditAction::CommunityCommentCreated : AuditAction::CommunityCommentSubmitted, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityComment, subjectId: $comment->id, newValues: ['post_id' => $post->id, 'status' => $comment->status]), $context);

            return $comment;
        });
    }

    public function removeComment(int $schoolId, CommunityComment $comment, User $actor, AuditContext $context): void
    {
        $post = CommunityPost::query()->findOrFail($comment->community_post_id);
        $this->access->findVisible($actor, $schoolId, $post);
        abort_unless($comment->user_id === $actor->id || $post->author_user_id === $actor->id || $actor->hasPermissionTo('community.moderate', $schoolId), 403);
        DB::transaction(function () use ($schoolId, $comment, $actor, $context): void {
            $comment->update(['status' => 'removed', 'removed_at' => now()]);
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityCommentRemoved, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityComment, subjectId: $comment->id, newValues: ['removed_by' => $actor->id]), $context);
        });
    }

    public function hidePost(int $schoolId, CommunityPost $post, string $reason, User $actor, AuditContext $context): void
    {
        abort_unless((int) $post->school_id === $schoolId && $actor->hasPermissionTo('community.moderate', $schoolId), 403);
        DB::transaction(function () use ($schoolId, $post, $reason, $actor, $context): void {
            $post->update(['status' => 'hidden', 'hidden_at' => now(), 'hidden_by_user_id' => $actor->id, 'moderation_reason' => trim($reason)]);
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityPostHidden, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['reason' => trim($reason)]), $context);
        });
    }

    private function createSubmissionCase(CommunityPost $post, ?CommunityComment $comment, User $actor, int $tenantId, int $schoolId, ?string $reasonCode): void
    {
        $post->loadMissing('media');
        $report = CommunityReport::query()->create([
            'tenant_id' => $tenantId,
            'school_id' => $schoolId,
            'reporter_user_id' => $actor->id,
            'source' => 'submission',
            'target_type' => $comment ? 'comment' : 'post',
            'community_post_id' => $post->id,
            'community_comment_id' => $comment?->id,
            'reported_user_id' => $actor->id,
            'reason_code' => $reasonCode ?? 'other',
            'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => [
                'post' => ['id' => $post->id, 'body' => $post->body, 'status' => $post->status, 'author_user_id' => $post->author_user_id,
                    'media' => $post->media->map(fn ($media) => ['id' => $media->id, 'type' => $media->media_type, 'name' => $media->original_name, 'mime_type' => $media->mime_type, 'size_bytes' => $media->size_bytes, 'status' => $media->status])->all()],
                'comment' => $comment ? ['id' => $comment->id, 'body' => $comment->body, 'status' => $comment->status, 'author_user_id' => $comment->user_id] : null,
            ],
            'due_at' => now()->addHours((int) config('community_safety.sla_hours.normal', 24)),
        ]);
        $report->actions()->create([
            'tenant_id' => $tenantId, 'school_id' => $schoolId, 'actor_user_id' => $actor->id,
            'action' => 'submitted_for_review', 'reason_code' => $reasonCode,
        ]);
    }

    private function refreshSubmissionCase(CommunityPost $post, User $actor, ?string $reasonCode): void
    {
        $active = CommunityReport::query()
            ->where('community_post_id', $post->id)
            ->where('source', 'submission')
            ->where('target_type', 'post')
            ->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])
            ->lockForUpdate()
            ->latest('id')
            ->first();

        if (! $active) {
            $this->createSubmissionCase($post, null, $actor, (int) $post->tenant_id, (int) $post->school_id, $reasonCode);

            return;
        }

        $post->loadMissing('media');
        $active->update([
            'status' => CommunityReport::STATUS_SUBMITTED,
            'reason_code' => $reasonCode ?? 'other',
            'assigned_to_user_id' => null,
            'due_at' => now()->addHours((int) config('community_safety.sla_hours.normal', 24)),
            'target_snapshot' => [
                'post' => [
                    'id' => $post->id,
                    'body' => $post->body,
                    'status' => $post->status,
                    'author_user_id' => $post->author_user_id,
                    'media' => $post->media->map(fn ($media) => ['id' => $media->id, 'type' => $media->media_type, 'name' => $media->original_name, 'mime_type' => $media->mime_type, 'size_bytes' => $media->size_bytes, 'status' => $media->status])->all(),
                ],
                'comment' => null,
            ],
        ]);
        $active->actions()->create([
            'tenant_id' => $post->tenant_id,
            'school_id' => $post->school_id,
            'actor_user_id' => $actor->id,
            'action' => 'resubmitted_after_edit',
            'reason_code' => $reasonCode,
        ]);
    }
}
