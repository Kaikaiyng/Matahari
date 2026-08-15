<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentManagementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_list_defaults_to_active_students_and_exposes_student_no(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        $class = SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'Primary 1',
            'status' => 'active',
        ]);

        $user = $this->userWithPermission($school, 'students.view');

        Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $class->id,
            'student_no' => 'MIS-STD-0001',
            'full_name' => 'Alyssa Tan',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $class->id,
            'student_no' => 'MIS-STD-0002',
            'full_name' => 'Daniel Lim',
            'level_group' => 'primary',
            'status' => 'inactive',
        ]);

        $this->actingAs($user)
            ->getJson('/api/students')
            ->assertOk()
            ->assertJsonPath('data.0.student_no', 'MIS-STD-0001')
            ->assertJsonPath('data.0.full_name', 'Alyssa Tan')
            ->assertJsonCount(1, 'data');
    }

    public function test_student_status_is_changed_only_through_status_endpoint(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        $student = Student::query()->create([
            'school_id' => $school->id,
            'student_no' => 'MIS-STD-0001',
            'full_name' => 'Alyssa Tan',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        $user = $this->userWithPermissions($school, ['students.update', 'students.update_status']);

        $this->actingAs($user)
            ->patchJson("/api/students/{$student->id}", [
                'full_name' => 'Alyssa Tan Updated',
                'status' => 'withdraw',
            ])
            ->assertOk();

        $student->refresh();
        $this->assertSame('Alyssa Tan Updated', $student->full_name);
        $this->assertSame('active', $student->status);

        $this->actingAs($user)
            ->patchJson("/api/students/{$student->id}/status", [
                'status' => 'withdraw',
            ])
            ->assertOk()
            ->assertJsonPath('student.status', 'withdraw');
    }

    public function test_finance_user_can_view_students_but_cannot_create_students(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        $finance = $this->userWithPermission($school, 'students.view');

        $this->actingAs($finance)
            ->getJson('/api/students')
            ->assertOk();

        $this->actingAs($finance)
            ->postJson('/api/students', [
                'student_no' => 'MIS-STD-0003',
                'full_name' => 'Mika Wong',
                'level_group' => 'primary',
                'status' => 'active',
            ])
            ->assertForbidden();
    }

    public function test_class_catalog_returns_the_configured_classes_grouped_by_level(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        foreach ([
            'kindergarten' => ['Kindergarten'],
            'primary' => ['MA1', 'MB1', 'MC1', 'MD1', 'ME1', 'MF1'],
            'secondary' => ['MP1', 'MQ1', 'MR1', 'MS1', 'MT1'],
            'stp' => ['STP'],
        ] as $levelGroup => $names) {
            foreach ($names as $name) {
                SchoolClass::query()->create([
                    'school_id' => $school->id,
                    'name' => $name,
                    'status' => 'active',
                ]);
            }
        }

        $user = $this->userWithPermission($school, 'students.view');

        $this->actingAs($user)
            ->getJson('/api/classes')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Kindergarten')
            ->assertJsonPath('data.0.level_group', 'kindergarten')
            ->assertJsonPath('data.1.name', 'MA1')
            ->assertJsonPath('data.7.name', 'MP1')
            ->assertJsonPath('data.12.name', 'STP')
            ->assertJsonCount(13, 'data');
    }

    public function test_student_class_must_match_the_selected_level_group(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);
        $primaryClass = SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'MA1',
            'status' => 'active',
        ]);
        $user = $this->userWithPermission($school, 'students.create');

        $this->actingAs($user)
            ->postJson('/api/students', [
                'class_id' => $primaryClass->id,
                'student_no' => 'MIS-STD-0003',
                'full_name' => 'Mika Wong',
                'level_group' => 'secondary',
                'status' => 'active',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('class_id');
    }

    public function test_student_class_must_belong_to_the_signed_in_school(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);
        $otherSchool = $this->createTenantSchool([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherClass = SchoolClass::query()->create([
            'school_id' => $otherSchool->id,
            'name' => 'MA1',
            'status' => 'active',
        ]);
        $user = $this->userWithPermission($school, 'students.create');

        $this->actingAs($user)
            ->postJson('/api/students', [
                'school_id' => $otherSchool->id,
                'class_id' => $otherClass->id,
                'student_no' => 'MIS-STD-0004',
                'full_name' => 'Cross School Student',
                'level_group' => 'primary',
                'status' => 'active',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('class_id');
    }

    private function userWithPermission(School $school, string $permissionSlug): User
    {
        return $this->userWithPermissions($school, [$permissionSlug]);
    }

    /**
     * @param  array<int, string>  $permissionSlugs
     */
    private function userWithPermissions(School $school, array $permissionSlugs): User
    {
        $user = User::factory()->create(['school_id' => $school->id]);
        $role = Role::query()->create(['name' => 'Test Role', 'slug' => 'test-role-'.uniqid()]);

        foreach ($permissionSlugs as $permissionSlug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $permissionSlug],
                ['name' => $permissionSlug],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $user->roles()->syncWithoutDetaching([$role->id]);

        return $user;
    }
}
