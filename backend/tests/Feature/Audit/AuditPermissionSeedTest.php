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
}
