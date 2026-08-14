<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->forgetInstance(TenantContext::class);
        $host = strtolower(rtrim($request->getHost(), '.'));
        if (! Schema::hasTable('tenant_domains')) {
            if (app()->environment('local', 'testing')) {
                return $next($request);
            }
            abort(503, 'Tenant foundation is not available.');
        }
        $domain = TenantDomain::query()
            ->with(['tenant.branding', 'tenant.features'])
            ->where('hostname', $host)
            ->where('status', 'active')
            ->whereNotNull('verified_at')
            ->first();

        if ($domain && $domain->tenant->status === 'active') {
            return $this->continueWith($request, $next, new TenantContext($domain->tenant, $domain));
        }

        if ($this->mayUseLocalFallback($host)) {
            $slug = config('tenancy.default_tenant_slug');
            if (is_string($slug) && $slug !== '') {
                $tenant = Tenant::query()->with(['branding', 'features'])->where('slug', $slug)->where('status', 'active')->first();
                if ($tenant) {
                    return $this->continueWith($request, $next, new TenantContext($tenant));
                }
            }

            return $next($request);
        }

        abort(404, 'Tenant domain was not found or is inactive.');
    }

    private function mayUseLocalFallback(string $host): bool
    {
        return (app()->environment('local', 'testing') || config('tenancy.allow_unresolved_local_hosts'))
            && in_array($host, config('tenancy.local_hosts', []), true);
    }

    private function continueWith(Request $request, Closure $next, TenantContext $context): Response
    {
        $request->attributes->set(TenantContext::ATTRIBUTE, $context);
        app()->instance(TenantContext::class, $context);

        return $next($request);
    }
}
