<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'assessments.manage' => 'Manage authorized assessments and results',
        'assessments.manage_school' => 'Manage all assessments in the school',
        'assessments.view_published' => 'View own authorized published assessment results',
    ];

    public function up(): void
    {
        $now = now();
        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->insertOrIgnore(['slug' => $slug, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('permissions')->where('slug', $slug)->update(['name' => $name, 'updated_at' => $now]);
        }
        $this->assign(['super-admin', 'school-admin'], array_keys(self::PERMISSIONS), $now);
        $this->assign(['teacher'], ['assessments.manage'], $now);
        $this->assign(['parent', 'student'], ['assessments.view_published'], $now);
    }

    public function down(): void
    {
        $ids = DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }

    private function assign(array $roles, array $permissions, mixed $now): void
    {
        foreach (DB::table('roles')->whereIn('slug', $roles)->pluck('id') as $roleId) {
            foreach (DB::table('permissions')->whereIn('slug', $permissions)->pluck('id') as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(['role_id' => $roleId, 'permission_id' => $permissionId], ['created_at' => $now, 'updated_at' => $now]);
            }
        }
    }
};
