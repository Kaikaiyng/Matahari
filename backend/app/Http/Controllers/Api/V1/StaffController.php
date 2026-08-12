<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Foundation\FoundationAccountService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        $staffUsers = User::query()
            ->where('school_id', $schoolId)
            ->whereHas('roles', fn ($query) => $query->whereIn('slug', [
                'super-admin',
                'school-admin',
                'finance',
                'teacher',
            ]))
            ->with([
                'roles:id,name,slug',
                'teachingAssignments' => fn ($query) => $query->where('status', 'active')->whereNull('ended_at'),
                'teachingAssignments.schoolClass:id,name',
                'teachingAssignments.subject:id,name',
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => $this->response($user));

        return response()->json(['data' => $staffUsers]);
    }

    public function store(
        Request $request,
        FoundationAccountService $service,
        AuditContextFactory $contexts,
    ): JsonResponse {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique('users', 'username'),
            ],
            'password' => ['required', 'string', 'min:12', 'max:255'],
            'role_slug' => ['prohibited'],
        ]);

        $user = $service->create($schoolId, [
            ...$data,
            'roles' => ['teacher'],
        ], $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($user)], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function response(User $user): array
    {
        $roles = $user->roles->sortBy('name')->values();
        $assignedClasses = $user->teachingAssignments
            ->map(fn ($assignment): string => trim(
                ($assignment->schoolClass?->name ?? '').
                ($assignment->subject ? ' ('.$assignment->subject->name.')' : ''),
            ))
            ->filter()
            ->values();

        return [
            'id' => $user->id,
            'staff_no' => 'EMP-'.str_pad((string) $user->id, 4, '0', STR_PAD_LEFT),
            'name' => $user->name,
            'username' => $user->username,
            'role' => $roles->first()?->name ?? 'Staff',
            'roles' => $roles->pluck('slug'),
            'status' => $user->status,
            'assigned_classes' => $assignedClasses,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
