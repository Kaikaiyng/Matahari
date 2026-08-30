<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class AuditLogController extends Controller
{
    public function index(IndexAuditLogRequest $request): JsonResponse
    {
        $data = $request->validated();
        $summaryQuery = AuditLog::query();
        $summary = [
            'total' => (clone $summaryQuery)->count(),
            'today' => (clone $summaryQuery)->whereDate('created_at', now()->toDateString())->count(),
            'active_actors_30_days' => (clone $summaryQuery)
                ->where('created_at', '>=', now()->subDays(30))
                ->whereNotNull('actor_username')
                ->distinct()
                ->count('actor_username'),
            'security_admin' => (clone $summaryQuery)
                ->whereIn('module', ['authentication', 'users', 'reports', 'batch', 'tenancy'])
                ->count(),
        ];

        $query = AuditLog::query()
            ->when($data['search'] ?? null, function ($query, $value) {
                $query->where(function ($searchQuery) use ($value) {
                    $pattern = '%'.$value.'%';
                    $searchQuery
                        ->where('action', 'like', $pattern)
                        ->orWhere('module', 'like', $pattern)
                        ->orWhere('entity_type', 'like', $pattern)
                        ->orWhere('actor_username', 'like', $pattern)
                        ->orWhere('ip_address', 'like', $pattern)
                        ->orWhere('request_id', 'like', $pattern);

                    if (ctype_digit((string) $value)) {
                        $searchQuery->orWhere('entity_id', (int) $value);
                    }
                });
            })
            ->when($data['action'] ?? null, fn ($query, $value) => $query->where('action', $value))
            ->when($data['module'] ?? null, fn ($query, $value) => $query->where('module', $value))
            ->when($data['entity_type'] ?? null, fn ($query, $value) => $query->where('entity_type', $value))
            ->when($data['entity_id'] ?? null, fn ($query, $value) => $query->where('entity_id', $value))
            ->when($data['user_id'] ?? null, fn ($query, $value) => $query->where('user_id', $value))
            ->when($data['school_id'] ?? null, fn ($query, $value) => $query->where('school_id', $value))
            ->when($data['request_id'] ?? null, fn ($query, $value) => $query->where('request_id', $value))
            ->when($data['actor_username'] ?? null, fn ($query, $value) => $query->where('actor_username', $value))
            ->when(
                $data['date_from'] ?? null,
                fn ($query, $value) => $query->where('created_at', '>=', Carbon::parse($value)->startOfDay()),
            )
            ->when(
                $data['date_to'] ?? null,
                fn ($query, $value) => $query->where('created_at', '<=', Carbon::parse($value)->endOfDay()),
            )
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $perPage = (int) ($data['per_page'] ?? 50);
        $paginator = $query->cursorPaginate($perPage)->withQueryString();

        return response()->json([
            'data' => AuditLogResource::collection($paginator->items())->resolve($request),
            'meta' => [
                'per_page' => $perPage,
                'next_cursor' => $paginator->nextCursor()?->encode(),
                'previous_cursor' => $paginator->previousCursor()?->encode(),
                'summary' => $summary,
            ],
        ]);
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        return response()->json([
            'data' => (new AuditLogResource($auditLog))->resolve(request()),
        ]);
    }
}
