<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_PERMISSIONS = [
        'employees.view' => 'View school employees',
        'employees.manage' => 'Create and manage school employees',
        'employees.abilities.manage' => 'Manage employee positions and user abilities',
        'app.teacher_access' => 'Use the Community App with the Teacher persona',
    ];

    public function up(): void
    {
        Schema::create('user_permission_overrides', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->restrictOnDelete();
            $table->boolean('allowed');
            $table->string('reason', 500);
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['school_id', 'user_id', 'permission_id'], 'user_permission_overrides_scope_unique');
            $table->index(['school_id', 'user_id', 'allowed'], 'user_permission_overrides_lookup_idx');
        });

        $now = now();
        foreach (self::NEW_PERMISSIONS as $slug => $name) {
            DB::table('permissions')->updateOrInsert(
                ['slug' => $slug],
                ['name' => $name, 'created_at' => $now, 'updated_at' => $now],
            );
        }

        $schoolAdminId = DB::table('roles')->where('slug', 'school-admin')->value('id');
        $financeId = DB::table('roles')->where('slug', 'finance')->value('id');
        $teacherId = DB::table('roles')->where('slug', 'teacher')->value('id');
        $employeePermissionIds = DB::table('permissions')
            ->whereIn('slug', ['employees.view', 'employees.manage', 'employees.abilities.manage'])
            ->pluck('id');

        foreach (array_filter([$schoolAdminId, $financeId]) as $roleId) {
            foreach ($employeePermissionIds as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permissionId],
                    ['created_at' => $now, 'updated_at' => $now],
                );
            }
        }

        $teacherAppPermissionId = DB::table('permissions')->where('slug', 'app.teacher_access')->value('id');
        if ($teacherId && $teacherAppPermissionId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $teacherId, 'permission_id' => $teacherAppPermissionId],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }

        // Finance is the advanced Admin position: inherit every School Admin default,
        // then retain its existing finance-only permissions.
        if ($schoolAdminId && $financeId) {
            foreach (DB::table('role_permissions')->where('role_id', $schoolAdminId)->pluck('permission_id') as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(
                    ['role_id' => $financeId, 'permission_id' => $permissionId],
                    ['created_at' => $now, 'updated_at' => $now],
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permission_overrides');
        $permissionIds = DB::table('permissions')->whereIn('slug', array_keys(self::NEW_PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
