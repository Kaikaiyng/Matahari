<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Policies\PortalLinkPolicy;
use App\Services\Foundation\PortalLinkService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PortalLinkController extends Controller
{
    public function guardianUser(Request $request, Guardian $guardian, PortalLinkService $service, PortalLinkPolicy $policy, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertAccess($request, $guardian, $policy);
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id']]);
        $guardian = $service->linkGuardian($guardian, $data['user_id'] ?? null, $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $guardian->id, 'user_id' => $guardian->user_id]]);
    }

    public function studentUser(Request $request, Student $student, PortalLinkService $service, PortalLinkPolicy $policy, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertAccess($request, $student, $policy);
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id']]);
        $student = $service->linkStudent($student, $data['user_id'] ?? null, $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $student->id, 'user_id' => $student->user_id]]);
    }

    public function guardianAccess(Request $request, StudentParentLink $studentParentLink, PortalLinkService $service, PortalLinkPolicy $policy, AuditContextFactory $contexts): JsonResponse
    {
        $this->assertAccess($request, $studentParentLink, $policy);
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(['unreviewed', 'active', 'ended'])],
            'can_view_finance' => ['nullable', 'boolean', 'required_if:status,active'],
            'can_view_academics' => ['nullable', 'boolean', 'required_if:status,active'],
            'starts_on' => ['nullable', 'date'],
            'ended_on' => ['nullable', 'date', 'required_if:status,ended'],
        ]);
        $link = $service->updateGuardianAccess($studentParentLink, $data, $contexts->fromRequest($request));

        return response()->json(['data' => [
            'id' => $link->id, 'status' => $link->status,
            'can_view_finance' => $link->can_view_finance, 'can_view_academics' => $link->can_view_academics,
            'starts_on' => $link->starts_on?->toDateString(), 'ended_on' => $link->ended_on?->toDateString(),
        ]]);
    }

    private function assertAccess(Request $request, mixed $record, PortalLinkPolicy $policy): void
    {
        if ((int) $record->school_id !== SchoolContext::fromRequest($request)->schoolId
            || ! $policy->update($request->user(), $record)) {
            abort(403, 'Portal link record belongs to a different school.');
        }
    }
}
