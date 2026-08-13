<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'schedule.manage' => 'Manage school class schedules',
        'schedule.view' => 'View authorized class schedules',
    ];

    public function up(): void
    {
        Schema::create('class_schedule_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('teaching_assignment_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('title', 150);
            $table->unsignedTinyInteger('day_of_week');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->string('location', 150)->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('status', 24)->default('draft');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['school_id', 'academic_year_id', 'class_id', 'status'], 'class_schedule_scope_index');
            $table->index(['class_id', 'day_of_week', 'starts_at'], 'class_schedule_day_time_index');
        });

        $now = now();
        foreach (self::PERMISSIONS as $slug => $name) {
            DB::table('permissions')->insertOrIgnore(['slug' => $slug, 'name' => $name, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('permissions')->where('slug', $slug)->update(['name' => $name, 'updated_at' => $now]);
        }
        $this->assign(['super-admin', 'school-admin'], array_keys(self::PERMISSIONS), $now);
        $this->assign(['teacher', 'parent', 'student'], ['schedule.view'], $now);
    }

    public function down(): void
    {
        Schema::dropIfExists('class_schedule_entries');
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
