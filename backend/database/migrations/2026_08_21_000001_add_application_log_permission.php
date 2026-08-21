<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SLUG = 'logs.view';

    public function up(): void
    {
        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['slug' => self::SLUG],
            ['name' => 'View sanitized application logs', 'created_at' => $now, 'updated_at' => $now],
        );

        $permissionId = DB::table('permissions')->where('slug', self::SLUG)->value('id');
        $roleId = DB::table('roles')->where('slug', 'super-admin')->value('id');

        if ($permissionId && $roleId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $roleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')->where('slug', self::SLUG)->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
