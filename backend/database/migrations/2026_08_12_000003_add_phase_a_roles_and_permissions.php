<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLES = [
        'teacher' => 'Teacher',
        'parent' => 'Parent',
        'student' => 'Student',
    ];

    private const PERMISSIONS = [
        'academic_years.view' => 'View academic years',
        'academic_years.manage' => 'Manage academic years',
        'class_enrolments.view' => 'View class enrolments',
        'class_enrolments.manage' => 'Manage class enrolments',
        'subjects.view' => 'View subjects',
        'subjects.manage' => 'Manage subjects',
        'teaching_assignments.view' => 'View teaching assignments',
        'teaching_assignments.manage' => 'Manage teaching assignments',
        'teaching_scope.view' => 'View own teaching scope',
        'portal_links.manage' => 'Manage portal identity and guardian access links',
        'parent.self_service' => 'Access parent self-service',
        'student.self_service' => 'Access student academic self-service',
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::ROLES as $slug => $name) {
            DB::table('roles')->updateOrInsert(['slug' => $slug], [
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->updateOrInsert(['slug' => $slug], [
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->assign('super-admin', array_keys(self::PERMISSIONS), $now);
        $this->assign('school-admin', [
            'academic_years.view', 'academic_years.manage',
            'class_enrolments.view', 'class_enrolments.manage',
            'subjects.view', 'subjects.manage',
            'teaching_assignments.view', 'teaching_assignments.manage',
            'portal_links.manage',
        ], $now);
        $this->assign('teacher', [
            'academic_years.view', 'subjects.view', 'teaching_scope.view',
        ], $now);
        $this->assign('parent', ['parent.self_service'], $now);
        $this->assign('student', ['student.self_service'], $now);
    }

    public function down(): void
    {
        $roleIds = DB::table('roles')->whereIn('slug', array_keys(self::ROLES))->pluck('id');

        if (DB::table('user_roles')->whereIn('role_id', $roleIds)->exists()) {
            throw new RuntimeException('Cannot roll back Phase A roles while they are assigned to users.');
        }

        $permissionIds = DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
        DB::table('roles')->whereIn('id', $roleIds)->delete();
    }

    private function assign(string $roleSlug, array $permissionSlugs, mixed $now): void
    {
        $roleId = DB::table('roles')->where('slug', $roleSlug)->value('id');

        if (! $roleId) {
            return;
        }

        foreach (DB::table('permissions')->whereIn('slug', $permissionSlugs)->pluck('id') as $permissionId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $roleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }
    }
};
