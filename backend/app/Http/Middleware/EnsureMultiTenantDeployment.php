<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMultiTenantDeployment
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('tenancy.mode') === 'multi_tenant', 404);

        return $next($request);
    }
}
