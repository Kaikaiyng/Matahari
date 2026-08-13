<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'community.view' => 'View authorized community posts',
        'community.publish' => 'Publish authorized community posts',
        'community.interact' => 'React to and comment on authorized community posts',
        'community.moderate' => 'Moderate community content',
    ];

    public function up(): void
    {
        $now = now();
        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->insertOrIgnore(['slug' => $slug, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('permissions')->where('slug', $slug)->update(['name' => $name, 'updated_at' => $now]);
        }

        $this->assign(['super-admin', 'school-admin'], array_keys(self::PERMISSIONS), $now);
        $this->assign(['teacher'], ['community.view', 'community.publish', 'community.interact'], $now);
        $this->assign(['parent', 'student'], ['community.view', 'community.interact'], $now);
    }

    public function down(): void
    {
        $ids = DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }

    private function assign(array $roles, array $permissions, mixed $now): void
    {
        $roleIds = DB::table('roles')->whereIn('slug', $roles)->pluck('id');
        $permissionIds = DB::table('permissions')->whereIn('slug', $permissions)->pluck('id');
        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permissionId],
                    ['created_at' => $now, 'updated_at' => $now],
                );
            }
        }
    }
};
