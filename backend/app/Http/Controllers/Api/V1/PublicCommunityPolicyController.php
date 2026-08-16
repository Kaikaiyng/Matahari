<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunityPolicyVersion;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicCommunityPolicyController extends Controller
{
    public function show(Request $request, string $slug): JsonResponse
    {
        $types = [
            'terms' => 'terms', 'privacy' => 'privacy', 'community-standards' => 'community_standards',
            'child-safety' => 'child_safety', 'support' => 'support',
        ];
        abort_unless(array_key_exists($slug, $types), 404);
        $context = TenantContext::optional($request);
        abort_unless($context && $context->surface() === 'app', 404);

        $policy = $slug === 'support' ? null : CommunityPolicyVersion::query()
            ->where('policy_type', $types[$slug])->where('effective_at', '<=', now())
            ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))
            ->latest('effective_at')->latest('id')->firstOrFail();
        $tenant = $context->tenant;

        return response()->json(['data' => [
            'slug' => $slug,
            'title' => $policy?->title ?? 'Support',
            'version' => $policy?->version,
            'effective_at' => $policy?->effective_at?->toIso8601String(),
            'sections' => $policy?->sections ?? [[
                'heading' => 'Contact Support',
                'body' => 'Contact RYLAY support for account, privacy, or Community safety assistance. Do not use ordinary support channels as an emergency service.',
            ]],
            'developer_name' => (string) config('community_safety.developer_name', 'RYLAY'),
            'organization_name' => $tenant->branding?->organization_name ?? $tenant->name,
            'store_safety_disclosure' => 'RYLAY prohibits child sexual abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, sextortion, trafficking, and the sexualization of children.',
            'support' => [
                'email' => config('community_safety.support_email'),
                'child_safety_email' => config('community_safety.child_safety_contact_email'),
            ],
        ]]);
    }
}
