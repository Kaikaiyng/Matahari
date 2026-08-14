<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantMembership
{
    public function handle(Request $request, Closure $next): Response
    {
        $context = TenantContext::optional($request);
        $user = $request->user();

        if (! $context || ! $user) {
            return $next($request);
        }

        if ($user->applyTenantMembershipScope($context->tenantId())) {
            if ($user->is_platform_owner && $user->school_id === null
                && ! $request->is('api/me', 'api/logout', 'api/v1/platform/*')) {
                abort(403, 'Select a school in the active tenant before accessing school data.');
            }

            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return new JsonResponse(['message' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
    }
}
