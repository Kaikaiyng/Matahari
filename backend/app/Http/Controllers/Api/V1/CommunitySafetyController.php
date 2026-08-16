<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityAppeal;
use App\Models\CommunityComment;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityReport;
use App\Models\CommunityUserBlock;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\Community\CommunityModerationService;
use App\Services\Community\CommunityPolicyService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CommunitySafetyController extends Controller
{
    public function currentPolicies(Request $request, CommunityPolicyService $service): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);

        return response()->json(['data' => $service->currentPolicies($request->user(), $tenantId, $schoolId)]);
    }

    public function acceptPolicy(Request $request, CommunityPolicyVersion $communityPolicyVersion, CommunityPolicyService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $acceptance = $service->acceptPolicy(
            $request->user(),
            $tenantId,
            $schoolId,
            $communityPolicyVersion,
            [
                'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
                'user_agent_hash' => hash('sha256', (string) $request->userAgent()),
            ],
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => ['id' => $acceptance->id, 'accepted' => true, 'accepted_at' => $acceptance->accepted_at?->toIso8601String()]], $acceptance->wasRecentlyCreated ? 201 : 200);
    }

    public function storeReport(Request $request, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'target_type' => ['required', Rule::in(['post', 'comment', 'user'])],
            'target_id' => ['required', 'integer'],
            'reason_code' => ['required', Rule::in((array) config('community_safety.reason_codes', []))],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);
        [$tenantId, $schoolId] = $this->scope($request);
        $target = $service->resolveTarget($request->user(), $schoolId, $data['target_type'], (int) $data['target_id']);
        $report = $service->submitReport(
            $request->user(), $tenantId, $schoolId, $target, $data['reason_code'], $data['details'] ?? null,
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $this->reporterReport($report)], 201);
    }

    public function myReports(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $reports = CommunityReport::query()
            ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('source', 'user_report')
            ->where('reporter_user_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $reports->map(fn (CommunityReport $report) => $this->reporterReport($report))]);
    }

    public function block(Request $request, User $user, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        if ($request->user()->is($user)) {
            throw ValidationException::withMessages(['user' => 'You cannot block yourself.']);
        }
        $target = $service->resolveTarget($request->user(), $schoolId, 'user', $user->id);
        $block = $service->blockUser($request->user(), $tenantId, $schoolId, $target->reportedUser, $contexts->fromRequest($request));

        return response()->json(['data' => $this->blockResponse($block)], 201);
    }

    public function unblock(Request $request, User $user, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $block = $service->unblockUser($request->user(), $tenantId, $schoolId, $user, $contexts->fromRequest($request));

        return response()->json(['data' => $this->blockResponse($block)]);
    }

    public function blockedUsers(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $blocks = CommunityUserBlock::query()
            ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('blocker_user_id', $request->user()->id)->whereNull('revoked_at')
            ->with('blockedUser:id,name')->latest('blocked_at')->get();

        return response()->json(['data' => $blocks->map(fn (CommunityUserBlock $block) => $this->blockResponse($block))]);
    }

    public function myContent(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $posts = CommunityPost::query()
            ->addSelect(['report_id' => CommunityReport::query()->select('id')
                ->whereColumn('community_reports.community_post_id', 'community_posts.id')
                ->where('source', 'submission')->latest('id')->limit(1)])
            ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('author_user_id', $request->user()->id)
            ->whereIn('status', [CommunityPost::STATUS_PENDING_REVIEW, CommunityPost::STATUS_REJECTED, CommunityPost::STATUS_HIDDEN])
            ->latest()->get()->map(fn (CommunityPost $post) => [
                'id' => $post->id, 'type' => 'post', 'body' => $post->body, 'status' => $post->status,
                'moderation_reason_code' => $post->moderation_reason_code, 'report_id' => $post->getAttribute('report_id'),
                'created_at' => $post->created_at?->toIso8601String(),
            ]);
        $comments = CommunityComment::query()
            ->addSelect(['report_id' => CommunityReport::query()->select('id')
                ->whereColumn('community_reports.community_comment_id', 'community_comments.id')
                ->where('source', 'submission')->latest('id')->limit(1)])
            ->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', [CommunityComment::STATUS_PENDING_REVIEW, CommunityComment::STATUS_REJECTED, CommunityComment::STATUS_HIDDEN])
            ->latest()->get()->map(fn (CommunityComment $comment) => [
                'id' => $comment->id, 'type' => 'comment', 'body' => $comment->body, 'status' => $comment->status,
                'moderation_reason_code' => $comment->moderation_reason_code, 'report_id' => $comment->getAttribute('report_id'),
                'created_at' => $comment->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $posts->concat($comments)->sortByDesc('created_at')->values()]);
    }

    public function authorizeStudent(Request $request, Student $student, CommunityPolicyService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $authorization = $service->authorizeStudent($request->user(), $tenantId, $schoolId, $student, $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $authorization->id, 'student_id' => $student->id, 'active' => true]], 201);
    }

    public function revokeStudentAuthorization(Request $request, Student $student, CommunityPolicyService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $authorization = $service->revokeStudentAuthorization($request->user(), $tenantId, $schoolId, $student, $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $authorization->id, 'student_id' => $student->id, 'active' => false]]);
    }

    public function submitAppeal(Request $request, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['report_id' => ['required', 'integer'], 'statement' => ['required', 'string', 'max:2000']]);
        [$tenantId, $schoolId] = $this->scope($request);
        $report = CommunityReport::query()->findOrFail($data['report_id']);
        $appeal = $service->submitAppeal($report, $request->user(), $tenantId, $schoolId, $data['statement'], $contexts->fromRequest($request));

        return response()->json(['data' => $this->appealResponse($appeal)], 201);
    }

    public function myAppeals(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $appeals = CommunityAppeal::query()->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('appellant_user_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $appeals->map(fn (CommunityAppeal $appeal) => $this->appealResponse($appeal))]);
    }

    /** @return array{int, int} */
    private function scope(Request $request): array
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');
        abort_if($tenantId === 0, 404);

        return [$tenantId, $schoolId];
    }

    /** @return array<string, mixed> */
    private function reporterReport(CommunityReport $report): array
    {
        return [
            'created_at' => $report->created_at?->toIso8601String(),
            'due_at' => $report->due_at?->toIso8601String(),
            'id' => $report->id,
            'priority' => $report->priority,
            'reason_code' => $report->reason_code,
            'resolved_at' => $report->resolved_at?->toIso8601String(),
            'status' => $report->status,
            'target_type' => $report->target_type,
        ];
    }

    /** @return array<string, mixed> */
    private function blockResponse(CommunityUserBlock $block): array
    {
        $block->loadMissing('blockedUser:id,name');

        return [
            'id' => $block->id,
            'user' => ['id' => $block->blockedUser->id, 'name' => $block->blockedUser->name],
            'blocked_at' => $block->blocked_at?->toIso8601String(),
            'active' => $block->revoked_at === null,
        ];
    }

    /** @return array<string, mixed> */
    private function appealResponse(CommunityAppeal $appeal): array
    {
        return [
            'id' => $appeal->id, 'report_id' => $appeal->community_report_id, 'status' => $appeal->status,
            'decision' => $appeal->decision, 'decision_reason' => $appeal->decision_reason,
            'created_at' => $appeal->created_at?->toIso8601String(), 'reviewed_at' => $appeal->reviewed_at?->toIso8601String(),
        ];
    }
}
