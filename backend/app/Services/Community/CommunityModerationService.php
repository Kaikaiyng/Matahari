<?php

namespace App\Services\Community;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\CommunityAppeal;
use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\CommunityReport;
use App\Models\CommunityUserBlock;
use App\Models\CommunityUserRestriction;
use App\Models\PortalNotification;
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
        $post = CommunityPost::query()->with('media')->findOrFail($targetId);
        $this->access->findVisible($reporter, $schoolId, $post);

        return new ReportTarget($type, $post, null, $post->author()->firstOrFail());
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
                'source' => 'user_report',
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

    public function reviewReport(CommunityReport $report, User $actor, int $tenantId, int $schoolId, string $decision, string $reasonCode, string $reason, AuditContext $context): CommunityReport
    {
        abort_unless((int) $report->tenant_id === $tenantId && (int) $report->school_id === $schoolId, 403);

        return DB::transaction(function () use ($report, $actor, $tenantId, $schoolId, $decision, $reasonCode, $reason, $context): CommunityReport {
            $locked = CommunityReport::query()->whereKey($report->id)->lockForUpdate()->firstOrFail();
            if (! in_array($locked->status, [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING], true)) {
                throw ValidationException::withMessages(['decision' => 'This moderation case is already resolved.']);
            }
            if ($locked->source === 'submission' && $decision === 'warn') {
                throw ValidationException::withMessages(['decision' => 'Pending submissions require a content disposition.']);
            }
            if ($locked->target_type === 'user' && ! in_array($decision, ['no_violation', 'warn', 'escalate'], true)) {
                throw ValidationException::withMessages(['decision' => 'This decision is not valid for a user report.']);
            }

            $storageDecision = match ($decision) {
                'remove_content' => 'hide',
                default => $decision,
            };
            $post = $locked->community_post_id ? CommunityPost::query()->whereKey($locked->community_post_id)->lockForUpdate()->first() : null;
            $comment = $locked->community_comment_id ? CommunityComment::query()->whereKey($locked->community_comment_id)->lockForUpdate()->first() : null;
            $now = now();
            if (in_array($storageDecision, ['approve', 'no_violation'], true)) {
                if ($comment) {
                    $comment->update(['status' => CommunityComment::STATUS_VISIBLE, 'reviewed_at' => $now, 'reviewed_by_user_id' => $actor->id, 'moderation_reason_code' => $reasonCode, 'hidden_at' => null, 'hidden_by_user_id' => null]);
                } elseif ($post) {
                    $post->update(['status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => $post->published_at ?? $now, 'reviewed_at' => $now, 'reviewed_by_user_id' => $actor->id, 'moderation_reason_code' => $reasonCode, 'hidden_at' => null, 'hidden_by_user_id' => null]);
                    $post->media()->update(['status' => 'ready']);
                }
            } elseif ($storageDecision === 'reject') {
                ($comment ?? $post)?->update(['status' => 'rejected', 'reviewed_at' => $now, 'reviewed_by_user_id' => $actor->id, 'moderation_reason_code' => $reasonCode, 'moderation_reason' => trim($reason)]);
                $post?->media()->update(['status' => 'quarantined']);
            } elseif ($storageDecision === 'hide') {
                ($comment ?? $post)?->update(['status' => 'hidden', 'hidden_at' => $now, 'hidden_by_user_id' => $actor->id, 'reviewed_at' => $now, 'reviewed_by_user_id' => $actor->id, 'moderation_reason_code' => $reasonCode, 'moderation_reason' => trim($reason)]);
                $post?->media()->update(['status' => 'quarantined']);
            }

            $escalated = $storageDecision === 'escalate';
            $locked->update([
                'status' => $escalated ? CommunityReport::STATUS_REVIEWING : CommunityReport::STATUS_RESOLVED,
                'priority' => $escalated ? 'severe' : $locked->priority,
                'due_at' => $escalated ? $now->copy()->addHours((int) config('community_safety.sla_hours.severe', 4)) : $locked->due_at,
                'assigned_to_user_id' => $actor->id,
                'resolved_at' => $escalated ? null : $now,
                'resolution_code' => $escalated ? null : $decision,
                'evidence_held_at' => $escalated ? ($locked->evidence_held_at ?? $now) : $locked->evidence_held_at,
                'evidence_held_by_user_id' => $escalated ? ($locked->evidence_held_by_user_id ?? $actor->id) : $locked->evidence_held_by_user_id,
            ]);
            $action = $locked->actions()->create([
                'tenant_id' => $tenantId, 'school_id' => $schoolId, 'actor_user_id' => $actor->id,
                'action' => $decision, 'reason_code' => $reasonCode, 'reason' => trim($reason),
            ]);
            PortalNotification::query()->create([
                'school_id' => $schoolId, 'recipient_user_id' => $locked->reported_user_id,
                'type' => 'community_moderation', 'title' => 'Community review update',
                'body' => $escalated ? 'A Community case was escalated for further review.' : 'A Community moderation decision is available.',
                'context_json' => ['report_id' => $locked->id, 'action_id' => $action->id, 'decision' => $decision],
            ]);
            $this->audit->record(new AuditEvent(
                action: $escalated ? AuditAction::CommunityReportEscalated : AuditAction::CommunityReportReviewed,
                module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityReport, subjectId: $locked->id,
                newValues: ['decision' => $decision, 'reason_code' => $reasonCode], reason: trim($reason),
            ), $context);

            return $locked->fresh();
        });
    }

    public function applyRestriction(User $target, User $actor, int $tenantId, int $schoolId, string $scope, string $reasonCode, string $reason, ?string $endsAt, AuditContext $context): CommunityUserRestriction
    {
        $targetInSchool = $target->tenantMemberships()
            ->where('tenant_id', $tenantId)->where('status', 'active')
            ->where(function ($query) use ($schoolId): void {
                $query->where('access_all_schools', true)
                    ->orWhereHas('schools', fn ($schoolQuery) => $schoolQuery->whereKey($schoolId));
            })->exists();
        abort_unless($targetInSchool, 403);

        return DB::transaction(function () use ($target, $actor, $tenantId, $schoolId, $scope, $reasonCode, $reason, $endsAt, $context): CommunityUserRestriction {
            $restriction = CommunityUserRestriction::query()->create([
                'tenant_id' => $tenantId, 'school_id' => $schoolId, 'user_id' => $target->id,
                'scope' => $scope, 'reason_code' => $reasonCode, 'reason' => trim($reason),
                'starts_at' => now(), 'ends_at' => $endsAt, 'applied_by_user_id' => $actor->id,
                'status' => CommunityUserRestriction::STATUS_ACTIVE,
            ]);
            PortalNotification::query()->create([
                'school_id' => $schoolId, 'recipient_user_id' => $target->id, 'type' => 'community_moderation',
                'title' => 'Community access restricted', 'body' => 'A Community-only restriction was applied to your account.',
                'context_json' => ['restriction_id' => $restriction->id, 'scope' => $scope],
            ]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityRestrictionApplied, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityUserRestriction, subjectId: $restriction->id,
                newValues: ['user_id' => $target->id, 'scope' => $scope, 'ends_at' => $endsAt], reason: trim($reason),
            ), $context);

            return $restriction;
        });
    }

    public function revokeRestriction(CommunityUserRestriction $restriction, User $actor, int $tenantId, int $schoolId, AuditContext $context): CommunityUserRestriction
    {
        abort_unless((int) $restriction->tenant_id === $tenantId && (int) $restriction->school_id === $schoolId, 403);

        return DB::transaction(function () use ($restriction, $actor, $schoolId, $context): CommunityUserRestriction {
            $locked = CommunityUserRestriction::query()->whereKey($restriction->id)->lockForUpdate()->firstOrFail();
            $locked->update(['status' => CommunityUserRestriction::STATUS_REVOKED, 'revoked_at' => now(), 'revoked_by_user_id' => $actor->id]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityRestrictionRevoked, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityUserRestriction, subjectId: $locked->id,
                newValues: ['revoked_by_user_id' => $actor->id],
            ), $context);

            return $locked;
        });
    }

    public function submitAppeal(CommunityReport $report, User $actor, int $tenantId, int $schoolId, string $statement, AuditContext $context): CommunityAppeal
    {
        abort_unless((int) $report->tenant_id === $tenantId && (int) $report->school_id === $schoolId && $report->status === CommunityReport::STATUS_RESOLVED && (int) $report->reported_user_id === $actor->id, 403);

        return DB::transaction(function () use ($report, $actor, $tenantId, $schoolId, $statement, $context): CommunityAppeal {
            if (CommunityAppeal::query()->where('community_report_id', $report->id)->where('appellant_user_id', $actor->id)->exists()) {
                throw ValidationException::withMessages(['appeal' => 'Only one appeal is allowed for this decision.']);
            }
            $sourceAction = $report->actions()->whereIn('action', ['reject', 'hide', 'approve', 'no_violation'])->latest()->firstOrFail();
            $appeal = CommunityAppeal::query()->create([
                'tenant_id' => $tenantId, 'school_id' => $schoolId, 'community_report_id' => $report->id,
                'source_action_id' => $sourceAction->id, 'appellant_user_id' => $actor->id,
                'statement' => trim($statement), 'status' => CommunityAppeal::STATUS_SUBMITTED,
            ]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityAppealSubmitted, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityAppeal, subjectId: $appeal->id,
                newValues: ['report_id' => $report->id],
            ), $context);

            return $appeal;
        });
    }

    public function decideAppeal(CommunityAppeal $appeal, User $actor, int $tenantId, int $schoolId, string $decision, string $reason, AuditContext $context): CommunityAppeal
    {
        abort_unless((int) $appeal->tenant_id === $tenantId && (int) $appeal->school_id === $schoolId, 403);

        return DB::transaction(function () use ($appeal, $actor, $decision, $reason, $schoolId, $context): CommunityAppeal {
            $locked = CommunityAppeal::query()->whereKey($appeal->id)->lockForUpdate()->firstOrFail();
            $sourceAction = $locked->sourceAction()->firstOrFail();
            if ((int) $sourceAction->actor_user_id === $actor->id) {
                throw ValidationException::withMessages(['reviewer' => 'A different moderator must decide the appeal.']);
            }
            if ($locked->status !== CommunityAppeal::STATUS_SUBMITTED) {
                throw ValidationException::withMessages(['appeal' => 'This appeal is already decided.']);
            }
            $report = $locked->report()->lockForUpdate()->firstOrFail();
            if ($decision === 'overturned') {
                $post = $report->community_post_id ? CommunityPost::query()->whereKey($report->community_post_id)->lockForUpdate()->first() : null;
                $comment = $report->community_comment_id ? CommunityComment::query()->whereKey($report->community_comment_id)->lockForUpdate()->first() : null;
                if ($comment) {
                    $comment->update(['status' => CommunityComment::STATUS_VISIBLE, 'hidden_at' => null, 'hidden_by_user_id' => null, 'reviewed_at' => now(), 'reviewed_by_user_id' => $actor->id]);
                } elseif ($post) {
                    $post->update(['status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => $post->published_at ?? now(), 'hidden_at' => null, 'hidden_by_user_id' => null, 'reviewed_at' => now(), 'reviewed_by_user_id' => $actor->id]);
                    $post->media()->update(['status' => 'ready']);
                }
            }
            $locked->update(['status' => CommunityAppeal::STATUS_DECIDED, 'reviewed_by_user_id' => $actor->id, 'decision' => $decision, 'decision_reason' => trim($reason), 'reviewed_at' => now()]);
            $report->actions()->create(['tenant_id' => $report->tenant_id, 'school_id' => $report->school_id, 'actor_user_id' => $actor->id, 'action' => "appeal_{$decision}", 'reason' => trim($reason)]);
            PortalNotification::query()->create([
                'school_id' => $schoolId, 'recipient_user_id' => $locked->appellant_user_id, 'type' => 'community_moderation',
                'title' => 'Community appeal decided', 'body' => 'Your Community appeal has been reviewed.',
                'context_json' => ['appeal_id' => $locked->id, 'decision' => $decision],
            ]);
            $this->audit->record(new AuditEvent(
                action: AuditAction::CommunityAppealDecided, module: AuditModule::Community, schoolId: $schoolId,
                subjectType: AuditSubject::CommunityAppeal, subjectId: $locked->id,
                newValues: ['decision' => $decision], reason: trim($reason),
            ), $context);

            return $locked->fresh();
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
