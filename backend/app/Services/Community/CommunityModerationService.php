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
use App\Models\CommunityReport;
use App\Models\CommunityUserBlock;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CommunityModerationService
{
    public function __construct(
        private readonly CommunityAccessService $access,
        private readonly AuditLoggerContract $audit,
    ) {}

    public function resolveTarget(User $reporter, int $schoolId, string $type, int $targetId): ReportTarget
    {
        if ($type === 'post') {
            $post = CommunityPost::query()->with('media')->findOrFail($targetId);
            $this->access->findVisible($reporter, $schoolId, $post);

            return new ReportTarget($type, $post, null, $post->author()->firstOrFail());
        }

        if ($type === 'comment') {
            $comment = CommunityComment::query()->where('school_id', $schoolId)->where('status', CommunityComment::STATUS_VISIBLE)->findOrFail($targetId);
            $post = CommunityPost::query()->with('media')->findOrFail($comment->community_post_id);
            $this->access->findVisible($reporter, $schoolId, $post);

            return new ReportTarget($type, $post, $comment, $comment->user()->firstOrFail());
        }

        $reportedUser = User::query()->findOrFail($targetId);
        $visiblePostIds = $this->access->visiblePosts($reporter, $schoolId)->select('community_posts.id');
        $isVisibleParticipant = CommunityPost::query()
            ->whereIn('id', clone $visiblePostIds)
            ->where('author_user_id', $reportedUser->id)
            ->exists()
            || CommunityComment::query()
                ->where('school_id', $schoolId)
                ->where('status', CommunityComment::STATUS_VISIBLE)
                ->where('user_id', $reportedUser->id)
                ->whereIn('community_post_id', clone $visiblePostIds)
                ->exists();
        abort_unless($isVisibleParticipant, 403, 'This Community user is outside your authorized audience.');

        return new ReportTarget($type, null, null, $reportedUser);
    }

    public function submitReport(User $reporter, int $tenantId, int $schoolId, ReportTarget $target, string $reasonCode, ?string $details, AuditContext $context): CommunityReport
    {
        if ($target->reportedUser->is($reporter)) {
            throw ValidationException::withMessages(['report' => 'You cannot report yourself.']);
        }

        return DB::transaction(function () use ($reporter, $tenantId, $schoolId, $target, $reasonCode, $details, $context): CommunityReport {
            User::query()->whereKey($reporter->id)->lockForUpdate()->firstOrFail();
            $recentCount = CommunityReport::query()
                ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
                ->where('reporter_user_id', $reporter->id)->where('created_at', '>=', now()->subHour())->count();
            abort_if($recentCount >= (int) config('community_safety.maximum_reports_per_hour', 10), 429, 'Report limit reached. Please try again later.');

            $duplicate = CommunityReport::query()
                ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
                ->where('reporter_user_id', $reporter->id)->where('target_type', $target->type)
                ->where('reported_user_id', $target->reportedUser->id)
                ->where('community_post_id', $target->post?->id)
                ->where('community_comment_id', $target->comment?->id)
                ->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])
                ->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['report' => 'An active report already exists for this target.']);
            }

            $severe = in_array($reasonCode, (array) config('community_safety.severe_reason_codes', []), true);
            $priority = $severe ? 'severe' : 'normal';
            $report = CommunityReport::query()->create([
                'tenant_id' => $tenantId,
                'school_id' => $schoolId,
                'reporter_user_id' => $reporter->id,
                'target_type' => $target->type,
                'community_post_id' => $target->post?->id,
                'community_comment_id' => $target->comment?->id,
                'reported_user_id' => $target->reportedUser->id,
                'reason_code' => $reasonCode,
                'details' => $details === null ? null : trim($details),
                'priority' => $priority,
                'status' => CommunityReport::STATUS_SUBMITTED,
                'target_snapshot' => $this->snapshot($target),
                'due_at' => now()->addHours((int) config("community_safety.sla_hours.{$priority}", $severe ? 4 : 24)),
                'evidence_held_at' => $severe ? now() : null,
                'evidence_held_by_user_id' => $severe ? $reporter->id : null,
            ]);
            $report->actions()->create([
                'tenant_id' => $tenantId, 'school_id' => $schoolId, 'actor_user_id' => $reporter->id,
                'action' => 'submitted', 'reason_code' => $reasonCode,
            ]);

            if ($severe) {
                $this->quarantine($target, $reasonCode);
                $report->actions()->create([
                    'tenant_id' => $tenantId, 'school_id' => $schoolId, 'actor_user_id' => $reporter->id,
                    'action' => 'auto_quarantined', 'reason_code' => $reasonCode,
                    'reason' => 'Automatically quarantined pending urgent moderator review.',
                ]);
            }

            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityReportSubmitted,
                module: AuditModule::Community,
                schoolId: $schoolId,
                subjectType: AuditSubject::CommunityReport,
                subjectId: $report->id,
                newValues: ['target_type' => $target->type, 'reason_code' => $reasonCode, 'priority' => $priority],
            ), $context);

            return $report;
        });
    }

    public function blockUser(User $actor, int $tenantId, int $schoolId, User $target, AuditContext $context): CommunityUserBlock
    {
        if ($actor->is($target)) {
            throw ValidationException::withMessages(['user' => 'You cannot block yourself.']);
        }

        return DB::transaction(function () use ($actor, $tenantId, $schoolId, $target, $context): CommunityUserBlock {
            $block = CommunityUserBlock::query()->lockForUpdate()->firstOrNew([
                'tenant_id' => $tenantId, 'school_id' => $schoolId,
                'blocker_user_id' => $actor->id, 'blocked_user_id' => $target->id,
            ]);
            $block->fill(['blocked_at' => now(), 'revoked_at' => null])->save();
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityUserBlocked, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityUserBlock, subjectId: $block->id,
                newValues: ['blocked_user_id' => $target->id],
            ), $context);

            return $block;
        });
    }

    public function unblockUser(User $actor, int $tenantId, int $schoolId, User $target, AuditContext $context): CommunityUserBlock
    {
        return DB::transaction(function () use ($actor, $tenantId, $schoolId, $target, $context): CommunityUserBlock {
            $block = CommunityUserBlock::query()
                ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
                ->where('blocker_user_id', $actor->id)->where('blocked_user_id', $target->id)
                ->whereNull('revoked_at')->lockForUpdate()->firstOrFail();
            $block->update(['revoked_at' => now()]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityUserUnblocked, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityUserBlock, subjectId: $block->id,
                newValues: ['blocked_user_id' => $target->id],
            ), $context);

            return $block;
        });
    }

    private function snapshot(ReportTarget $target): array
    {
        return [
            'target_type' => $target->type,
            'post' => $target->post ? [
                'id' => $target->post->id,
                'body' => $target->post->body,
                'status' => $target->post->status,
                'author_user_id' => $target->post->author_user_id,
                'media' => $target->post->media->map(fn ($media) => [
                    'id' => $media->id, 'type' => $media->media_type, 'name' => $media->original_name,
                    'mime_type' => $media->mime_type, 'size_bytes' => $media->size_bytes, 'status' => $media->status,
                ])->all(),
            ] : null,
            'comment' => $target->comment ? [
                'id' => $target->comment->id,
                'body' => $target->comment->body,
                'status' => $target->comment->status,
                'author_user_id' => $target->comment->user_id,
            ] : null,
            'reported_user_id' => $target->reportedUser->id,
        ];
    }

    private function quarantine(ReportTarget $target, string $reasonCode): void
    {
        if ($target->comment) {
            $target->comment->update([
                'status' => CommunityComment::STATUS_HIDDEN,
                'hidden_at' => now(),
                'hidden_by_user_id' => null,
                'moderation_reason' => 'Automatically quarantined pending urgent review.',
                'moderation_reason_code' => $reasonCode,
            ]);

            return;
        }

        if ($target->post) {
            $target->post->update([
                'status' => CommunityPost::STATUS_HIDDEN,
                'hidden_at' => now(),
                'hidden_by_user_id' => null,
                'moderation_reason' => 'Automatically quarantined pending urgent review.',
                'moderation_reason_code' => $reasonCode,
            ]);
            $target->post->media()->update(['status' => 'quarantined']);
        }
    }
}
