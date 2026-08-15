<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantSurface
{
    public function handle(Request $request, Closure $next, string ...$allowedSurfaces): Response
    {
        $context = TenantContext::optional($request);
        if (! $context && app()->environment('local', 'testing')) {
            return $next($request);
        }

        abort_unless($context && in_array($context->surface(), $allowedSurfaces, true), 404);

        return $next($request);
    }
}
