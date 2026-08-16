<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditAction;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Http\Controllers\Controller;
use App\Models\CommunityReport;
use App\Services\Community\CommunityModerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformCommunityModerationController extends Controller
{
    public function summary(): JsonResponse
    {
        return response()->json(['data' => [
            'open' => CommunityReport::query()->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])->count(),
            'severe_open' => CommunityReport::query()->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])->where('priority', 'severe')->count(),
            'overdue' => CommunityReport::query()->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])->where('due_at', '<', now())->count(),
            'by_tenant' => CommunityReport::query()->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING])->selectRaw('tenant_id, COUNT(*) as total')->groupBy('tenant_id')->orderBy('tenant_id')->get(),
        ]]);
    }

    public function show(Request $request, CommunityReport $communityReport, AuditLoggerContract $audit, AuditContextFactory $contexts): JsonResponse
    {
        $escalated = $communityReport->actions()->where('action', 'escalate')->exists();
        abort_unless($communityReport->priority === 'severe' || $escalated, 403);
        $audit->record(new AuditEvent(
            action: AuditAction::CommunityPlatformCaseViewed, module: AuditModule::Community,
            schoolId: $communityReport->school_id, subjectType: AuditSubject::CommunityReport, subjectId: $communityReport->id,
            metadata: ['tenant_id' => $communityReport->tenant_id],
        ), $contexts->fromRequest($request));

        return response()->json(['data' => [
            'id' => $communityReport->id, 'tenant_id' => $communityReport->tenant_id, 'school_id' => $communityReport->school_id,
            'source' => $communityReport->source, 'priority' => $communityReport->priority, 'status' => $communityReport->status,
            'reason_code' => $communityReport->reason_code, 'target_snapshot' => $communityReport->target_snapshot,
            'due_at' => $communityReport->due_at?->toIso8601String(),
        ]]);
    }

    public function intervene(Request $request, CommunityReport $communityReport, CommunityModerationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $escalated = $communityReport->actions()->where('action', 'escalate')->exists();
        abort_unless($communityReport->priority === 'severe' || $escalated, 403);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['no_violation', 'approve', 'reject', 'hide', 'warn'])],
            'reason_code' => ['required', Rule::in(array_merge((array) config('community_safety.reason_codes', []), ['no_violation']))],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        $report = $service->reviewReport(
            $communityReport, $request->user(), (int) $communityReport->tenant_id, (int) $communityReport->school_id,
            $data['decision'], $data['reason_code'], $data['reason'], $contexts->fromRequest($request),
        );

        return response()->json(['data' => ['id' => $report->id, 'status' => $report->status, 'resolution_code' => $report->resolution_code]]);
    }
}
