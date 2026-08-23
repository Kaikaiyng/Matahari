<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => 'localhost']);
    }

    public function test_admin_can_update_another_employee_with_reason_and_audit(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $permissions = $this->actingAs($admin)->getJson("http://localhost/api/v1/admin/staff/{$teacher->id}/access")
            ->assertOk()->json('data.permissions');
        $permissions[] = 'attendance.manage_school';

        $this->actingAs($admin)->putJson("http://localhost/api/v1/admin/staff/{$teacher->id}/access", [
            'position' => 'teacher', 'permissions' => $permissions,
            'teacher_app_access' => true, 'reason' => 'Principal duty allocation.',
        ])->assertOk()
            ->assertJsonPath('data.teacher_app_access', true)
            ->assertJsonPath('data.permissions', fn (array $items): bool => in_array('attendance.view_school', $items, true) && in_array('attendance.manage_school', $items, true));

        $this->assertDatabaseHas('audit_logs', ['action' => 'employee.abilities_updated', 'reason' => 'Principal duty allocation.']);
    }

    public function test_reason_self_platform_and_cross_school_boundaries_are_enforced(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $payload = ['position' => 'teacher', 'permissions' => [], 'teacher_app_access' => false, 'reason' => ''];
        $this->actingAs($admin)->putJson("http://localhost/api/v1/admin/staff/{$teacher->id}/access", $payload)->assertUnprocessable();
        $payload['reason'] = 'Attempted self edit.';
        $this->actingAs($admin)->putJson("http://localhost/api/v1/admin/staff/{$admin->id}/access", $payload)->assertForbidden();
        $owner = User::query()->where('username', 'superadmin')->firstOrFail();
        $this->actingAs($admin)->getJson("http://localhost/api/v1/admin/staff/{$owner->id}/access")->assertForbidden();
    }

    public function test_finance_inherits_every_school_admin_permission(): void
    {
        $admin = Role::query()->where('slug', 'school-admin')->firstOrFail()->permissions()->pluck('slug');
        $finance = Role::query()->where('slug', 'finance')->firstOrFail()->permissions()->pluck('slug');
        $this->assertEmpty($admin->diff($finance));
        $this->assertTrue($finance->contains('payments.verify'));
        $this->assertTrue($finance->contains('receipts.void'));
    }
}
