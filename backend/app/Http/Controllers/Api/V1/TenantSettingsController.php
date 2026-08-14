<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Tenancy\TenantAdministrationService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TenantSettingsController extends Controller
{
    public function updateBranding(Request $request, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'organization_name' => ['sometimes', 'required', 'string', 'max:255'], 'organization_short_name' => ['sometimes', 'required', 'string', 'max:30'],
            'admin_title' => ['sometimes', 'required', 'string', 'max:255'], 'app_title' => ['sometimes', 'required', 'string', 'max:255'],
            'logo_url' => ['sometimes', 'nullable', 'url:https', 'max:2048'], 'primary_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        $tenant = TenantContext::fromRequest($request)->tenant;

        return response()->json(['data' => $service->updateBranding($tenant, $data, $contexts->fromRequest($request))]);
    }

    public function storeDomain(Request $request, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'hostname' => ['required', 'string', 'max:253', 'regex:/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', 'unique:tenant_domains,hostname'],
            'surface' => ['required', Rule::in(['admin', 'app', 'api'])], 'is_primary' => ['sometimes', 'boolean'],
        ]);
        $tenant = TenantContext::fromRequest($request)->tenant;

        return response()->json(['data' => $service->createDomain($tenant, $data, $contexts->fromRequest($request))], 201);
    }

    public function updateFeature(Request $request, string $featureKey, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $tenant = TenantContext::fromRequest($request)->tenant;

        return response()->json(['data' => $service->updateFeature($tenant, $featureKey, $data['enabled'], $contexts->fromRequest($request))]);
    }

    public function storeSchool(Request $request, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $tenant = TenantContext::fromRequest($request)->tenant;
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('schools', 'code')->where('tenant_id', $tenant->id)], 'name' => ['required', 'string', 'max:255'],
            'receipt_prefix' => ['required', 'string', 'max:20'], 'invoice_prefix' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'], 'phone' => ['nullable', 'string', 'max:50'], 'address' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $service->createSchool($tenant, $data, $contexts->fromRequest($request))], 201);
    }

    public function updateMembership(Request $request, User $user, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'default_school_id' => ['required', 'integer'], 'school_ids' => ['required', 'array', 'min:1'], 'school_ids.*' => ['required', 'integer', 'distinct'],
            'access_all_schools' => ['sometimes', 'boolean'], 'status' => ['required', Rule::in(['active', 'suspended'])],
            'roles' => ['required', 'array', 'min:1'], 'roles.*' => ['required', 'string', 'distinct', Rule::notIn(['super-admin'])],
        ]);
        $tenant = TenantContext::fromRequest($request)->tenant;

        return response()->json(['data' => $service->updateMembership($tenant, $user, $data, $contexts->fromRequest($request))]);
    }
}
