<?php

namespace Tests\Feature;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantFoundationHardeningMigrationTest extends TestCase
{
    use DatabaseMigrations;

    public function test_tenant_ownership_columns_are_required(): void
    {
        $schoolTenant = collect(DB::select("PRAGMA table_info('schools')"))
            ->first(fn (object $column): bool => $column->name === 'tenant_id');

        $this->assertNotNull($schoolTenant);
        $this->assertSame(1, (int) $schoolTenant->notnull);
        $this->assertTrue(Schema::hasColumn('tenant_membership_schools', 'tenant_id'));

        $membershipSchoolTenant = collect(DB::select("PRAGMA table_info('tenant_membership_schools')"))
            ->first(fn (object $column): bool => $column->name === 'tenant_id');

        $this->assertNotNull($membershipSchoolTenant);
        $this->assertSame(1, (int) $membershipSchoolTenant->notnull);
    }

    public function test_database_rejects_cross_tenant_default_school(): void
    {
        [$firstTenant, $firstSchool] = $this->tenantAndSchool('alpha');
        [, $secondSchool] = $this->tenantAndSchool('beta');
        $userId = $this->user($firstSchool);

        $this->expectException(QueryException::class);

        DB::table('tenant_user_memberships')->insert([
            'tenant_id' => $firstTenant,
            'user_id' => $userId,
            'default_school_id' => $secondSchool,
            'access_all_schools' => false,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_database_rejects_cross_tenant_allowed_school(): void
    {
        [$firstTenant, $firstSchool] = $this->tenantAndSchool('alpha');
        [, $secondSchool] = $this->tenantAndSchool('beta');
        $membershipId = DB::table('tenant_user_memberships')->insertGetId([
            'tenant_id' => $firstTenant,
            'user_id' => $this->user($firstSchool),
            'default_school_id' => $firstSchool,
            'access_all_schools' => false,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(QueryException::class);

        DB::table('tenant_membership_schools')->insert([
            'tenant_id' => $firstTenant,
            'tenant_user_membership_id' => $membershipId,
            'school_id' => $secondSchool,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_database_rejects_duplicate_primary_domain_surface(): void
    {
        [$tenantId] = $this->tenantAndSchool('alpha');
        DB::table('tenant_domains')->insert([
            'tenant_id' => $tenantId,
            'hostname' => 'alpha-one.example.test',
            'surface' => 'admin',
            'is_primary' => true,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(QueryException::class);

        DB::table('tenant_domains')->insert([
            'tenant_id' => $tenantId,
            'hostname' => 'alpha-two.example.test',
            'surface' => 'admin',
            'is_primary' => true,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_upgrade_repairs_stale_school_index_and_preserves_existing_rows(): void
    {
        [$tenantId, $schoolId] = $this->tenantAndSchool('alpha');
        $userId = $this->user($schoolId);
        $membershipId = DB::table('tenant_user_memberships')->insertGetId([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'default_school_id' => $schoolId,
            'access_all_schools' => false,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $before = $this->identitySnapshot();
        $migration = $this->migration();

        $this->rollBackHardening($migration);
        Schema::table('schools', function ($table): void {
            $table->dropUnique('schools_tenant_code_unique');
            $table->unique('code', 'schools_code_unique');
        });

        $this->migrateHardening($migration);

        $this->assertSame($before, $this->identitySnapshot());
        $this->assertTrue($this->hasIndex('schools', 'schools_tenant_code_unique'));
        $this->assertFalse($this->hasIndex('schools', 'schools_code_unique'));
        $this->assertDatabaseHas('tenant_user_memberships', ['id' => $membershipId, 'tenant_id' => $tenantId]);
    }

    public function test_upgrade_backfills_existing_membership_school_without_losing_it(): void
    {
        $migration = $this->migration();
        $this->rollBackHardening($migration);
        [$tenantId, $schoolId] = $this->tenantAndSchool('alpha');
        $membershipId = DB::table('tenant_user_memberships')->insertGetId([
            'tenant_id' => $tenantId,
            'user_id' => $this->user($schoolId),
            'default_school_id' => $schoolId,
            'access_all_schools' => false,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $pivotId = DB::table('tenant_membership_schools')->insertGetId([
            'tenant_user_membership_id' => $membershipId,
            'school_id' => $schoolId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $this->migrateHardening($migration);
        } catch (\Throwable $exception) {
            $this->fail('Expected the legacy membership school to be backfilled: '.$exception->getMessage());
        }

        $this->assertDatabaseHas('tenant_membership_schools', [
            'id' => $pivotId,
            'tenant_id' => $tenantId,
            'tenant_user_membership_id' => $membershipId,
            'school_id' => $schoolId,
        ]);
    }

    public function test_upgrade_preflight_rejects_school_without_tenant_before_schema_changes(): void
    {
        $migration = $this->migration();
        $this->rollBackHardening($migration);
        $schoolId = DB::table('schools')->insertGetId([
            'tenant_id' => null,
            'code' => 'ORPHAN',
            'name' => 'Orphan School',
            'receipt_prefix' => 'ORPHAN',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $migration->up();
            $this->fail('Expected tenant hardening preflight to fail.');
        } catch (\Throwable $exception) {
            $this->assertInstanceOf(\RuntimeException::class, $exception);
            $this->assertSame("Tenant hardening blocked: school {$schoolId} has no tenant_id.", $exception->getMessage());
        }

        $this->assertFalse(Schema::hasColumn('tenant_membership_schools', 'tenant_id'));
        $this->assertTrue($this->hasIndex('schools', 'schools_tenant_code_unique'));
    }

    public function test_upgrade_preflight_rejects_cross_tenant_allowed_school(): void
    {
        $migration = $this->migration();
        $this->rollBackHardening($migration);
        [$firstTenant, $firstSchool] = $this->tenantAndSchool('alpha');
        [, $secondSchool] = $this->tenantAndSchool('beta');
        $membershipId = DB::table('tenant_user_memberships')->insertGetId([
            'tenant_id' => $firstTenant,
            'user_id' => $this->user($firstSchool),
            'default_school_id' => $firstSchool,
            'access_all_schools' => false,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $pivotId = DB::table('tenant_membership_schools')->insertGetId([
            'tenant_user_membership_id' => $membershipId,
            'school_id' => $secondSchool,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $migration->up();
            $this->fail('Expected tenant hardening preflight to fail.');
        } catch (\Throwable $exception) {
            $this->assertInstanceOf(\RuntimeException::class, $exception);
            $this->assertSame("Tenant hardening blocked: membership school {$pivotId} crosses tenants.", $exception->getMessage());
        }

        $this->assertFalse(Schema::hasColumn('tenant_membership_schools', 'tenant_id'));
    }

    public function test_upgrade_preflight_rejects_duplicate_primary_domains(): void
    {
        $migration = $this->migration();
        $this->rollBackHardening($migration);
        [$tenantId] = $this->tenantAndSchool('alpha');
        foreach (['one', 'two'] as $label) {
            DB::table('tenant_domains')->insert([
                'tenant_id' => $tenantId,
                'hostname' => "alpha-{$label}.example.test",
                'surface' => 'admin',
                'is_primary' => true,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        try {
            $migration->up();
            $this->fail('Expected tenant hardening preflight to fail.');
        } catch (\Throwable $exception) {
            $this->assertInstanceOf(\RuntimeException::class, $exception);
            $this->assertSame("Tenant hardening blocked: tenant {$tenantId} has multiple primary admin domains.", $exception->getMessage());
        }

        $this->assertFalse(Schema::hasColumn('tenant_domains', 'primary_surface'));
    }

    /** @return array{int, int} */
    private function tenantAndSchool(string $slug): array
    {
        $tenantId = DB::table('tenants')->insertGetId([
            'slug' => $slug,
            'name' => ucfirst($slug),
            'status' => 'active',
            'timezone' => 'Asia/Kuala_Lumpur',
            'locale' => 'en',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $schoolId = DB::table('schools')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => strtoupper($slug),
            'name' => ucfirst($slug).' School',
            'receipt_prefix' => strtoupper($slug),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$tenantId, $schoolId];
    }

    private function user(int $schoolId): int
    {
        return DB::table('users')->insertGetId([
            'school_id' => $schoolId,
            'name' => 'Tenant User '.$schoolId,
            'username' => 'tenant-user-'.$schoolId,
            'password' => 'password',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function migration(): Migration
    {
        return require database_path('migrations/2026_08_15_000001_harden_tenant_foundation.php');
    }

    private function rollBackHardening(Migration $migration): void
    {
        $migration->down();
        DB::table('migrations')->where('migration', '2026_08_15_000001_harden_tenant_foundation')->delete();
    }

    private function migrateHardening(Migration $migration): void
    {
        $migration->up();
        DB::table('migrations')->insert([
            'migration' => '2026_08_15_000001_harden_tenant_foundation',
            'batch' => ((int) DB::table('migrations')->max('batch')) + 1,
        ]);
    }

    /** @return array<string, list<int>> */
    private function identitySnapshot(): array
    {
        return collect(['tenants', 'schools', 'users', 'tenant_user_memberships', 'tenant_membership_schools'])
            ->mapWithKeys(fn (string $table): array => [$table => DB::table($table)->orderBy('id')->pluck('id')->map(fn ($id): int => (int) $id)->all()])
            ->all();
    }

    private function hasIndex(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))->contains(fn (array $index): bool => $index['name'] === $name);
    }
}
