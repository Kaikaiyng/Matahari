<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\User;
use App\Models\UserAttendanceAbility;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceAbilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => 'localhost']);
    }

    public function test_active_school_scoped_ability_adds_only_the_named_permission(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $permission = Permission::query()->where('slug', 'attendance.view_school')->firstOrFail();

        $this->assertFalse($teacher->hasPermissionTo('attendance.view_school'));

        UserAttendanceAbility::query()->create([
            'school_id' => $teacher->school_id,
            'user_id' => $teacher->id,
            'permission_id' => $permission->id,
            'effective_from' => now()->subMinute(),
            'expires_at' => now()->addWeek(),
            'granted_by' => User::query()->where('username', 'admin')->firstOrFail()->id,
            'reason' => 'Temporary whole-school duty.',
        ]);

        $this->assertTrue($teacher->fresh()->hasPermissionTo('attendance.view_school'));
        $this->assertFalse($teacher->fresh()->hasPermissionTo('attendance.manage_school'));
    }

    public function test_future_expired_and_revoked_abilities_do_not_grant_access(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $permission = Permission::query()->where('slug', 'attendance.view_school')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        foreach ([
            ['effective_from' => now()->addDay(), 'expires_at' => now()->addWeek(), 'revoked_at' => null],
            ['effective_from' => now()->subWeek(), 'expires_at' => now()->subDay(), 'revoked_at' => null],
            ['effective_from' => now()->subWeek(), 'expires_at' => now()->addWeek(), 'revoked_at' => now()],
        ] as $window) {
            UserAttendanceAbility::query()->create([
                'school_id' => $teacher->school_id,
                'user_id' => $teacher->id,
                'permission_id' => $permission->id,
                'granted_by' => $admin->id,
                'revoked_by' => $window['revoked_at'] ? $admin->id : null,
                'reason' => 'Window boundary test.',
                ...$window,
            ]);
        }

        $this->assertFalse($teacher->fresh()->hasPermissionTo('attendance.view_school'));
    }

    public function test_ability_from_another_school_does_not_grant_access(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $permission = Permission::query()->where('slug', 'attendance.view_school')->firstOrFail();
        $otherSchool = $this->createTenantSchool([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH',
            'status' => 'active',
        ]);

        UserAttendanceAbility::query()->create([
            'school_id' => $otherSchool->id,
            'user_id' => $teacher->id,
            'permission_id' => $permission->id,
            'effective_from' => now()->subMinute(),
            'expires_at' => null,
            'granted_by' => User::query()->where('username', 'admin')->firstOrFail()->id,
            'reason' => 'Cross-school test.',
        ]);

        $this->assertFalse($teacher->fresh()->hasPermissionTo('attendance.view_school'));
    }

    public function test_authorized_admin_grants_and_revokes_an_audited_ability(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();

        $abilityId = $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/abilities', [
                'user_id' => $teacher->id,
                'permission' => 'attendance.view_school',
                'effective_from' => '2026-08-23T08:00:00+08:00',
                'expires_at' => '2026-08-30T18:00:00+08:00',
                'reason' => 'Weekly duty roster.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.permission', 'attendance.view_school')
            ->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.ability_granted',
            'entity_type' => 'user_attendance_ability',
        ]);

        $this->actingAs($admin)
            ->deleteJson("http://localhost/api/v1/admin/attendance/abilities/{$abilityId}", [
                'reason' => 'Duty reassigned.',
            ])
            ->assertOk()
            ->assertJsonPath('data.revoked', true);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.ability_revoked',
            'reason' => 'Duty reassigned.',
        ]);
    }

    public function test_teacher_cannot_manage_attendance_abilities(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();

        $this->actingAs($teacher)
            ->getJson('http://localhost/api/v1/admin/attendance/abilities')
            ->assertForbidden();
    }
}
