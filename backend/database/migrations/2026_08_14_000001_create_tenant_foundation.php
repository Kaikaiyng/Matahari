<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // Keep the explicit legacy relationship in memory. SQLite rebuilds the
        // referenced schools table when adding its tenant foreign key and can
        // apply users.school_id nullOnDelete during that rebuild.
        $legacyUserSchools = DB::table('users')->whereNotNull('school_id')->orderBy('id')->get(['id', 'school_id']);

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('name');
            $table->string('status', 30)->default('active');
            $table->string('timezone', 60)->default('Asia/Kuala_Lumpur');
            $table->string('locale', 10)->default('en');
            $table->timestamps();
            $table->index(['status', 'slug']);
        });

        Schema::create('tenant_brandings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('organization_name');
            $table->string('organization_short_name', 30);
            $table->string('admin_title')->default('Administration & Finance');
            $table->string('app_title')->default('School Community');
            $table->string('logo_url', 2048)->nullable();
            $table->string('primary_color', 7)->default('#c9254a');
            $table->string('accent_color', 7)->default('#1f2a44');
            $table->timestamps();
        });

        Schema::create('tenant_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('hostname', 253)->unique();
            $table->string('surface', 20);
            $table->boolean('is_primary')->default(false);
            $table->string('status', 30)->default('active');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'surface', 'status']);
        });

        Schema::create('tenant_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('feature_key', 100);
            $table->boolean('enabled')->default(false);
            $table->json('configuration')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'feature_key']);
        });

        Schema::table('schools', function (Blueprint $table) {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->restrictOnDelete();
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_platform_owner')->default(false)->after('school_id');
        });

        $now = now();
        foreach (DB::table('schools')->orderBy('id')->get(['id', 'code', 'name']) as $school) {
            $baseSlug = Str::slug((string) $school->code) ?: 'school-'.$school->id;
            $slug = $baseSlug;
            if (DB::table('tenants')->where('slug', $slug)->exists()) {
                $slug = $baseSlug.'-'.$school->id;
            }

            $tenantId = DB::table('tenants')->insertGetId([
                'slug' => $slug,
                'name' => $school->name,
                'status' => 'active',
                'timezone' => 'Asia/Kuala_Lumpur',
                'locale' => 'en',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('tenant_brandings')->insert([
                'tenant_id' => $tenantId,
                'organization_name' => $school->name,
                'organization_short_name' => Str::upper(Str::limit((string) $school->code, 30, '')),
                'admin_title' => 'Administration & Finance',
                'app_title' => 'School Community',
                'primary_color' => '#c9254a',
                'accent_color' => '#1f2a44',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach (['community', 'attendance', 'assessments', 'schedule', 'formal_quiz', 'parent_finance', 'notifications'] as $feature) {
                DB::table('tenant_features')->insert(['tenant_id' => $tenantId, 'feature_key' => $feature, 'enabled' => true, 'created_at' => $now, 'updated_at' => $now]);
            }
            foreach (['practice_ai_quiz', 'online_payments', 'native_authentication'] as $feature) {
                DB::table('tenant_features')->insert(['tenant_id' => $tenantId, 'feature_key' => $feature, 'enabled' => false, 'created_at' => $now, 'updated_at' => $now]);
            }
            DB::table('schools')->where('id', $school->id)->update(['tenant_id' => $tenantId]);
        }

        Schema::table('schools', function (Blueprint $table) {
            $table->dropUnique('schools_code_unique');
            $table->unique(['tenant_id', 'code'], 'schools_tenant_code_unique');
        });

        Schema::create('tenant_user_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('default_school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->boolean('access_all_schools')->default(false);
            $table->string('status', 30)->default('active');
            $table->timestamps();
            $table->unique(['tenant_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('tenant_membership_schools', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_user_membership_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['tenant_user_membership_id', 'school_id'], 'tenant_membership_school_unique');
        });

        Schema::create('tenant_membership_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_user_membership_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['tenant_user_membership_id', 'role_id'], 'tenant_membership_role_unique');
        });

        foreach ($legacyUserSchools as $user) {
            $tenantId = DB::table('schools')->where('id', $user->school_id)->value('tenant_id');
            if (! $tenantId) {
                continue;
            }
            $membershipId = DB::table('tenant_user_memberships')->insertGetId([
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'default_school_id' => $user->school_id,
                'access_all_schools' => false,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('tenant_membership_schools')->insert([
                'tenant_user_membership_id' => $membershipId,
                'school_id' => $user->school_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach (DB::table('user_roles')->where('user_id', $user->id)->pluck('role_id') as $roleId) {
                DB::table('tenant_membership_roles')->insert([
                    'tenant_user_membership_id' => $membershipId,
                    'role_id' => $roleId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $tenantOwnerRoleId = DB::table('roles')->where('slug', 'tenant-owner')->value('id')
            ?: DB::table('roles')->insertGetId(['slug' => 'tenant-owner', 'name' => 'Tenant Owner', 'created_at' => $now, 'updated_at' => $now]);
        $tenantSettingsPermissionId = DB::table('permissions')->where('slug', 'tenant.settings.manage')->value('id')
            ?: DB::table('permissions')->insertGetId(['slug' => 'tenant.settings.manage', 'name' => 'Manage current tenant settings', 'created_at' => $now, 'updated_at' => $now]);
        foreach (array_filter([$tenantOwnerRoleId, DB::table('roles')->where('slug', 'super-admin')->value('id')]) as $roleId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $roleId, 'permission_id' => $tenantSettingsPermissionId, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_membership_roles');
        Schema::dropIfExists('tenant_membership_schools');
        Schema::dropIfExists('tenant_user_memberships');

        $tenantSettingsPermissionId = DB::table('permissions')->where('slug', 'tenant.settings.manage')->value('id');
        $tenantOwnerRoleId = DB::table('roles')->where('slug', 'tenant-owner')->value('id');
        if ($tenantSettingsPermissionId) {
            DB::table('role_permissions')->where('permission_id', $tenantSettingsPermissionId)->delete();
            DB::table('permissions')->where('id', $tenantSettingsPermissionId)->delete();
        }
        if ($tenantOwnerRoleId) {
            DB::table('user_roles')->where('role_id', $tenantOwnerRoleId)->delete();
            DB::table('roles')->where('id', $tenantOwnerRoleId)->delete();
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_platform_owner');
        });
        Schema::table('schools', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropIndex(['tenant_id', 'status']);
            $table->dropUnique('schools_tenant_code_unique');
            $table->dropColumn('tenant_id');
            $table->unique('code');
        });

        Schema::dropIfExists('tenant_features');
        Schema::dropIfExists('tenant_domains');
        Schema::dropIfExists('tenant_brandings');
        Schema::dropIfExists('tenants');
    }
};
