<?php

namespace App\Http\Middleware;

use App\Models\TenantFeature;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantFeatureEnabled
{
    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $context = TenantContext::optional($request);
        if (! $context) {
            return $next($request);
        }

        $enabled = TenantFeature::query()
            ->where('tenant_id', $context->tenantId())
            ->where('feature_key', $featureKey)
            ->where('enabled', true)
            ->exists();
        abort_unless($enabled, 404, 'This feature is not enabled for the active tenant.');

        return $next($request);
    }
}
