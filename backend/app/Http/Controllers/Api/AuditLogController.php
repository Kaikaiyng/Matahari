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
        $query = AuditLog::query()
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
