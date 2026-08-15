<?php

namespace App\Services\Tenancy;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\Role;
use App\Models\School;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TenantAdministrationService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function create(array $data, AuditContext $context): Tenant
    {
        $primarySurfaces = collect($data['domains'] ?? [])
            ->filter(fn (array $domain): bool => (bool) ($domain['is_primary'] ?? false))
            ->pluck('surface');
        if ($primarySurfaces->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages(['domains' => 'Only one primary domain is allowed per surface.']);
        }

        return DB::transaction(function () use ($data, $context): Tenant {
            $tenant = Tenant::query()->create([
                'slug' => $data['slug'], 'name' => $data['name'], 'status' => 'active',
                'timezone' => $data['timezone'] ?? 'Asia/Kuala_Lumpur', 'locale' => $data['locale'] ?? 'en',
            ]);
            $tenant->branding()->create($data['branding']);
            $school = $tenant->schools()->create([...$data['school'], 'status' => 'active']);
            $owner = User::query()->create([
                'school_id' => $school->id, 'name' => $data['owner']['name'], 'username' => $data['owner']['username'],
                'password' => Hash::make($data['owner']['password']), 'status' => 'active',
            ]);
            $tenantOwnerRole = Role::query()->where('slug', 'tenant-owner')->firstOrFail();
            $owner->roles()->attach($tenantOwnerRole);
            $membership = TenantUserMembership::query()->create([
                'tenant_id' => $tenant->id, 'user_id' => $owner->id, 'default_school_id' => $school->id,
                'access_all_schools' => true, 'status' => 'active',
            ]);
            $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);
            $membership->roles()->attach($tenantOwnerRole);
            foreach ($data['domains'] ?? [] as $domain) {
                $tenant->domains()->create([...$domain, 'hostname' => strtolower($domain['hostname']), 'status' => 'pending']);
            }
            foreach ($data['features'] ?? [] as $key => $enabled) {
                $tenant->features()->create(['feature_key' => $key, 'enabled' => $enabled]);
            }
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantCreated, module: AuditModule::Tenancy, subjectType: AuditSubject::Tenant,
                subjectId: $tenant->id, newValues: ['slug' => $tenant->slug, 'name' => $tenant->name, 'school_id' => $school->id, 'owner_user_id' => $owner->id],
                metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $tenant->load(['branding', 'domains', 'features', 'schools']);
        });
    }

    public function updateBranding(Tenant $tenant, array $data, AuditContext $context): TenantBranding
    {
        return DB::transaction(function () use ($tenant, $data, $context): TenantBranding {
            $branding = $tenant->branding()->lockForUpdate()->firstOrFail();
            $before = $branding->only(array_keys($data));
            $branding->update($data);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantBrandingUpdated, module: AuditModule::Tenancy, subjectType: AuditSubject::Tenant,
                subjectId: $tenant->id, oldValues: $before, newValues: $branding->only(array_keys($data)), metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $branding;
        });
    }

    public function createDomain(Tenant $tenant, array $data, AuditContext $context): TenantDomain
    {
        return DB::transaction(function () use ($tenant, $data, $context): TenantDomain {
            if ($data['is_primary'] ?? false) {
                TenantDomain::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('surface', $data['surface'])
                    ->where('is_primary', true)
                    ->lockForUpdate()
                    ->update(['is_primary' => false]);
            }
            $domain = $tenant->domains()->create([...$data, 'hostname' => strtolower($data['hostname']), 'status' => 'pending', 'verified_at' => null]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantDomainCreated, module: AuditModule::Tenancy, subjectType: AuditSubject::TenantDomain,
                subjectId: $domain->id, newValues: ['hostname' => $domain->hostname, 'surface' => $domain->surface, 'status' => $domain->status], metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $domain;
        });
    }

    public function updateStatus(Tenant $tenant, string $status, AuditContext $context): Tenant
    {
        return DB::transaction(function () use ($tenant, $status, $context): Tenant {
            $locked = Tenant::query()->whereKey($tenant->id)->lockForUpdate()->firstOrFail();
            $before = $locked->status;
            $locked->update(['status' => $status]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantStatusUpdated, module: AuditModule::Tenancy, subjectType: AuditSubject::Tenant,
                subjectId: $locked->id, oldValues: ['status' => $before], newValues: ['status' => $status], metadata: ['tenant_id' => $locked->id],
            ), $context);

            return $locked;
        });
    }

    public function activateDomain(Tenant $tenant, TenantDomain $domain, AuditContext $context): TenantDomain
    {
        abort_unless((int) $domain->tenant_id === (int) $tenant->id, 403, 'Domain belongs to another tenant.');

        return DB::transaction(function () use ($tenant, $domain, $context): TenantDomain {
            $locked = TenantDomain::query()->whereKey($domain->id)->lockForUpdate()->firstOrFail();
            $locked->update(['status' => 'active', 'verified_at' => now()]);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantDomainActivated, module: AuditModule::Tenancy, subjectType: AuditSubject::TenantDomain,
                subjectId: $locked->id, newValues: ['status' => 'active', 'verified_at' => $locked->verified_at?->toISOString()], metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $locked;
        });
    }

    public function updateFeature(Tenant $tenant, string $key, bool $enabled, AuditContext $context): TenantFeature
    {
        if (! preg_match('/^[a-z0-9_]{1,100}$/', $key)) {
            throw ValidationException::withMessages(['feature_key' => 'The feature key format is invalid.']);
        }

        return DB::transaction(function () use ($tenant, $key, $enabled, $context): TenantFeature {
            $feature = TenantFeature::query()->where('tenant_id', $tenant->id)->where('feature_key', $key)->lockForUpdate()->first();
            $before = $feature?->enabled;
            $feature ??= new TenantFeature(['tenant_id' => $tenant->id, 'feature_key' => $key]);
            $feature->enabled = $enabled;
            $feature->save();
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantFeatureUpdated, module: AuditModule::Tenancy, subjectType: AuditSubject::Tenant,
                subjectId: $tenant->id, oldValues: ['feature_key' => $key, 'enabled' => $before], newValues: ['feature_key' => $key, 'enabled' => $enabled], metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $feature;
        });
    }

    public function createSchool(Tenant $tenant, array $data, AuditContext $context): School
    {
        return DB::transaction(function () use ($tenant, $data, $context): School {
            $school = $tenant->schools()->create([...$data, 'status' => 'active']);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantSchoolCreated, module: AuditModule::Tenancy, subjectType: AuditSubject::Tenant,
                subjectId: $tenant->id, newValues: ['school_id' => $school->id, 'code' => $school->code, 'name' => $school->name], metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $school;
        });
    }

    public function updateMembership(Tenant $tenant, User $user, array $data, AuditContext $context): TenantUserMembership
    {
        return DB::transaction(function () use ($tenant, $user, $data, $context): TenantUserMembership {
            $schoolIds = array_map('intval', $data['school_ids']);
            $foundSchoolIds = School::query()->where('tenant_id', $tenant->id)->whereIn('id', $schoolIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
            abort_unless(count($foundSchoolIds) === count(array_unique($schoolIds)), 403, 'One or more schools belong to another tenant.');
            abort_unless(in_array((int) $data['default_school_id'], $foundSchoolIds, true), 422, 'Default school must be included in the membership schools.');
            $roles = Role::query()->whereIn('slug', $data['roles'])->where('slug', '!=', 'super-admin')->get();
            abort_unless($roles->count() === count(array_unique($data['roles'])), 422, 'One or more tenant roles are invalid.');

            $membership = TenantUserMembership::query()->where('tenant_id', $tenant->id)->where('user_id', $user->id)->lockForUpdate()->first();
            $before = $membership ? ['status' => $membership->status, 'school_ids' => $membership->schools()->pluck('schools.id')->all(), 'roles' => $membership->roles()->pluck('slug')->all()] : [];
            $membership ??= new TenantUserMembership(['tenant_id' => $tenant->id, 'user_id' => $user->id]);
            $membership->fill(['default_school_id' => $data['default_school_id'], 'access_all_schools' => $data['access_all_schools'] ?? false, 'status' => $data['status']]);
            $membership->save();
            $membership->schools()->syncWithPivotValues($foundSchoolIds, ['tenant_id' => $tenant->id]);
            $membership->roles()->sync($roles->pluck('id')->all());
            if ($user->school_id === null) {
                $user->update(['school_id' => $data['default_school_id']]);
            }
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::TenantMembershipUpdated, module: AuditModule::Tenancy, subjectType: AuditSubject::User,
                subjectId: $user->id, oldValues: $before,
                newValues: ['status' => $membership->status, 'default_school_id' => $membership->default_school_id, 'school_ids' => $foundSchoolIds, 'roles' => $roles->pluck('slug')->sort()->values()->all()],
                metadata: ['tenant_id' => $tenant->id],
            ), $context);

            return $membership->load(['schools', 'roles']);
        });
    }
}
