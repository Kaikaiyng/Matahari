<?php

namespace Tests\Feature\Audit;

use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditPermissionSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_admin_receives_audit_permissions(): void
    {
        $this->seed();

        foreach (['super-admin', 'school-admin', 'finance'] as $roleSlug) {
            $permissions = Role::query()
                ->where('slug', $roleSlug)
                ->firstOrFail()
                ->permissions()
                ->pluck('slug')
                ->all();

            if ($roleSlug === 'super-admin') {
                $this->assertContains('audit.view', $permissions);
                $this->assertContains('audit.correct_generic', $permissions);
                $this->assertContains('logs.view', $permissions);
            } else {
                $this->assertNotContains('audit.view', $permissions);
                $this->assertNotContains('audit.correct_generic', $permissions);
                $this->assertNotContains('logs.view', $permissions);
            }
        }
    }

    public function test_community_interact_compatibility_remains_seeded_until_routes_retire(): void
    {
        $this->seed();

        $this->assertDatabaseHas('permissions', ['slug' => 'community.interact']);

        foreach (['school-admin', 'finance', 'teacher', 'parent', 'student'] as $roleSlug) {
            $permissions = Role::query()
                ->where('slug', $roleSlug)
                ->firstOrFail()
                ->permissions()
                ->pluck('slug');

            $this->assertTrue($permissions->contains('community.view'));
            $this->assertTrue($permissions->contains('community.interact'));
        }
    }
}
