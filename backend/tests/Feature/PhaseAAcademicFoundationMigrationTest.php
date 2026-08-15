<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassEnrolment;
use App\Models\Guardian;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PhaseAAcademicFoundationMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_phase_a_schema_is_additive_and_keeps_legacy_student_class(): void
    {
        $this->assertTrue(Schema::hasTable('academic_years'));
        $this->assertTrue(Schema::hasTable('class_enrolments'));
        $this->assertTrue(Schema::hasTable('subjects'));
        $this->assertTrue(Schema::hasTable('teaching_assignments'));
        $this->assertTrue(Schema::hasColumn('students', 'class_id'));
        $this->assertTrue(Schema::hasColumn('students', 'user_id'));
        $this->assertTrue(Schema::hasColumn('parents', 'user_id'));
    }

    public function test_existing_guardian_links_remain_unreviewed_without_portal_access(): void
    {
        [$school, $class, $student] = $this->schoolClassAndStudent();
        $guardian = Guardian::query()->create([
            'school_id' => $school->id,
            'full_name' => 'Existing Guardian',
            'phone' => '0123456789',
        ]);

        DB::table('student_parent_links')->insert([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'parent_id' => $guardian->id,
            'relationship' => 'guardian',
            'is_primary_contact' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $link = StudentParentLink::query()->firstOrFail();

        $this->assertSame('unreviewed', $link->status);
        $this->assertNull($link->can_view_finance);
        $this->assertNull($link->can_view_academics);
        $this->assertNull($link->current_slot);
        $this->assertNull($guardian->fresh()->user_id);
        $this->assertNull($student->fresh()->user_id);
    }

    public function test_database_rejects_duplicate_current_enrolment_but_preserves_history(): void
    {
        [$school, $class, $student] = $this->schoolClassAndStudent();
        $year = AcademicYear::query()->create([
            'school_id' => $school->id,
            'code' => '2026',
            'name' => '2026 Academic Year',
        ]);

        ClassEnrolment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'student_id' => $student->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        try {
            ClassEnrolment::query()->create([
                'school_id' => $school->id,
                'academic_year_id' => $year->id,
                'class_id' => $class->id,
                'student_id' => $student->id,
                'status' => 'active',
                'current_slot' => 1,
            ]);
            $this->fail('A duplicate current class enrolment was accepted.');
        } catch (QueryException) {
            $this->assertDatabaseCount('class_enrolments', 1);
        }

        ClassEnrolment::query()->firstOrFail()->update([
            'status' => 'ended',
            'current_slot' => null,
            'ended_on' => '2026-06-30',
        ]);
        ClassEnrolment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'student_id' => $student->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        $this->assertDatabaseCount('class_enrolments', 2);
    }

    public function test_new_roles_are_additive_and_existing_role_assignments_remain_valid(): void
    {
        $this->seed();

        $this->assertSame(
            ['ceo', 'finance', 'parent', 'school-admin', 'student', 'super-admin', 'teacher', 'tenant-owner'],
            Role::query()->orderBy('slug')->pluck('slug')->all(),
        );
        $this->assertTrue(User::query()->where('username', 'admin')->firstOrFail()->hasPermissionTo('students.view'));
        $this->assertTrue(User::query()->where('username', 'finance')->firstOrFail()->hasPermissionTo('payments.verify'));
        $this->assertTrue(Role::query()->where('slug', 'teacher')->firstOrFail()->permissions()->where('slug', 'teaching_scope.view')->exists());
    }

    /** @return array{School, SchoolClass, Student} */
    private function schoolClassAndStudent(): array
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'status' => 'active',
        ]);
        $class = SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'MA1',
            'status' => 'active',
        ]);
        $student = Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $class->id,
            'student_no' => 'MIS-001',
            'full_name' => 'Student One',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        return [$school, $class, $student];
    }
}
