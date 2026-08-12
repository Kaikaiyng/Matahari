<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\Guardian;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class PhaseAFoundationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_admin_can_manage_academic_foundation_records(): void
    {
        [$school, $class, $student] = $this->schoolFixture('MIS');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', [
            'academic_years.view', 'academic_years.manage',
            'subjects.view', 'subjects.manage',
            'class_enrolments.view', 'class_enrolments.manage',
            'teaching_assignments.view', 'teaching_assignments.manage',
        ]);
        $teacher = $this->userWithRoleAndPermissions($school, 'teacher', ['teaching_scope.view']);

        $yearId = $this->actingAs($admin)->postJson('/api/v1/admin/academic-years', [
            'code' => '2026',
            'name' => '2026 Academic Year',
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/v1/admin/academic-years/{$yearId}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $subjectId = $this->postJson('/api/v1/admin/subjects', [
            'code' => 'SCI',
            'name' => 'Science',
        ])->assertCreated()->json('data.id');

        $enrolmentId = $this->postJson('/api/v1/admin/class-enrolments', [
            'academic_year_id' => $yearId,
            'class_id' => $class->id,
            'student_id' => $student->id,
        ])->assertCreated()->json('data.id');

        $assignmentId = $this->postJson('/api/v1/admin/teaching-assignments', [
            'academic_year_id' => $yearId,
            'class_id' => $class->id,
            'subject_id' => $subjectId,
            'teacher_user_id' => $teacher->id,
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/v1/admin/academic-years')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/subjects')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/class-enrolments?academic_year_id='.$yearId)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/teaching-assignments?academic_year_id='.$yearId)->assertOk()->assertJsonCount(1, 'data');

        $this->postJson("/api/v1/admin/teaching-assignments/{$assignmentId}/end", ['ended_on' => '2026-11-30'])
            ->assertOk()->assertJsonPath('data.status', 'ended');
        $this->postJson("/api/v1/admin/class-enrolments/{$enrolmentId}/end", ['ended_on' => '2026-12-01'])
            ->assertOk()->assertJsonPath('data.status', 'ended');

        $this->assertDatabaseCount('audit_logs', 7);
    }

    public function test_cross_school_academic_ids_are_rejected_without_partial_writes(): void
    {
        [$school] = $this->schoolFixture('MIS');
        [$otherSchool, $otherClass, $otherStudent] = $this->schoolFixture('OTH');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['class_enrolments.manage']);
        $otherYear = AcademicYear::query()->create([
            'school_id' => $otherSchool->id,
            'code' => '2026',
            'name' => 'Other 2026',
        ]);

        $this->actingAs($admin)->postJson('/api/v1/admin/class-enrolments', [
            'academic_year_id' => $otherYear->id,
            'class_id' => $otherClass->id,
            'student_id' => $otherStudent->id,
        ])->assertForbidden();

        $this->assertDatabaseCount('class_enrolments', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_teacher_sees_only_assigned_class_students(): void
    {
        [$school, $assignedClass, $assignedStudent] = $this->schoolFixture('MIS');
        $otherClass = SchoolClass::query()->create(['school_id' => $school->id, 'name' => 'MB1', 'status' => 'active']);
        $otherStudent = Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $otherClass->id,
            'student_no' => 'MIS-002',
            'full_name' => 'Unrelated Student',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $teacher = $this->userWithRoleAndPermissions($school, 'teacher', ['teaching_scope.view']);
        $year = AcademicYear::query()->create(['school_id' => $school->id, 'code' => '2026', 'name' => '2026']);
        $subject = Subject::query()->create(['school_id' => $school->id, 'code' => 'SCI', 'name' => 'Science']);
        foreach ([[$assignedClass, $assignedStudent], [$otherClass, $otherStudent]] as [$class, $student]) {
            ClassEnrolment::query()->create([
                'school_id' => $school->id,
                'academic_year_id' => $year->id,
                'class_id' => $class->id,
                'student_id' => $student->id,
                'status' => 'active',
                'current_slot' => 1,
            ]);
        }
        TeachingAssignment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $assignedClass->id,
            'subject_id' => $subject->id,
            'teacher_user_id' => $teacher->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        $this->actingAs($teacher)
            ->getJson("/api/v1/teacher/classes/{$assignedClass->id}/students?academic_year_id={$year->id}&subject_id={$subject->id}")
            ->assertOk()
            ->assertJsonPath('data.0.id', $assignedStudent->id)
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/v1/teacher/classes/{$otherClass->id}/students?academic_year_id={$year->id}&subject_id={$subject->id}")
            ->assertForbidden();
    }

    public function test_teaching_assignment_rejects_user_without_teacher_role(): void
    {
        [$school, $class] = $this->schoolFixture('MIS');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['teaching_assignments.manage']);
        $notTeacher = $this->userWithRoleAndPermissions($school, 'parent', ['parent.self_service']);
        $year = AcademicYear::query()->create(['school_id' => $school->id, 'code' => '2026', 'name' => '2026']);
        $subject = Subject::query()->create(['school_id' => $school->id, 'code' => 'SCI', 'name' => 'Science']);

        $this->actingAs($admin)->postJson('/api/v1/admin/teaching-assignments', [
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'subject_id' => $subject->id,
            'teacher_user_id' => $notTeacher->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('teacher_user_id');
    }

    public function test_portal_user_links_and_guardian_access_cannot_cross_schools(): void
    {
        [$school, , $student] = $this->schoolFixture('MIS');
        [$otherSchool] = $this->schoolFixture('OTH');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['portal_links.manage']);
        $otherParentUser = $this->userWithRoleAndPermissions($otherSchool, 'parent', ['parent.self_service']);
        $otherStudentUser = $this->userWithRoleAndPermissions($otherSchool, 'student', ['student.self_service']);
        $guardian = Guardian::query()->create([
            'school_id' => $school->id,
            'full_name' => 'Guardian',
            'phone' => '0123000000',
        ]);
        $link = StudentParentLink::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'parent_id' => $guardian->id,
            'relationship' => 'guardian',
            'status' => 'unreviewed',
            'is_primary_contact' => true,
        ]);

        $this->actingAs($admin)->patchJson("/api/v1/admin/parents/{$guardian->id}/portal-user", [
            'user_id' => $otherParentUser->id,
        ])->assertForbidden();

        $this->patchJson("/api/v1/admin/students/{$student->id}/portal-user", [
            'user_id' => $otherStudentUser->id,
        ])->assertForbidden();

        $this->patchJson("/api/v1/admin/student-parent-links/{$link->id}/portal-access", [
            'status' => 'active',
            'can_view_finance' => true,
            'can_view_academics' => true,
        ])->assertUnprocessable();

        $this->assertNull($guardian->fresh()->user_id);
        $this->assertNull($student->fresh()->user_id);
        $this->assertSame('unreviewed', $link->fresh()->status);
    }

    public function test_reviewed_guardian_access_requires_explicit_link_and_flags(): void
    {
        [$school, , $student] = $this->schoolFixture('MIS');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['portal_links.manage']);
        $parentUser = $this->userWithRoleAndPermissions($school, 'parent', ['parent.self_service']);
        $guardian = Guardian::query()->create([
            'school_id' => $school->id,
            'full_name' => 'Reviewed Guardian',
            'phone' => '0123222222',
        ]);
        $link = StudentParentLink::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'parent_id' => $guardian->id,
            'relationship' => 'guardian',
            'status' => 'unreviewed',
            'is_primary_contact' => true,
        ]);

        $this->actingAs($admin)->patchJson("/api/v1/admin/parents/{$guardian->id}/portal-user", [
            'user_id' => $parentUser->id,
        ])->assertOk();

        $this->patchJson("/api/v1/admin/student-parent-links/{$link->id}/portal-access", [
            'status' => 'active',
            'can_view_finance' => true,
            'can_view_academics' => true,
            'starts_on' => '2026-01-01',
        ])->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.can_view_finance', true)
            ->assertJsonPath('data.can_view_academics', true);
    }

    public function test_finance_permissions_remain_unchanged_and_do_not_grant_academic_mutation(): void
    {
        [$school] = $this->schoolFixture('MIS');
        $finance = $this->userWithRoleAndPermissions($school, 'finance', ['payments.verify']);

        $this->actingAs($finance)->postJson('/api/v1/admin/subjects', [
            'code' => 'SCI',
            'name' => 'Science',
        ])->assertForbidden();

        $this->assertTrue($finance->hasPermissionTo('payments.verify'));
        $this->assertFalse($finance->hasPermissionTo('subjects.manage'));
    }

    public function test_multi_role_user_receives_permission_union_and_can_be_linked_as_parent(): void
    {
        [$school] = $this->schoolFixture('MIS');
        $user = $this->userWithRoleAndPermissions($school, 'teacher', ['teaching_scope.view']);
        $parentRole = $this->roleWithPermissions('parent', ['parent.self_service']);
        $user->roles()->attach($parentRole);
        $guardian = Guardian::query()->create([
            'school_id' => $school->id,
            'full_name' => 'Teacher Parent',
            'phone' => '0123111111',
        ]);
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['portal_links.manage']);

        $this->actingAs($admin)->patchJson("/api/v1/admin/parents/{$guardian->id}/portal-user", [
            'user_id' => $user->id,
        ])->assertOk()->assertJsonPath('data.user_id', $user->id);

        $this->actingAs($user)->getJson('/api/me')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->whereContains('user.roles', 'teacher')
                ->whereContains('user.roles', 'parent')
                ->whereContains('user.permissions', 'teaching_scope.view')
                ->whereContains('user.permissions', 'parent.self_service')
                ->etc());
    }

    public function test_foundation_role_management_preserves_existing_roles_and_supports_multiple_roles(): void
    {
        [$school] = $this->schoolFixture('MIS');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['foundation_accounts.manage']);
        $target = $this->userWithRoleAndPermissions($school, 'finance', ['payments.verify']);
        $this->roleWithPermissions('teacher', ['teaching_scope.view']);
        $this->roleWithPermissions('parent', ['parent.self_service']);

        $this->actingAs($admin)->patchJson("/api/v1/admin/users/{$target->id}/foundation-roles", [
            'roles' => ['teacher', 'parent'],
        ])->assertOk()
            ->assertJson(fn ($json) => $json
                ->whereContains('data.roles', 'finance')
                ->whereContains('data.roles', 'teacher')
                ->whereContains('data.roles', 'parent')
                ->etc());

        $this->assertTrue($target->fresh()->hasPermissionTo('payments.verify'));
        $this->assertTrue($target->fresh()->hasPermissionTo('teaching_scope.view'));
        $this->assertTrue($target->fresh()->hasPermissionTo('parent.self_service'));
    }

    public function test_audit_failure_rolls_back_sensitive_mutation(): void
    {
        [$school] = $this->schoolFixture('MIS');
        $admin = $this->userWithRoleAndPermissions($school, 'school-admin', ['subjects.manage']);
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });

        $this->withoutExceptionHandling();

        try {
            $this->actingAs($admin)->postJson('/api/v1/admin/subjects', ['code' => 'SCI', 'name' => 'Science']);
            $this->fail('The forced audit failure did not escape the request.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseCount('subjects', 0);
    }

    /** @return array{School, SchoolClass, Student} */
    private function schoolFixture(string $code): array
    {
        $school = School::query()->create([
            'code' => $code,
            'name' => "{$code} School",
            'receipt_prefix' => $code,
            'status' => 'active',
        ]);
        $class = SchoolClass::query()->create(['school_id' => $school->id, 'name' => 'MA1', 'status' => 'active']);
        $student = Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $class->id,
            'student_no' => "{$code}-001",
            'full_name' => "{$code} Student",
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        return [$school, $class, $student];
    }

    private function userWithRoleAndPermissions(School $school, string $roleSlug, array $permissions): User
    {
        $user = User::query()->create([
            'school_id' => $school->id,
            'name' => "{$roleSlug} user ".User::query()->count(),
            'username' => $roleSlug.'-'.User::query()->count().'-'.$school->id,
            'password' => Hash::make('password'),
            'status' => 'active',
        ]);
        $user->roles()->attach($this->roleWithPermissions($roleSlug, $permissions));

        return $user;
    }

    private function roleWithPermissions(string $roleSlug, array $permissions): Role
    {
        $role = Role::query()->firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        return $role;
    }
}
