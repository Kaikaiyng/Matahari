<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Models\TenantDomain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DedicatedTenantEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'tenancy.mode' => 'dedicated',
            'tenancy.dedicated_tenant_slug' => 'mis',
            'tenancy.default_tenant_slug' => 'mis',
        ]);
    }

    public function test_only_the_configured_tenant_domains_resolve_and_accept_login_requests(): void
    {
        [$matahari, $adminDomain, $school] = $this->tenantFixture('mis', 'admin.matahari.example.test', 'admin');
        $appDomain = TenantDomain::query()->create([
            'tenant_id' => $matahari->id,
            'hostname' => 'app.matahari.example.test',
            'surface' => 'app',
            'status' => 'active',
            'verified_at' => now(),
        ]);
        [, $otherDomain] = $this->tenantFixture('other', 'other.example.test', 'admin');
        User::query()->create([
            'school_id' => $school->id,
            'name' => 'Matahari User',
            'username' => 'matahari.user',
            'password' => 'password',
            'status' => 'active',
        ]);

        $this->getJson("http://{$adminDomain->hostname}/api/tenant-context")
            ->assertOk()
            ->assertJsonPath('data.slug', 'mis')
            ->assertJsonPath('data.surface', 'admin');
        $this->getJson("http://{$appDomain->hostname}/api/tenant-context")
            ->assertOk()
            ->assertJsonPath('data.slug', 'mis')
            ->assertJsonPath('data.surface', 'app');

        $this->getJson("http://{$otherDomain->hostname}/api/tenant-context")->assertNotFound();
        $this->getJson("http://{$otherDomain->hostname}/api/csrf-cookie")->assertNotFound();
        $this->postJson("http://{$otherDomain->hostname}/api/login", [
            'username' => 'matahari.user',
            'password' => 'password',
        ])->assertNotFound();
        $this->assertGuest();
    }

    public function test_dedicated_mode_hides_platform_routes_without_mutating_tenants(): void
    {
        [$tenant, $domain, $school] = $this->tenantFixture('mis', 'admin.matahari.example.test', 'admin');
        $owner = User::query()->create([
            'school_id' => $school->id,
            'is_platform_owner' => true,
            'name' => 'Matahari Owner',
            'username' => 'matahari.owner',
            'password' => 'password',
            'status' => 'active',
        ]);

        $this->actingAs($owner)
            ->getJson("http://{$domain->hostname}/api/v1/platform/tenants")
            ->assertNotFound();
        $this->actingAs($owner)
            ->postJson("http://{$domain->hostname}/api/v1/platform/tenants", $this->newTenantPayload())
            ->assertNotFound();
        $this->actingAs($owner)
            ->patchJson("http://{$domain->hostname}/api/v1/platform/tenants/{$tenant->id}/status", ['status' => 'suspended'])
            ->assertNotFound();

        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseHas('tenants', ['id' => $tenant->id, 'status' => 'active']);
        $this->assertDatabaseMissing('tenants', ['slug' => 'second-school']);
    }

    public function test_tenant_branding_management_remains_available_for_matahari(): void
    {
        [$tenant, $domain, $school] = $this->tenantFixture('mis', 'admin.matahari.example.test', 'admin');
        $owner = User::query()->create([
            'school_id' => $school->id,
            'is_platform_owner' => true,
            'name' => 'Matahari Owner',
            'username' => 'matahari.owner',
            'password' => 'password',
            'status' => 'active',
        ]);

        $this->actingAs($owner)
            ->patchJson("http://{$domain->hostname}/api/v1/tenant/branding", [
                'organization_name' => 'Matahari International School',
            ])
            ->assertOk()
            ->assertJsonPath('data.organization_name', 'Matahari International School');

        $this->assertDatabaseHas('tenant_brandings', [
            'tenant_id' => $tenant->id,
            'organization_name' => 'Matahari International School',
        ]);
    }

    public function test_missing_or_invalid_tenancy_configuration_fails_closed(): void
    {
        [, $domain] = $this->tenantFixture('mis', 'admin.matahari.example.test', 'admin');

        config(['tenancy.mode' => null]);
        $this->getJson("http://{$domain->hostname}/api/tenant-context")->assertStatus(503);

        config(['tenancy.mode' => 'shared']);
        $this->getJson("http://{$domain->hostname}/api/tenant-context")->assertStatus(503);

        config(['tenancy.mode' => 'dedicated', 'tenancy.dedicated_tenant_slug' => null]);
        $this->getJson("http://{$domain->hostname}/api/tenant-context")->assertStatus(503);
    }

    public function test_production_never_uses_the_localhost_tenant_fallback(): void
    {
        $this->tenantFixture('mis', 'admin.matahari.example.test', 'admin');
        $this->app['env'] = 'production';

        $this->getJson('http://localhost/api/tenant-context')->assertNotFound();
    }

    /** @return array{Tenant, TenantDomain, School} */
    private function tenantFixture(string $slug, string $hostname, string $surface): array
    {
        $tenant = Tenant::query()->create([
            'slug' => $slug,
            'name' => $slug === 'mis' ? 'Matahari International School' : ucfirst($slug).' School',
            'status' => 'active',
        ]);
        TenantBranding::query()->create([
            'tenant_id' => $tenant->id,
            'organization_name' => $tenant->name,
            'organization_short_name' => strtoupper($slug),
            'admin_title' => 'Administration',
            'app_title' => 'School App',
        ]);
        $domain = TenantDomain::query()->create([
            'tenant_id' => $tenant->id,
            'hostname' => $hostname,
            'surface' => $surface,
            'status' => 'active',
            'verified_at' => now(),
        ]);
        $school = School::query()->create([
            'tenant_id' => $tenant->id,
            'code' => strtoupper($slug),
            'name' => $tenant->name,
            'receipt_prefix' => strtoupper($slug),
            'invoice_prefix' => strtoupper($slug),
        ]);

        return [$tenant, $domain, $school];
    }

    /** @return array<string, mixed> */
    private function newTenantPayload(): array
    {
        return [
            'slug' => 'second-school',
            'name' => 'Second School',
            'timezone' => 'Asia/Kuala_Lumpur',
            'locale' => 'en',
            'branding' => [
                'organization_name' => 'Second School',
                'organization_short_name' => 'SECOND',
                'admin_title' => 'Administration',
                'app_title' => 'School App',
                'logo_url' => null,
                'primary_color' => '#123456',
                'accent_color' => '#654321',
            ],
            'school' => [
                'code' => 'SECOND',
                'name' => 'Second School',
                'receipt_prefix' => 'SECOND',
                'invoice_prefix' => 'SECOND',
            ],
            'owner' => [
                'name' => 'Second Owner',
                'username' => 'second.owner',
                'password' => 'temporary-password',
            ],
            'domains' => [[
                'hostname' => 'second.example.test',
                'surface' => 'admin',
                'is_primary' => true,
            ]],
            'features' => ['community' => true],
        ];
    }
}
