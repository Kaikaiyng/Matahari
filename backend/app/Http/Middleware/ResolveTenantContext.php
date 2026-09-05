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
        [$mode, $dedicatedTenantSlug] = $this->validatedConfiguration();
        $host = strtolower(rtrim($request->getHost(), '.'));
        if (! Schema::hasTable('tenant_domains')) {
            if (app()->environment('local', 'testing')) {
                return $next($request);
            }
            abort(503, 'Tenant foundation is not available.');
        }
        $domainQuery = TenantDomain::query()
            ->with(['tenant.branding', 'tenant.features'])
            ->where('hostname', $host)
            ->where('status', 'active')
            ->whereNotNull('verified_at');

        if ($mode === 'dedicated') {
            $domainQuery->whereHas(
                'tenant',
                fn ($query) => $query->where('slug', $dedicatedTenantSlug),
            );
        }

        $domain = $domainQuery->first();

        if ($domain && $domain->tenant->status === 'active') {
            return $this->continueWith($request, $next, new TenantContext($domain->tenant, $domain));
        }

        if ($this->mayUseLocalFallback($host)) {
            $slug = $mode === 'dedicated'
                ? $dedicatedTenantSlug
                : config('tenancy.default_tenant_slug');
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
        return app()->environment('local', 'testing')
            && in_array($host, config('tenancy.local_hosts', []), true);
    }

    /** @return array{string, string|null} */
    private function validatedConfiguration(): array
    {
        $mode = config('tenancy.mode');
        abort_unless(
            is_string($mode) && in_array($mode, ['dedicated', 'multi_tenant'], true),
            503,
            'Tenancy mode is not configured.',
        );

        $dedicatedTenantSlug = config('tenancy.dedicated_tenant_slug');
        if ($mode === 'dedicated') {
            abort_unless(
                is_string($dedicatedTenantSlug)
                    && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $dedicatedTenantSlug) === 1,
                503,
                'Dedicated tenant is not configured.',
            );
        }

        return [$mode, is_string($dedicatedTenantSlug) ? $dedicatedTenantSlug : null];
    }

    private function continueWith(Request $request, Closure $next, TenantContext $context): Response
    {
        $request->attributes->set(TenantContext::ATTRIBUTE, $context);
        app()->instance(TenantContext::class, $context);

        return $next($request);
    }
}
