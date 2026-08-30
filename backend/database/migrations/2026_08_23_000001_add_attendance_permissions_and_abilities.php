<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'attendance.view_assigned' => 'View assigned class Attendance',
        'attendance.view_school' => 'View school-wide Attendance',
        'attendance.manage_assigned' => 'Manage assigned class Attendance',
        'attendance.manage_school' => 'Manage school-wide Attendance',
        'attendance.devices.manage' => 'Manage Attendance devices and settings',
        'attendance.abilities.manage' => 'Manage time-bound Attendance abilities',
    ];

    public function up(): void
    {
        $now = now();
        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->insertOrIgnore([
                'slug' => $slug,
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->assign(['super-admin', 'school-admin'], array_keys(self::PERMISSIONS), $now);
        $this->assign(['teacher'], ['attendance.view_assigned', 'attendance.manage_assigned'], $now);

        Schema::create('user_attendance_abilities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->restrictOnDelete();
            $table->timestamp('effective_from');
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('granted_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->string('reason', 500);
            $table->timestamps();

            $table->index(['school_id', 'user_id', 'revoked_at'], 'attendance_abilities_school_user_active_idx');
            $table->index(['permission_id', 'effective_from', 'expires_at'], 'attendance_abilities_permission_window_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_attendance_abilities');

        $ids = DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }

    private function assign(array $roles, array $permissions, mixed $now): void
    {
        foreach (DB::table('roles')->whereIn('slug', $roles)->pluck('id') as $roleId) {
            foreach (DB::table('permissions')->whereIn('slug', $permissions)->pluck('id') as $permissionId) {
                DB::table('role_permissions')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permissionId],
                    ['created_at' => $now, 'updated_at' => $now],
                );
            }
        }
    }
};
