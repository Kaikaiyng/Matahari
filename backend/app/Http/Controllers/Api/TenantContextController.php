<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantContextController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $context = TenantContext::optional($request);
        abort_unless($context, 404, 'Tenant context is unavailable.');

        $tenant = $context->tenant;
        $branding = $tenant->branding;

        return response()->json(['data' => [
            'id' => $tenant->id,
            'slug' => $tenant->slug,
            'name' => $tenant->name,
            'surface' => $context->surface(),
            'timezone' => $tenant->timezone,
            'locale' => $tenant->locale,
            'branding' => [
                'organization_name' => $branding?->organization_name ?? $tenant->name,
                'organization_short_name' => $branding?->organization_short_name ?? $tenant->name,
                'admin_title' => $branding?->admin_title ?? 'Administration & Finance',
                'app_title' => $branding?->app_title ?? 'School Community',
                'logo_url' => $branding?->logo_url,
                'primary_color' => $branding?->primary_color ?? '#c9254a',
                'accent_color' => $branding?->accent_color ?? '#1f2a44',
            ],
            'features' => $tenant->features->mapWithKeys(fn ($feature) => [$feature->feature_key => $feature->enabled])->all(),
        ]]);
    }
}
