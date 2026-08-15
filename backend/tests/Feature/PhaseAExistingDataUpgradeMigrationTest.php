<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PhaseAExistingDataUpgradeMigrationTest extends TestCase
{
    public function test_existing_data_upgrades_without_guessing_portal_access_or_rewriting_roles(): void
    {
        $this->artisan('migrate:fresh', ['--force' => true])->assertExitCode(0);

        $roleMigration = require database_path('migrations/2026_08_12_000003_add_phase_a_roles_and_permissions.php');
        $portalMigration = require database_path('migrations/2026_08_12_000002_add_portal_foundation_links.php');
        $academicMigration = require database_path('migrations/2026_08_12_000001_create_academic_foundation_tables.php');
        $roleMigration->down();
        $portalMigration->down();
        $academicMigration->down();

        $now = now();
        $tenantId = DB::table('tenants')->insertGetId([
            'slug' => 'legacy',
            'name' => 'Legacy Tenant',
            'status' => 'active',
            'timezone' => 'Asia/Kuala_Lumpur',
            'locale' => 'en',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $schoolId = DB::table('schools')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => 'LEGACY',
            'name' => 'Legacy School',
            'receipt_prefix' => 'LEG',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $userId = DB::table('users')->insertGetId([
            'school_id' => $schoolId,
            'name' => 'Existing User',
            'username' => 'existing-user',
            'password' => 'not-used',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $teacherRoleId = DB::table('roles')->insertGetId([
            'slug' => 'teacher',
            'name' => 'Existing Teacher Role',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role_id' => $teacherRoleId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $classId = DB::table('classes')->insertGetId([
            'school_id' => $schoolId,
            'name' => 'MA1',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $studentId = DB::table('students')->insertGetId([
            'school_id' => $schoolId,
            'class_id' => $classId,
            'level_group' => 'primary',
            'student_no' => 'LEG-001',
            'full_name' => 'Existing Student',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $parentId = DB::table('parents')->insertGetId([
            'school_id' => $schoolId,
            'full_name' => 'Existing Guardian',
            'phone' => '0123456789',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $linkId = DB::table('student_parent_links')->insertGetId([
            'school_id' => $schoolId,
            'student_id' => $studentId,
            'parent_id' => $parentId,
            'relationship' => 'guardian',
            'is_primary_contact' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $academicMigration->up();
        $portalMigration->up();
        $roleMigration->up();

        $link = DB::table('student_parent_links')->where('id', $linkId)->first();
        $this->assertSame('unreviewed', $link->status);
        $this->assertNull($link->can_view_finance);
        $this->assertNull($link->can_view_academics);
        $this->assertNull($link->current_slot);
        $this->assertNull(DB::table('parents')->where('id', $parentId)->value('user_id'));
        $this->assertNull(DB::table('students')->where('id', $studentId)->value('user_id'));
        $this->assertSame($classId, DB::table('students')->where('id', $studentId)->value('class_id'));
        $this->assertTrue(DB::table('user_roles')->where(['user_id' => $userId, 'role_id' => $teacherRoleId])->exists());
        $this->assertTrue(DB::table('role_permissions')
            ->join('permissions', 'permissions.id', '=', 'role_permissions.permission_id')
            ->where('role_permissions.role_id', $teacherRoleId)
            ->where('permissions.slug', 'teaching_scope.view')
            ->exists());
        $this->assertDatabaseCount('academic_years', 0);
        $this->assertDatabaseCount('class_enrolments', 0);
    }
}
