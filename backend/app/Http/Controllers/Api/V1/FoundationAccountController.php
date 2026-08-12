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
    public function store(Request $request, FoundationAccountService $service, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        if ($request->filled('school_id') && $request->integer('school_id') !== $schoolId) {
            abort(403, 'User cannot be created for a different school.');
        }

        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/^[a-z0-9._-]+$/', Rule::unique('users', 'username')],
            'password' => ['required', 'string', 'min:12', 'max:255'],
            'roles' => ['required', 'array', 'min:1', 'max:3'],
            'roles.*' => ['string', 'distinct', Rule::in(['teacher', 'parent', 'student'])],
        ]);
        unset($data['school_id']);
        $user = $service->create($schoolId, $data, $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($user)], 201);
    }

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

        return response()->json(['data' => $this->response($user)]);
    }

    private function response(User $user): array
    {
        return [
            'id' => $user->id,
            'school_id' => $user->school_id,
            'name' => $user->name,
            'username' => $user->username,
            'status' => $user->status,
            'roles' => $user->roles->pluck('slug')->sort()->values(),
            'permissions' => $user->roles->flatMap(fn ($role) => $role->permissions->pluck('slug'))->unique()->sort()->values(),
        ];
    }
}
