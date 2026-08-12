<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Policies\PortalLinkPolicy;
use App\Services\Foundation\FoundationAccountService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FoundationAccountController extends Controller
{
    public function roles(Request $request, User $user, FoundationAccountService $service, PortalLinkPolicy $policy, AuditContextFactory $contexts): JsonResponse
    {
        if ((int) $user->school_id !== SchoolContext::fromRequest($request)->schoolId
            || ! $policy->update($request->user(), $user)) {
            abort(403, 'User belongs to a different school.');
        }
        $data = $request->validate([
            'roles' => ['required', 'array', 'max:3'],
            'roles.*' => ['string', 'distinct', Rule::in(['teacher', 'parent', 'student'])],
        ]);
        $user = $service->updateRoles($user, $data['roles'], $contexts->fromRequest($request));

        return response()->json(['data' => [
            'id' => $user->id,
            'roles' => $user->roles->pluck('slug')->sort()->values(),
            'permissions' => $user->roles->flatMap(fn ($role) => $role->permissions->pluck('slug'))->unique()->sort()->values(),
        ]]);
    }
}
