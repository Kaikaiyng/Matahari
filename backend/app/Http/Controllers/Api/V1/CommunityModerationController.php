<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityReport;
use App\Models\School;
use App\Services\Community\CommunityModerationService;
use App\Support\SchoolContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommunityModerationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $reports = $this->activePostReports($tenantId, $schoolId)
            ->with($this->reportRelations())
            ->orderBy('due_at')->limit(100)->get();

        return response()->json(['data' => $reports->map(fn (CommunityReport $report) => $this->response($report))]);
    }

    public function show(Request $request, CommunityReport $communityReport): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $report = $this->activePostReports($tenantId, $schoolId)->with($this->reportRelations())->whereKey($communityReport->id)->firstOrFail();

        return response()->json(['data' => $this->response($report)]);
    }

    public function decide(Request $request, CommunityReport $communityReport, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $report = $this->activePostReports($tenantId, $schoolId)->whereKey($communityReport->id)->firstOrFail();
        $data = $request->validate([
            'decision' => ['required', Rule::in(['no_action', 'remove_content'])],
            'reason_code' => ['required', Rule::in(['incorrect', 'outdated', 'inappropriate', 'other'])],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        $report = $service->reviewReport($report, $request->user(), $tenantId, $schoolId, $data['decision'], $data['reason_code'], $data['reason'], $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($report)]);
    }

    /** @return array{int, int} */
    private function scope(Request $request): array
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return [(int) School::query()->whereKey($schoolId)->value('tenant_id'), $schoolId];
    }

    /** @return Builder<CommunityReport> */
    private function activePostReports(int $tenantId, int $schoolId): Builder
    {
        return CommunityReport::query()->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('source', 'user_report')->where('target_type', 'post')
            ->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING]);
    }

    /** @return array<int, string> */
    private function reportRelations(): array
    {
        return ['reporter:id,name', 'post.author:id,name', 'post.audiences.schoolClass:id,name', 'actions.actor:id,name'];
    }

    /** @return array<string, mixed> */
    private function response(CommunityReport $report): array
    {
        $post = $report->post;

        return [
            'id' => $report->id, 'source' => $report->source, 'target_type' => $report->target_type,
            'reason_code' => $report->reason_code, 'priority' => $report->priority, 'status' => $report->status,
            'details' => $report->details, 'created_at' => $report->created_at?->toIso8601String(),
            'due_at' => $report->due_at?->toIso8601String(),
            'overdue' => $report->due_at?->isPast() && $report->status !== CommunityReport::STATUS_RESOLVED,
            'target_snapshot' => $report->target_snapshot, 'resolution_code' => $report->resolution_code,
            'reporter' => $report->reporter ? ['id' => $report->reporter->id, 'name' => $report->reporter->name] : null,
            'post' => $post ? [
                'author' => $post->author ? ['id' => $post->author->id, 'name' => $post->author->name] : null,
                'audience' => [
                    'school' => $post->audiences->contains('audience_type', 'school'),
                    'classes' => $post->audiences->where('audience_type', 'class')->map(fn ($audience) => $audience->schoolClass ? ['id' => $audience->schoolClass->id, 'name' => $audience->schoolClass->name] : null)->filter()->values(),
                ],
            ] : null,
            'actions' => $report->actions->map(fn ($action) => [
                'id' => $action->id, 'action' => $action->action, 'reason_code' => $action->reason_code,
                'reason' => $action->reason,
                'actor' => $action->actor ? ['id' => $action->actor->id, 'name' => $action->actor->name] : null,
                'created_at' => $action->created_at?->toIso8601String(),
            ])->values(),
        ];
    }
}
