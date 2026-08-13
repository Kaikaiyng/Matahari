<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'quizzes.manage' => 'Manage authorized formal quizzes',
        'quizzes.manage_school' => 'Manage all formal quizzes in the school',
        'quizzes.attempt' => 'Attempt assigned formal quizzes',
    ];

    public function up(): void
    {
        Schema::table('quiz_assignments', function (Blueprint $table): void {
            $table->foreignId('academic_year_id')->nullable()->after('school_id')->constrained()->restrictOnDelete();
            $table->index(['school_id', 'academic_year_id', 'status'], 'quiz_assignments_year_status_index');
        });
        $now = now();
        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->insertOrIgnore(['slug' => $slug, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('permissions')->where('slug', $slug)->update(['name' => $name, 'updated_at' => $now]);
        }
        $this->assign(['super-admin', 'school-admin'], array_keys(self::PERMISSIONS), $now);
        $this->assign(['teacher'], ['quizzes.manage'], $now);
        $this->assign(['student'], ['quizzes.attempt'], $now);
    }

    public function down(): void
    {
        Schema::table('quiz_assignments', function (Blueprint $table): void {
            $table->dropIndex('quiz_assignments_year_status_index');
            $table->dropConstrainedForeignId('academic_year_id');
        });
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
