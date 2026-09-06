<?php

namespace Tests\Feature;

use App\Models\Guardian;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParentDirectoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_directory_requires_authentication_and_parent_view_permission(): void
    {
        $school = $this->school('MIS');
        $this->getJson('/api/v1/admin/parents')->assertUnauthorized();
        $this->actingAs($this->user($school, []))->getJson('/api/v1/admin/parents')->assertForbidden();
    }

    public function test_directory_preserves_multiple_children_and_relationship_history_without_leaking_other_schools(): void
    {
        $school = $this->school('MIS');
        $other = $this->school('OTHER');
        [$guardian, $child] = $this->family($school, 'Local Guardian', 'MIS-001');
        $secondChild = $this->student($school, 'MIS-002');
        $this->link($guardian, $secondChild, 'ended');
        $secondGuardian = Guardian::query()->create(['school_id' => $school->id, 'full_name' => 'Second Guardian', 'phone' => '0000000000']);
        $this->link($secondGuardian, $child, 'unreviewed');
        $this->family($other, 'Other Guardian', 'OTHER-001');

        $this->actingAs($this->user($school, ['parents.view', 'students.view']))
            ->getJson('/api/v1/admin/parents?school_id='.$other->id)->assertForbidden();
        $response = $this->getJson('/api/v1/admin/parents')->assertOk();
        $response->assertJsonPath('meta.total', 2)->assertJsonPath('meta.can_view_students', true)
            ->assertJsonCount(2, 'data.0.children')->assertJsonCount(1, 'data.1.children')
            ->assertJsonPath('data.0.account_linked', false)
            ->assertJsonPath('data.0.children.1.relationship_status', 'ended')
            ->assertJsonMissing(['name' => 'Other Guardian'])->assertJsonMissing(['student_no' => 'OTHER-001']);
        $this->assertDatabaseHas('student_parent_links', ['parent_id' => $guardian->id, 'student_id' => $child->id, 'status' => 'unreviewed']);
    }

    public function test_parent_only_view_cannot_read_or_search_student_information(): void
    {
        $school = $this->school('MIS');
        $this->family($school, 'Local Guardian', 'SECRET-CHILD');
        $this->actingAs($this->user($school, ['parents.view']))
            ->getJson('/api/v1/admin/parents')->assertOk()
            ->assertJsonPath('meta.can_view_students', false)->assertJsonCount(0, 'meta.class_options')
            ->assertJsonCount(0, 'data.0.children')->assertJsonMissing(['student_no' => 'SECRET-CHILD']);
        $this->getJson('/api/v1/admin/parents?search=SECRET-CHILD')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/admin/parents?class_id=1')->assertForbidden();
    }

    public function test_search_class_filter_and_pagination_share_the_same_scoped_results(): void
    {
        $school = $this->school('MIS');
        [$guardian, $child] = $this->family($school, 'Alpha 100% Family', 'MATCH-001');
        $class = SchoolClass::query()->create(['school_id' => $school->id, 'name' => 'MA1', 'status' => 'active']);
        $child->update(['class_id' => $class->id]);
        $this->family($school, 'Beta Family', 'MATCH-002');
        Guardian::query()->create(['school_id' => $school->id, 'full_name' => 'Unlinked Contact', 'phone' => '0000000000']);
        $this->actingAs($this->user($school, ['parents.view', 'students.view']));
        $this->getJson('/api/v1/admin/parents?search=match&per_page=1&page=2')->assertOk()
            ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 2)->assertJsonPath('data.0.name', 'Beta Family');
        $this->getJson('/api/v1/admin/parents?class_id='.$class->id)->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $guardian->id);
        $this->getJson('/api/v1/admin/parents?search=100%25')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/parents?search=unlinked')->assertOk()->assertJsonCount(0, 'data.0.children');
        $this->getJson('/api/v1/admin/parents?per_page=101')->assertUnprocessable();
        $this->getJson('/api/v1/admin/parents?class_id=99999')->assertUnprocessable();
    }

    private function school(string $code): School
    {
        return $this->createTenantSchool(['code' => $code, 'name' => $code, 'receipt_prefix' => $code, 'status' => 'active']);
    }

    private function user(School $school, array $permissions): User
    {
        $user = User::query()->create(['school_id' => $school->id, 'name' => 'Directory User', 'username' => 'directory-'.User::query()->count(), 'password' => 'test-password', 'status' => 'active']);
        $role = Role::query()->create(['slug' => 'directory-'.$user->id, 'name' => 'Directory Reader']);
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->attach($permission->id);
        }
        $user->roles()->attach($role->id);

        return $user;
    }

    private function student(School $school, string $number): Student
    {
        return Student::query()->create(['school_id' => $school->id, 'student_no' => $number, 'full_name' => $number.' Student', 'level_group' => 'primary', 'status' => 'active']);
    }

    private function family(School $school, string $name, string $number): array
    {
        $guardian = Guardian::query()->create(['school_id' => $school->id, 'full_name' => $name, 'phone' => '0000000000']);
        $student = $this->student($school, $number);
        $this->link($guardian, $student, 'unreviewed');

        return [$guardian, $student];
    }

    private function link(Guardian $guardian, Student $student, string $status): void
    {
        StudentParentLink::query()->create(['school_id' => $guardian->school_id, 'parent_id' => $guardian->id, 'student_id' => $student->id, 'relationship' => 'guardian', 'status' => $status, 'is_primary_contact' => false, 'ended_on' => $status === 'ended' ? '2026-08-31' : null]);
    }
}
