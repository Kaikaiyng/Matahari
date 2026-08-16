<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SLUG = 'payment_reminders.send';

    public function up(): void
    {
        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['slug' => self::SLUG],
            ['name' => 'Send payment reminders', 'created_at' => $now, 'updated_at' => $now],
        );
        $permissionId = DB::table('permissions')->where('slug', self::SLUG)->value('id');

        foreach (DB::table('roles')->whereIn('slug', ['super-admin', 'school-admin', 'finance'])->pluck('id') as $roleId) {
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
