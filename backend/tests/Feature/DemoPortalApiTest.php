<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\PortalNotification;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DemoPortalApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_mis_demo_seed_creates_explicit_portal_identities_and_academic_scope(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();

        $this->assertTrue($parent->hasPermissionTo('parent.self_service'));
        $this->assertTrue($studentUser->hasPermissionTo('student.self_service'));
        $this->assertTrue($teacher->hasPermissionTo('teaching_scope.view'));

        $parentResponse = $this->actingAs($parent)
            ->getJson('/api/v1/portal/parent/me')
            ->assertOk()
            ->assertJsonCount(3, 'children')
            ->assertJsonPath('data.full_name', 'Rachel Wong');
        $alyssa = collect($parentResponse->json('children'))->firstWhere('student_no', 'MIS-2026-001');
        $this->assertSame('2026', data_get($alyssa, 'academic_year.code'));

        $this->actingAs($studentUser)
            ->getJson('/api/v1/portal/student/enrolments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.class.name', 'MB1')
            ->assertJsonPath('data.0.subjects.0.subject_code', 'ENG')
            ->assertJsonPath('data.0.subjects.0.teacher_name', 'Teacher Lim');
    }

    public function test_parent_finance_access_requires_the_exact_active_capability_link(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();

        $this->actingAs($parent)
            ->getJson("/api/v1/portal/parent/children/{$student->id}/outstanding?academic_year=2026")
            ->assertOk();

        $parent->guardianProfile->students()->updateExistingPivot($student->id, ['can_view_finance' => false]);

        $this->actingAs($parent)
            ->getJson("/api/v1/portal/parent/children/{$student->id}/outstanding?academic_year=2026")
            ->assertForbidden();
    }

    public function test_parent_and_student_portal_access_rejects_cross_school_records(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $otherSchool = School::query()->create([
            'name' => 'Other School',
            'code' => 'OTHER',
            'receipt_prefix' => 'OTHER',
            'invoice_prefix' => 'OTHER-INV',
            'status' => 'active',
        ]);
        $otherStudent = Student::query()->create([
            'school_id' => $otherSchool->id,
            'student_no' => 'OTHER-001',
            'full_name' => 'Other Student',
            'level_group' => 'primary',
            'registration_date' => '2026-01-01',
            'status' => 'active',
        ]);

        $this->actingAs($parent)
            ->getJson("/api/v1/portal/parent/children/{$otherStudent->id}/payments")
            ->assertForbidden();
    }

    public function test_notifications_are_scoped_to_the_authenticated_user_and_school(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $own = PortalNotification::query()->create([
            'school_id' => $parent->school_id,
            'recipient_user_id' => $parent->id,
            'type' => 'general',
            'title' => 'Parent notice',
            'body' => 'Visible to the parent only.',
        ]);
        $other = PortalNotification::query()->create([
            'school_id' => $student->school_id,
            'recipient_user_id' => $student->id,
            'type' => 'general',
            'title' => 'Student notice',
            'body' => 'Visible to the student only.',
        ]);

        $this->actingAs($parent)
            ->getJson('/api/v1/portal/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id);

        $this->actingAs($parent)
            ->patchJson("/api/v1/portal/notifications/{$other->id}/read")
            ->assertForbidden();

        $this->actingAs($parent)
            ->patchJson("/api/v1/portal/notifications/{$own->id}/read")
            ->assertOk();
        $this->assertNotNull($own->fresh()->read_at);
        $this->assertNull($other->fresh()->read_at);
    }

    public function test_staff_api_uses_foundation_permission_and_creates_teacher_only(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/staff')
            ->assertOk()
            ->assertJsonFragment(['username' => 'teacher.lim']);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Demo Teacher',
                'username' => 'demo.teacher',
                'password' => 'demo-password-2026',
            ])
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'teacher');

        $created = User::query()->where('username', 'demo.teacher')->firstOrFail();
        $this->assertSame(['teacher'], $created->roles()->pluck('slug')->all());
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'user',
            'entity_id' => $created->id,
        ]);
    }

    public function test_student_create_permission_cannot_manage_staff_or_assign_admin_role(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $permission = Permission::query()->where('slug', 'students.create')->firstOrFail();
        $role = Role::query()->create(['slug' => 'student-creator-only', 'name' => 'Student Creator Only']);
        $role->permissions()->attach($permission);
        $user = User::query()->create([
            'school_id' => $school->id,
            'name' => 'Limited User',
            'username' => 'limited.user',
            'password' => 'limited-password-2026',
            'status' => 'active',
        ]);
        $user->roles()->attach($role);

        $this->actingAs($user)
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Escalated User',
                'username' => 'escalated.user',
                'password' => 'escalated-password-2026',
            ])
            ->assertForbidden();

        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->actingAs($admin)
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Escalated User',
                'username' => 'escalated.user',
                'password' => 'escalated-password-2026',
                'role_slug' => 'super-admin',
            ])
            ->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['username' => 'escalated.user']);
    }

    public function test_notification_migration_has_expected_columns_and_indexes(): void
    {
        $this->assertTrue(Schema::hasColumns('portal_notifications', [
            'school_id',
            'recipient_user_id',
            'type',
            'title',
            'body',
            'context_json',
            'read_at',
        ]));
        $indexes = Schema::getIndexes('portal_notifications');
        $names = collect($indexes)->pluck('name');
        $this->assertContains('portal_notifications_user_read_idx', $names);
        $this->assertContains('portal_notifications_school_user_idx', $names);
    }
}
