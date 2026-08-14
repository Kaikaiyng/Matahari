<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use App\Services\Tenancy\TenantAdministrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformTenantController extends Controller
{
    public function index(): JsonResponse
    {
        $tenants = Tenant::query()->with(['branding', 'domains', 'features', 'schools'])->orderBy('name')->get();

        return response()->json(['data' => $tenants->map(fn (Tenant $tenant) => $this->response($tenant))]);
    }

    public function store(Request $request, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:tenants,slug'],
            'name' => ['required', 'string', 'max:255'], 'timezone' => ['nullable', 'timezone'], 'locale' => ['nullable', 'string', 'max:10'],
            'branding' => ['required', 'array'], 'branding.organization_name' => ['required', 'string', 'max:255'],
            'branding.organization_short_name' => ['required', 'string', 'max:30'], 'branding.admin_title' => ['required', 'string', 'max:255'],
            'branding.app_title' => ['required', 'string', 'max:255'], 'branding.logo_url' => ['nullable', 'url:https', 'max:2048'],
            'branding.primary_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'], 'branding.accent_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'school' => ['required', 'array'], 'school.code' => ['required', 'string', 'max:20'],
            'school.name' => ['required', 'string', 'max:255'], 'school.receipt_prefix' => ['required', 'string', 'max:20'],
            'school.invoice_prefix' => ['nullable', 'string', 'max:20'], 'school.email' => ['nullable', 'email', 'max:255'],
            'school.phone' => ['nullable', 'string', 'max:50'], 'school.address' => ['nullable', 'string'],
            'owner' => ['required', 'array'], 'owner.name' => ['required', 'string', 'max:255'],
            'owner.username' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9._-]+$/', 'unique:users,username'],
            'owner.password' => ['required', 'string', 'min:12', 'max:255'],
            'domains' => ['sometimes', 'array', 'max:10'], 'domains.*.hostname' => ['required', 'string', 'max:253', 'regex:/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', 'distinct', 'unique:tenant_domains,hostname'],
            'domains.*.surface' => ['required', Rule::in(['admin', 'app', 'api'])], 'domains.*.is_primary' => ['sometimes', 'boolean'],
            'features' => ['sometimes', 'array'], 'features.*' => ['boolean'],
        ]);

        return response()->json(['data' => $this->response($service->create($data, $contexts->fromRequest($request)))], 201);
    }

    public function updateBranding(Request $request, Tenant $tenant, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'organization_name' => ['sometimes', 'required', 'string', 'max:255'], 'organization_short_name' => ['sometimes', 'required', 'string', 'max:30'],
            'admin_title' => ['sometimes', 'required', 'string', 'max:255'], 'app_title' => ['sometimes', 'required', 'string', 'max:255'],
            'logo_url' => ['sometimes', 'nullable', 'url:https', 'max:2048'], 'primary_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        return response()->json(['data' => $service->updateBranding($tenant, $data, $contexts->fromRequest($request))]);
    }

    public function updateStatus(Request $request, Tenant $tenant, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['active', 'suspended'])]]);

        return response()->json(['data' => $service->updateStatus($tenant, $data['status'], $contexts->fromRequest($request))]);
    }

    public function storeDomain(Request $request, Tenant $tenant, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'hostname' => ['required', 'string', 'max:253', 'regex:/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', 'unique:tenant_domains,hostname'],
            'surface' => ['required', Rule::in(['admin', 'app', 'api'])], 'is_primary' => ['sometimes', 'boolean'],
        ]);

        return response()->json(['data' => $service->createDomain($tenant, $data, $contexts->fromRequest($request))], 201);
    }

    public function activateDomain(Request $request, Tenant $tenant, TenantDomain $tenantDomain, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        return response()->json(['data' => $service->activateDomain($tenant, $tenantDomain, $contexts->fromRequest($request))]);
    }

    public function updateFeature(Request $request, Tenant $tenant, string $featureKey, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        return response()->json(['data' => $service->updateFeature($tenant, $featureKey, $data['enabled'], $contexts->fromRequest($request))]);
    }

    public function storeSchool(Request $request, Tenant $tenant, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', Rule::unique('schools', 'code')->where('tenant_id', $tenant->id)], 'name' => ['required', 'string', 'max:255'],
            'receipt_prefix' => ['required', 'string', 'max:20'], 'invoice_prefix' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'], 'phone' => ['nullable', 'string', 'max:50'], 'address' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $service->createSchool($tenant, $data, $contexts->fromRequest($request))], 201);
    }

    public function updateMembership(Request $request, Tenant $tenant, User $user, TenantAdministrationService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'default_school_id' => ['required', 'integer'], 'school_ids' => ['required', 'array', 'min:1'], 'school_ids.*' => ['required', 'integer', 'distinct'],
            'access_all_schools' => ['sometimes', 'boolean'], 'status' => ['required', Rule::in(['active', 'suspended'])],
            'roles' => ['required', 'array', 'min:1'], 'roles.*' => ['required', 'string', 'distinct', Rule::notIn(['super-admin'])],
        ]);

        return response()->json(['data' => $service->updateMembership($tenant, $user, $data, $contexts->fromRequest($request))]);
    }

    private function response(Tenant $tenant): array
    {
        return [
            'id' => $tenant->id, 'slug' => $tenant->slug, 'name' => $tenant->name, 'status' => $tenant->status,
            'timezone' => $tenant->timezone, 'locale' => $tenant->locale, 'branding' => $tenant->branding,
            'domains' => $tenant->domains, 'features' => $tenant->features, 'schools' => $tenant->schools,
        ];
    }
}
