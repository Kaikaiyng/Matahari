<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAbilityAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => 'localhost']);
    }

    public function test_school_override_can_deny_a_default_and_grant_an_additional_permission(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $actor = User::query()->where('username', 'admin')->firstOrFail();
        foreach (['community.view' => false, 'attendance.view_school' => true] as $slug => $allowed) {
            UserPermissionOverride::query()->create([
                'school_id' => $teacher->school_id, 'user_id' => $teacher->id,
                'permission_id' => Permission::query()->where('slug', $slug)->value('id'),
                'allowed' => $allowed, 'reason' => 'Test override.', 'updated_by' => $actor->id,
            ]);
        }

        $this->assertFalse($teacher->hasPermissionTo('community.view'));
        $this->assertTrue($teacher->hasPermissionTo('attendance.view_school'));
    }

    public function test_cross_school_override_is_ignored_and_platform_owner_always_passes(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $owner = User::query()->where('username', 'superadmin')->firstOrFail();
        $other = $this->createTenantSchool(['code' => 'OTH', 'name' => 'Other', 'receipt_prefix' => 'OTH', 'invoice_prefix' => 'OTH', 'status' => 'active']);
        UserPermissionOverride::query()->create([
            'school_id' => $other->id, 'user_id' => $teacher->id,
            'permission_id' => Permission::query()->where('slug', 'attendance.view_school')->value('id'),
            'allowed' => true, 'reason' => 'Wrong school.', 'updated_by' => $owner->id,
        ]);

        $this->assertFalse($teacher->hasPermissionTo('attendance.view_school'));
        $this->assertTrue($owner->hasPermissionTo('permission.that.does.not.exist'));
    }
}
