<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PortalNotification;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PortalNotificationController extends Controller
{
    /**
     * List notifications for the authenticated user (newest first, max 50).
     */
    public function index(Request $request): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $user = $request->user();

        $notifications = PortalNotification::where('recipient_user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (PortalNotification $n) => $this->notificationResponse($n));

        $unreadCount = PortalNotification::where('recipient_user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $notifications,
            'meta' => ['unread_count' => $unreadCount],
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, PortalNotification $portalNotification): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $user = $request->user();

        if ((int) $portalNotification->recipient_user_id !== (int) $user->id
            || (int) $portalNotification->school_id !== (int) $user->school_id) {
            abort(403, 'Notification does not belong to this account.');
        }

        if (! $portalNotification->read_at) {
            $portalNotification->update(['read_at' => now()]);
        }

        return response()->json(['data' => $this->notificationResponse($portalNotification->fresh())]);
    }

    /**
     * Mark all notifications for the authenticated user as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        SchoolContext::fromRequest($request);
        $user = $request->user();

        PortalNotification::where('recipient_user_id', $user->id)
            ->where('school_id', $user->school_id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function notificationResponse(PortalNotification $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'context_json' => $n->context_json,
            'read_at' => $n->read_at?->toISOString(),
            'created_at' => $n->created_at?->toISOString(),
        ];
    }
}
