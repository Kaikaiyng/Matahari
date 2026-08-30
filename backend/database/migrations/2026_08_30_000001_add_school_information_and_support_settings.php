<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSION = 'school.settings.manage';

    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table): void {
            $table->string('registration_number', 100)->nullable()->after('name');
            $table->string('group_member_line', 255)->nullable()->after('registration_number');
            $table->string('operating_hours', 255)->nullable()->after('address');
        });

        Schema::create('school_support_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('call_phone', 50)->nullable();
            $table->string('whatsapp_phone', 50)->nullable();
            $table->string('support_email')->nullable();
            $table->string('operating_hours', 255)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['slug' => self::PERMISSION],
            ['name' => 'Manage school information and App Support settings', 'created_at' => $now, 'updated_at' => $now],
        );
        $permissionId = DB::table('permissions')->where('slug', self::PERMISSION)->value('id');
        foreach (DB::table('roles')->whereIn('slug', ['super-admin', 'school-admin', 'finance'])->pluck('id') as $roleId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $roleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('school_support_settings');

        Schema::table('schools', function (Blueprint $table): void {
            $table->dropColumn(['registration_number', 'group_member_line', 'operating_hours']);
        });

        $permissionIds = DB::table('permissions')->where('slug', self::PERMISSION)->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
