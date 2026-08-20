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
            'child-safety' => 'child_safety', 'support' => 'support', 'account-deletion' => 'account_deletion',
        ];
        abort_unless(array_key_exists($slug, $types), 404);
        $context = TenantContext::optional($request);

        try {
            $policy = in_array($slug, ['support', 'account-deletion'], true) ? null : CommunityPolicyVersion::query()
                ->where('policy_type', $types[$slug])->where('effective_at', '<=', now())
                ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))
                ->latest('effective_at')->latest('id')->first();
        } catch (\Throwable) {
            $policy = null;
        }
        $tenant = $context?->tenant;

        $fallbacks = [
            'terms' => [
                'title' => 'Terms of Use',
                'sections' => [['heading' => 'Terms of Use', 'body' => 'Use of the RYLAY Community feature is subject to institution membership, verified identity, and adherence to the Community Standards. Unlawful, harassing, or harmful conduct is strictly prohibited.']],
            ],
            'privacy' => [
                'title' => 'Privacy Notice',
                'sections' => [['heading' => 'Privacy Policy', 'body' => 'RYLAY preserves user privacy within the closed school context. Personal identity data, moderation records, and security logs are accessed only for authorized administration and safeguarding purposes.']],
            ],
            'community-standards' => [
                'title' => 'Community Standards',
                'sections' => [['heading' => 'Community Standards', 'body' => 'Do not post prohibited content including CSAE/CSAM, grooming, sexual content involving minors, bullying, harassment, threats, hate speech, self-harm, privacy exposure, impersonation, or spam.']],
            ],
            'child-safety' => [
                'title' => 'Child Safety Standards',
                'sections' => [['heading' => 'Child Safety Policy', 'body' => 'RYLAY strictly prohibits child sexual abuse material (CSAM), child sexual exploitation (CSAE), grooming, sextortion, and minor endangerment. Suspected material is immediately quarantined and reported according to lawful procedures.']],
            ],
            'account-deletion' => [
                'title' => 'Account Deletion Request',
                'sections' => [['heading' => 'Account Deletion Request', 'body' => 'RYLAY user accounts are provisioned by school administrators. You may submit an account deletion request by contacting RYLAY support or your school administration. Upon confirmation, your personal identity information (PII), authentication credentials, and non-essential community contributions will be permanently purged or anonymized. Required academic and financial history records are retained in anonymized form for legal audit compliance.']],
            ],
            'support' => [
                'title' => 'Support',
                'sections' => [['heading' => 'Contact Support', 'body' => 'Contact RYLAY support for account, privacy, or Community safety assistance. Do not use ordinary support channels as an emergency service.']],
            ],
        ];

        $fallback = $fallbacks[$slug] ?? $fallbacks['support'];

        return response()->json(['data' => [
            'slug' => $slug,
            'title' => $policy?->title ?? $fallback['title'],
            'version' => $policy?->version,
            'effective_at' => $policy?->effective_at?->toIso8601String(),
            'sections' => $policy?->sections ?? $fallback['sections'],
            'developer_name' => (string) config('community_safety.developer_name', 'RYLAY'),
            'organization_name' => $tenant?->branding?->organization_name ?? $tenant?->name ?? 'RYLAY Platform',
            'store_safety_disclosure' => 'RYLAY prohibits child sexual abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, sextortion, trafficking, and the sexualization of children.',
            'support' => [
                'email' => config('community_safety.support_email'),
                'child_safety_email' => config('community_safety.child_safety_contact_email'),
            ],
        ]]);
    }
}
