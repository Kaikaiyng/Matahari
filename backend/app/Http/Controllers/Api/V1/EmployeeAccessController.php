<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Authorization\EmployeeAccessCatalog;
use App\Services\Authorization\EmployeeAccessService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class EmployeeAccessController extends Controller
{
    public function show(Request $request, User $user, EmployeeAccessService $service): JsonResponse
    {
        return response()->json(['data' => $service->payload($user, SchoolContext::fromRequest($request)->schoolId)]);
    }

    public function update(Request $request, User $user, EmployeeAccessService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'position' => ['required', Rule::in(EmployeeAccessCatalog::POSITIONS)],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'distinct'],
            'teacher_app_access' => ['required', 'boolean'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $data['reason'] = trim($data['reason']);
        if ($data['reason'] === '') {
            return response()->json(['message' => 'A reason is required.', 'errors' => ['reason' => ['A reason is required.']]], 422);
        }

        return response()->json(['data' => $service->update(
            $user,
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $request->user(),
            $contexts->fromRequest($request),
        )]);
    }
}
