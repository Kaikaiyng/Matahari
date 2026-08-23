<?php

namespace Tests\Feature;

use App\Contracts\AuditLoggerContract;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class TenantIsolationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_domain_resolves_public_branding_surface_and_feature_flags(): void
    {
        [$tenant] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        TenantFeature::query()->create(['tenant_id' => $tenant->id, 'feature_key' => 'formal_quiz', 'enabled' => true, 'configuration' => ['secret' => 'not-public']]);

        $this->getJson('http://alpha.admin.example.test/api/tenant-context')
            ->assertOk()
            ->assertJsonPath('data.slug', 'alpha')
            ->assertJsonPath('data.surface', 'admin')
            ->assertJsonPath('data.branding.organization_name', 'Alpha Academy')
            ->assertJsonPath('data.features.formal_quiz', true)
            ->assertJsonMissingPath('data.features.configuration');
    }

    public function test_unknown_or_inactive_domains_fail_closed(): void
    {
        $this->getJson('http://unknown.example.test/api/tenant-context')->assertNotFound();
        [$tenant, $domain] = $this->tenantFixture('inactive', 'inactive.example.test', 'app');
        $tenant->update(['status' => 'suspended']);

        $this->getJson("http://{$domain->hostname}/api/tenant-context")->assertNotFound();
    }

    public function test_valid_credentials_cannot_login_through_another_tenant_domain(): void
    {
        [$alpha, $alphaDomain, $alphaSchool] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        [, $betaDomain] = $this->tenantFixture('beta', 'beta.admin.example.test', 'admin');
        $user = User::query()->create(['school_id' => $alphaSchool->id, 'name' => 'Alpha Admin', 'username' => 'alpha.admin', 'password' => Hash::make('password'), 'status' => 'active']);
        TenantUserMembership::query()->create(['tenant_id' => $alpha->id, 'user_id' => $user->id, 'default_school_id' => $alphaSchool->id, 'status' => 'active'])->schools()->attach($alphaSchool->id, ['tenant_id' => $alpha->id]);

        $this->postJson("http://{$betaDomain->hostname}/api/login", ['username' => 'alpha.admin', 'password' => 'password'])->assertUnprocessable();
        $this->assertGuest();

        $this->postJson("http://{$alphaDomain->hostname}/api/login", ['username' => 'alpha.admin', 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.tenant_id', $alpha->id)->assertJsonPath('user.tenant_slug', 'alpha');
    }

    public function test_permissions_are_taken_from_the_active_tenant_membership(): void
    {
        [$tenant, $domain, $school] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        $permission = Permission::query()->firstOrCreate(['slug' => 'students.view'], ['name' => 'View students']);
        $role = Role::query()->firstOrCreate(['slug' => 'school-admin'], ['name' => 'School Admin']);
        $role->permissions()->syncWithoutDetaching([$permission->id]);
        $user = User::query()->create(['school_id' => $school->id, 'name' => 'Admin', 'username' => 'admin', 'password' => 'password', 'status' => 'active']);
        $user->roles()->attach($role);
        $membership = TenantUserMembership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'default_school_id' => $school->id, 'status' => 'active']);
        $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);

        $this->actingAs($user)->getJson("http://{$domain->hostname}/api/students")->assertForbidden();

        $membership->roles()->attach($role);
        $this->actingAs($user)->getJson("http://{$domain->hostname}/api/students")->assertOk();
    }

    public function test_school_selection_is_limited_to_membership_schools_inside_the_tenant(): void
    {
        [$tenant, $domain, $firstSchool] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        $secondSchool = $this->school($tenant, 'A2');
        [$otherTenant, , $otherSchool] = $this->tenantFixture('beta', 'beta.admin.example.test', 'admin');
        $permission = Permission::query()->firstOrCreate(['slug' => 'academic_years.view'], ['name' => 'View years']);
        $role = Role::query()->firstOrCreate(['slug' => 'school-admin'], ['name' => 'School Admin']);
        $role->permissions()->syncWithoutDetaching([$permission->id]);
        $user = User::query()->create(['school_id' => $firstSchool->id, 'name' => 'Admin', 'username' => 'admin', 'password' => 'password', 'status' => 'active']);
        $membership = TenantUserMembership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'default_school_id' => $firstSchool->id, 'status' => 'active']);
        $membership->schools()->attach($firstSchool->id, ['tenant_id' => $tenant->id]);
        $membership->roles()->attach($role);

        $this->actingAs($user)->getJson("http://{$domain->hostname}/api/v1/admin/academic-years?school_id={$secondSchool->id}")->assertForbidden();
        $membership->schools()->attach($secondSchool->id, ['tenant_id' => $tenant->id]);
        $this->actingAs($user)->getJson("http://{$domain->hostname}/api/v1/admin/academic-years?school_id={$secondSchool->id}")->assertOk();
        $this->actingAs($user)->getJson("http://{$domain->hostname}/api/v1/admin/academic-years?school_id={$otherSchool->id}")->assertForbidden();
        $this->assertNotSame($tenant->id, $otherTenant->id);
    }

    public function test_platform_owner_can_create_a_tenant_and_explicitly_activate_its_domain(): void
    {
        [, $currentDomain, $currentSchool] = $this->tenantFixture('platform', 'platform.admin.example.test', 'admin');
        $owner = User::query()->create(['school_id' => $currentSchool->id, 'is_platform_owner' => true, 'name' => 'Platform Owner', 'username' => 'owner', 'password' => 'password', 'status' => 'active']);

        $created = $this->actingAs($owner)->postJson("http://{$currentDomain->hostname}/api/v1/platform/tenants", $this->newTenantPayload())
            ->assertCreated()
            ->assertJsonPath('data.slug', 'bravo')
            ->assertJsonPath('data.domains.0.status', 'pending');
        $tenantId = $created->json('data.id');
        $domainId = $created->json('data.domains.0.id');
        $this->assertDatabaseHas('audit_logs', ['action' => 'tenant.created', 'entity_id' => $tenantId]);
        $this->assertDatabaseHas('tenant_user_memberships', ['tenant_id' => $tenantId, 'access_all_schools' => false, 'status' => 'active']);

        $this->getJson('http://bravo.admin.example.test/api/tenant-context')->assertNotFound();
        $this->actingAs($owner)->postJson("http://{$currentDomain->hostname}/api/v1/platform/tenants/{$tenantId}/domains/{$domainId}/activate")
            ->assertOk()->assertJsonPath('data.status', 'active');
        $this->getJson('http://bravo.admin.example.test/api/tenant-context')->assertOk()->assertJsonPath('data.slug', 'bravo');

        $replacement = $this->actingAs($owner)->postJson("http://{$currentDomain->hostname}/api/v1/platform/tenants/{$tenantId}/domains", [
            'hostname' => 'new-bravo.admin.example.test', 'surface' => 'admin', 'is_primary' => true,
        ])->assertCreated();
        $this->assertDatabaseHas('tenant_domains', ['id' => $domainId, 'is_primary' => false]);
        $this->assertDatabaseHas('tenant_domains', ['id' => $replacement->json('data.id'), 'is_primary' => true, 'status' => 'pending']);

        $this->actingAs($owner)->patchJson("http://{$currentDomain->hostname}/api/v1/platform/tenants/{$tenantId}/status", ['status' => 'suspended'])
            ->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->assertDatabaseHas('audit_logs', ['action' => 'tenant.status_updated', 'entity_id' => $tenantId]);
        $this->getJson('http://bravo.admin.example.test/api/tenant-context')->assertNotFound();
    }

    public function test_non_platform_user_cannot_manage_tenants(): void
    {
        [$tenant, $domain, $school] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        $user = User::query()->create(['school_id' => $school->id, 'name' => 'Tenant Admin', 'username' => 'tenant.admin', 'password' => 'password', 'status' => 'active']);
        $membership = TenantUserMembership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'default_school_id' => $school->id, 'status' => 'active']);
        $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);

        $this->actingAs($user)->postJson("http://{$domain->hostname}/api/v1/platform/tenants", $this->newTenantPayload())->assertForbidden();
        $this->assertDatabaseMissing('tenants', ['slug' => 'bravo']);
    }

    public function test_tenant_creation_rolls_back_when_audit_persistence_fails(): void
    {
        [, $domain, $school] = $this->tenantFixture('platform', 'platform.admin.example.test', 'admin');
        $owner = User::query()->create(['school_id' => $school->id, 'is_platform_owner' => true, 'name' => 'Platform Owner', 'username' => 'owner', 'password' => 'password', 'status' => 'active']);
        $this->mock(AuditLoggerContract::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));

        $this->actingAs($owner)->postJson("http://{$domain->hostname}/api/v1/platform/tenants", $this->newTenantPayload())->assertServerError();
        $this->assertDatabaseMissing('tenants', ['slug' => 'bravo']);
        $this->assertDatabaseMissing('schools', ['code' => 'BRV']);
    }

    public function test_legacy_tenant_owner_cannot_manage_tenant_configuration(): void
    {
        [$tenant, $domain, $school] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        TenantFeature::query()->create(['tenant_id' => $tenant->id, 'feature_key' => 'community', 'enabled' => true]);
        $settings = Permission::query()->firstOrCreate(['slug' => 'tenant.settings.manage'], ['name' => 'Manage tenant settings']);
        $community = Permission::query()->firstOrCreate(['slug' => 'community.view'], ['name' => 'View community']);
        $role = Role::query()->firstOrCreate(['slug' => 'tenant-owner'], ['name' => 'Tenant Owner']);
        $role->permissions()->syncWithoutDetaching([$settings->id, $community->id]);
        $owner = User::query()->create(['school_id' => $school->id, 'name' => 'Tenant Owner', 'username' => 'alpha.owner', 'password' => 'password', 'status' => 'active']);
        $membership = TenantUserMembership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $owner->id, 'default_school_id' => $school->id, 'access_all_schools' => true, 'status' => 'active']);
        $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);
        $membership->roles()->attach($role);

        $this->actingAs($owner)->putJson("http://{$domain->hostname}/api/v1/tenant/features/community", ['enabled' => false])
            ->assertForbidden();
        $this->assertDatabaseHas('tenant_features', ['tenant_id' => $tenant->id, 'feature_key' => 'community', 'enabled' => true]);
    }

    public function test_existing_school_upgrade_preserves_identity_data_without_guessing_domains(): void
    {
        [, , $school] = $this->tenantFixture('legacy', 'legacy.admin.example.test', 'admin');
        $role = Role::query()->firstOrCreate(['slug' => 'finance'], ['name' => 'Finance']);
        $user = User::query()->create(['school_id' => $school->id, 'name' => 'Legacy User', 'username' => 'legacy.user', 'password' => 'password', 'status' => 'active']);
        $user->roles()->attach($role);
        $migration = require database_path('migrations/2026_08_14_000001_create_tenant_foundation.php');
        $hardening = require database_path('migrations/2026_08_15_000001_harden_tenant_foundation.php');
        $moderation = require database_path('migrations/2026_08_16_000002_create_community_moderation_foundation.php');

        $moderation->down();
        $hardening->down();
        $migration->down();
        $this->assertFalse(Schema::hasTable('tenants'));
        $this->assertDatabaseHas('schools', ['id' => $school->id, 'code' => 'LEGACY']);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'username' => 'legacy.user']);

        // SQLite rebuilds the referenced schools table during this in-transaction
        // test and applies users.school_id nullOnDelete. Restore the known legacy
        // relationship before exercising the additive upgrade backfill itself.
        User::query()->whereKey($user->id)->update(['school_id' => $school->id]);
        $migration->up();
        $tenantId = School::query()->whereKey($school->id)->value('tenant_id');
        $this->assertNotNull($tenantId);
        $this->assertDatabaseHas('tenant_user_memberships', ['tenant_id' => $tenantId, 'user_id' => $user->id, 'default_school_id' => $school->id]);
        $this->assertDatabaseHas('tenant_membership_roles', ['role_id' => $role->id]);
        $this->assertDatabaseMissing('tenant_domains', ['tenant_id' => $tenantId]);
        $this->assertDatabaseHas('tenant_features', ['tenant_id' => $tenantId, 'feature_key' => 'community', 'enabled' => true]);
    }

    public function test_school_codes_are_unique_inside_a_tenant_but_reusable_by_another_tenant(): void
    {
        [$firstTenant] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        [$secondTenant] = $this->tenantFixture('beta', 'beta.admin.example.test', 'admin');
        $this->school($secondTenant, 'ALPHA');
        $this->assertDatabaseHas('schools', ['tenant_id' => $secondTenant->id, 'code' => 'ALPHA']);

        $this->expectException(QueryException::class);
        $this->school($firstTenant, 'ALPHA');
    }

    public function test_backend_enforces_admin_and_app_surfaces_while_session_routes_are_shared(): void
    {
        [$tenant, $adminDomain, $school] = $this->tenantFixture('alpha', 'alpha.admin.example.test', 'admin');
        $appDomain = TenantDomain::query()->create([
            'tenant_id' => $tenant->id,
            'hostname' => 'alpha.app.example.test',
            'surface' => 'app',
            'status' => 'active',
            'verified_at' => now(),
        ]);
        TenantFeature::query()->create(['tenant_id' => $tenant->id, 'feature_key' => 'community', 'enabled' => true]);
        $role = Role::query()->firstOrCreate(['slug' => 'staff'], ['name' => 'Staff']);
        foreach (['students.view', 'community.view'] as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }
        $user = User::query()->create([
            'school_id' => $school->id,
            'name' => 'Surface User',
            'username' => 'surface.user',
            'password' => 'password',
            'status' => 'active',
        ]);
        $membership = TenantUserMembership::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'default_school_id' => $school->id,
            'status' => 'active',
        ]);
        $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);
        $membership->roles()->attach($role);

        $this->actingAs($user)->getJson("http://{$adminDomain->hostname}/api/students")->assertOk();
        $this->actingAs($user)->getJson("http://{$appDomain->hostname}/api/students")->assertNotFound();
        $this->actingAs($user)->getJson("http://{$appDomain->hostname}/api/v1/community/posts")->assertOk();
        $this->actingAs($user)->getJson("http://{$adminDomain->hostname}/api/v1/community/posts")->assertNotFound();

        $this->actingAs($user)->getJson("http://{$adminDomain->hostname}/api/me")->assertOk();
        $this->actingAs($user)->getJson("http://{$appDomain->hostname}/api/me")->assertOk();
        $this->getJson("http://{$adminDomain->hostname}/api/tenant-context")->assertOk()->assertJsonPath('data.surface', 'admin');
        $this->getJson("http://{$appDomain->hostname}/api/tenant-context")->assertOk()->assertJsonPath('data.surface', 'app');
    }

    private function tenantFixture(string $slug, string $hostname, string $surface): array
    {
        $tenant = Tenant::query()->create(['slug' => $slug, 'name' => ucfirst($slug).' Academy', 'status' => 'active']);
        TenantBranding::query()->create(['tenant_id' => $tenant->id, 'organization_name' => ucfirst($slug).' Academy', 'organization_short_name' => strtoupper($slug), 'admin_title' => 'Administration', 'app_title' => 'Community']);
        $domain = TenantDomain::query()->create(['tenant_id' => $tenant->id, 'hostname' => $hostname, 'surface' => $surface, 'status' => 'active', 'verified_at' => now()]);

        return [$tenant, $domain, $this->school($tenant, strtoupper($slug))];
    }

    private function school(Tenant $tenant, string $code): School
    {
        return School::query()->create(['tenant_id' => $tenant->id, 'code' => $code, 'name' => $code.' School', 'receipt_prefix' => $code, 'invoice_prefix' => $code]);
    }

    private function newTenantPayload(): array
    {
        return [
            'slug' => 'bravo', 'name' => 'Bravo Education', 'timezone' => 'Asia/Kuala_Lumpur', 'locale' => 'en',
            'branding' => ['organization_name' => 'Bravo Academy', 'organization_short_name' => 'BRV', 'admin_title' => 'Operations', 'app_title' => 'Bravo Community', 'logo_url' => null, 'primary_color' => '#123456', 'accent_color' => '#654321'],
            'school' => ['code' => 'BRV', 'name' => 'Bravo Campus', 'receipt_prefix' => 'BRV', 'invoice_prefix' => 'BRV-INV'],
            'owner' => ['name' => 'Bravo Owner', 'username' => 'bravo.owner', 'password' => 'temporary-password'],
            'domains' => [['hostname' => 'bravo.admin.example.test', 'surface' => 'admin', 'is_primary' => true]],
            'features' => ['community' => true, 'formal_quiz' => false],
        ];
    }
}
