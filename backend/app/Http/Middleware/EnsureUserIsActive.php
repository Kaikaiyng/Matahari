<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $userId = $request->user()?->getAuthIdentifier();
        $status = $userId === null ? null : User::query()->whereKey($userId)->value('status');

        if ($status === 'active') {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return new JsonResponse([
            'message' => 'Unauthenticated.',
        ], Response::HTTP_UNAUTHORIZED);
    }
}
