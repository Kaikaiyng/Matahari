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
        $openCases = CommunityReport::query()->whereIn('status', [CommunityReport::STATUS_SUBMITTED, CommunityReport::STATUS_REVIEWING]);
        $severeCases = (clone $openCases)
            ->where(fn ($query) => $query->where('priority', 'severe')->orWhereHas('actions', fn ($actions) => $actions->where('action', 'escalate')))
            ->orderByRaw("CASE WHEN priority = 'severe' THEN 0 ELSE 1 END")->orderBy('due_at')->limit(100)->get();

        return response()->json(['data' => [
            'open' => (clone $openCases)->count(),
            'severe_open' => (clone $openCases)->where('priority', 'severe')->count(),
            'overdue' => (clone $openCases)->where('due_at', '<', now())->count(),
            'by_tenant' => (clone $openCases)->selectRaw('tenant_id, COUNT(*) as total')->groupBy('tenant_id')->orderBy('tenant_id')->get(),
            'severe_cases' => $severeCases->map(fn (CommunityReport $report) => [
                'id' => $report->id, 'tenant_id' => $report->tenant_id, 'school_id' => $report->school_id,
                'priority' => $report->priority, 'reason_code' => $report->reason_code, 'status' => $report->status,
                'due_at' => $report->due_at?->toIso8601String(), 'overdue' => $report->due_at?->isPast(),
            ]),
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
