<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityAppeal;
use App\Models\CommunityReport;
use App\Models\CommunityUserRestriction;
use App\Models\School;
use App\Models\User;
use App\Services\Community\CommunityModerationService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommunityModerationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $reports = CommunityReport::query()->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])
            ->orderByRaw("CASE WHEN priority = 'severe' THEN 0 ELSE 1 END")->orderBy('due_at')->limit(100)->get();

        return response()->json(['data' => $reports->map(fn (CommunityReport $report) => $this->response($report))]);
    }

    public function show(Request $request, CommunityReport $communityReport): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        abort_unless((int) $communityReport->tenant_id === $tenantId && (int) $communityReport->school_id === $schoolId, 403);

        return response()->json(['data' => $this->response($communityReport->load(['actions.actor:id,name', 'reporter:id,name', 'reportedUser:id,name']))]);
    }

    public function decide(Request $request, CommunityReport $communityReport, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['no_violation', 'approve', 'reject', 'hide', 'warn', 'escalate'])],
            'reason_code' => ['required', Rule::in(array_merge((array) config('community_safety.reason_codes', []), ['no_violation']))],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        [$tenantId, $schoolId] = $this->scope($request);
        $report = $service->reviewReport($communityReport, $request->user(), $tenantId, $schoolId, $data['decision'], $data['reason_code'], $data['reason'], $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($report)]);
    }

    public function restrict(Request $request, User $user, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', Rule::in(['comment', 'publish', 'media', 'all'])],
            'reason_code' => ['required', Rule::in((array) config('community_safety.reason_codes', []))],
            'reason' => ['required', 'string', 'max:2000'],
            'ends_at' => ['nullable', 'date', 'after:now'],
        ]);
        [$tenantId, $schoolId] = $this->scope($request);
        $restriction = $service->applyRestriction($user, $request->user(), $tenantId, $schoolId, $data['scope'], $data['reason_code'], $data['reason'], $data['ends_at'] ?? null, $contexts->fromRequest($request));

        return response()->json(['data' => $this->restrictionResponse($restriction)], 201);
    }

    public function revokeRestriction(Request $request, CommunityUserRestriction $communityUserRestriction, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $restriction = $service->revokeRestriction($communityUserRestriction, $request->user(), $tenantId, $schoolId, $contexts->fromRequest($request));

        return response()->json(['data' => $this->restrictionResponse($restriction)]);
    }

    public function decideAppeal(Request $request, CommunityAppeal $communityAppeal, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', Rule::in(['upheld', 'overturned'])], 'reason' => ['required', 'string', 'max:2000']]);
        [$tenantId, $schoolId] = $this->scope($request);
        $appeal = $service->decideAppeal($communityAppeal, $request->user(), $tenantId, $schoolId, $data['decision'], $data['reason'], $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $appeal->id, 'status' => $appeal->status, 'decision' => $appeal->decision, 'reviewed_at' => $appeal->reviewed_at?->toIso8601String()]]);
    }

    /** @return array{int, int} */
    private function scope(Request $request): array
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return [(int) School::query()->whereKey($schoolId)->value('tenant_id'), $schoolId];
    }

    /** @return array<string, mixed> */
    private function response(CommunityReport $report): array
    {
        return [
            'id' => $report->id, 'source' => $report->source, 'target_type' => $report->target_type,
            'reason_code' => $report->reason_code, 'priority' => $report->priority, 'status' => $report->status,
            'due_at' => $report->due_at?->toIso8601String(), 'overdue' => $report->due_at?->isPast() && $report->status !== CommunityReport::STATUS_RESOLVED,
            'target_snapshot' => $report->target_snapshot, 'resolution_code' => $report->resolution_code,
            'actions' => $report->relationLoaded('actions') ? $report->actions : [],
        ];
    }

    /** @return array<string, mixed> */
    private function restrictionResponse(CommunityUserRestriction $restriction): array
    {
        return ['id' => $restriction->id, 'user_id' => $restriction->user_id, 'scope' => $restriction->scope, 'status' => $restriction->status, 'ends_at' => $restriction->ends_at?->toIso8601String()];
    }
}
