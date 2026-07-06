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
        $school = School::query()->create([
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
        $school = School::query()->create([
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
        $school = School::query()->create([
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

    private function userWithPermission(School $school, string $permissionSlug): User
    {
        return $this->userWithPermissions($school, [$permissionSlug]);
    }

    /**
     * @param array<int, string> $permissionSlugs
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
