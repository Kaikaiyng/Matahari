<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\UserAttendanceAbility;
use App\Services\Attendance\AttendanceAbilityService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceAbilityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['user_id' => ['nullable', 'integer']]);
        $items = UserAttendanceAbility::query()
            ->with(['user:id,name,username', 'permission:id,slug,name'])
            ->where('school_id', SchoolContext::fromRequest($request)->schoolId)
            ->when($data['user_id'] ?? null, fn ($query, $id) => $query->where('user_id', $id))
            ->latest('effective_from')
            ->get();

        return response()->json(['data' => $items->map(fn (UserAttendanceAbility $item) => $this->response($item))]);
    }

    public function store(Request $request, AttendanceAbilityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'permission' => ['required', 'string', Rule::exists('permissions', 'slug')],
            'effective_from' => ['required', 'date'],
            'expires_at' => ['nullable', 'date', 'after:effective_from'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $item = $service->grant(
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $this->response($item->load(['user', 'permission']))], 201);
    }

    public function destroy(Request $request, UserAttendanceAbility $userAttendanceAbility, AttendanceAbilityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $item = $service->revoke(
            SchoolContext::fromRequest($request)->schoolId,
            $userAttendanceAbility,
            $data['reason'],
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => [...$this->response($item->loadMissing(['user', 'permission'])), 'revoked' => true]]);
    }

    private function response(UserAttendanceAbility $item): array
    {
        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'user_name' => $item->user?->name,
            'permission' => $item->permission?->slug,
            'effective_from' => $item->effective_from?->toIso8601String(),
            'expires_at' => $item->expires_at?->toIso8601String(),
            'revoked_at' => $item->revoked_at?->toIso8601String(),
            'reason' => $item->reason,
        ];
    }
}
