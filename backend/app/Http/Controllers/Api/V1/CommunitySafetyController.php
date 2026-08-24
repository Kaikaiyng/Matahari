<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityReport;
use App\Models\School;
use App\Services\Community\CommunityModerationService;
use App\Services\Community\CommunityPolicyService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        $acceptance = $service->acceptPolicy($request->user(), $tenantId, $schoolId, $communityPolicyVersion, [
            'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
            'user_agent_hash' => hash('sha256', (string) $request->userAgent()),
        ], $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $acceptance->id, 'accepted' => true, 'accepted_at' => $acceptance->accepted_at?->toIso8601String()]], $acceptance->wasRecentlyCreated ? 201 : 200);
    }

    public function storeReport(Request $request, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'target_type' => ['required', Rule::in(['post'])],
            'target_id' => ['required', 'integer'],
            'reason_code' => ['required', Rule::in(['incorrect', 'outdated', 'inappropriate', 'other'])],
            'details' => ['nullable', 'string', 'max:1000'],
        ]);
        [$tenantId, $schoolId] = $this->scope($request);
        $target = $service->resolveTarget($request->user(), $schoolId, $data['target_type'], (int) $data['target_id']);
        $report = $service->submitReport($request->user(), $tenantId, $schoolId, $target, $data['reason_code'], $data['details'] ?? null, $contexts->fromRequest($request));

        return response()->json(['data' => $this->reporterReport($report)], 201);
    }

    public function myReports(Request $request): JsonResponse
    {
        [$tenantId, $schoolId] = $this->scope($request);
        $reports = CommunityReport::query()->where('tenant_id', $tenantId)->where('school_id', $schoolId)
            ->where('source', 'user_report')->where('target_type', 'post')
            ->where('reporter_user_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $reports->map(fn (CommunityReport $report) => $this->reporterReport($report))]);
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
            'created_at' => $report->created_at?->toIso8601String(), 'due_at' => $report->due_at?->toIso8601String(),
            'id' => $report->id, 'priority' => $report->priority, 'reason_code' => $report->reason_code,
            'resolved_at' => $report->resolved_at?->toIso8601String(), 'status' => $report->status,
            'target_type' => $report->target_type,
        ];
    }
}
