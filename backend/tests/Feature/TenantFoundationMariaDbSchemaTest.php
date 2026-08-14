<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('mariadb-tenant-foundation')]
class TenantFoundationMariaDbSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mariadb') {
            $this->markTestSkipped('This schema inspection requires a migrated disposable MariaDB database.');
        }

        $version = DB::selectOne('SELECT VERSION() AS server_version');
        $this->assertStringContainsString('MariaDB', (string) $version?->server_version);
    }

    public function test_tenant_tables_and_critical_foreign_keys_exist_on_mariadb(): void
    {
        foreach ([
            'tenants', 'tenant_brandings', 'tenant_domains', 'tenant_features',
            'tenant_user_memberships', 'tenant_membership_schools', 'tenant_membership_roles',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected {$table} on MariaDB.");
        }

        $this->assertForeignKey('tenant_brandings', 'tenant_id', 'tenants', 'CASCADE');
        $this->assertForeignKey('tenant_domains', 'tenant_id', 'tenants', 'CASCADE');
        $this->assertForeignKey('tenant_features', 'tenant_id', 'tenants', 'CASCADE');
        $this->assertForeignKey('schools', 'tenant_id', 'tenants', 'RESTRICT');
        $this->assertForeignKey('tenant_user_memberships', 'tenant_id', 'tenants', 'CASCADE');
        $this->assertForeignKey('tenant_user_memberships', 'user_id', 'users', 'CASCADE');
        $this->assertForeignKey('tenant_user_memberships', 'default_school_id', 'schools', 'SET NULL');
        $this->assertForeignKey('tenant_membership_schools', 'tenant_user_membership_id', 'tenant_user_memberships', 'CASCADE');
        $this->assertForeignKey('tenant_membership_roles', 'tenant_user_membership_id', 'tenant_user_memberships', 'CASCADE');
    }

    public function test_tenant_uniqueness_indexes_are_exact_on_mariadb(): void
    {
        $this->assertIndex('tenant_domains', 'tenant_domains_hostname_unique', ['hostname'], true);
        $this->assertIndex('tenant_features', 'tenant_features_tenant_id_feature_key_unique', ['tenant_id', 'feature_key'], true);
        $this->assertIndex('tenant_user_memberships', 'tenant_user_memberships_tenant_id_user_id_unique', ['tenant_id', 'user_id'], true);
        $this->assertIndex('tenant_membership_schools', 'tenant_membership_school_unique', ['tenant_user_membership_id', 'school_id'], true);
        $this->assertIndex('tenant_membership_roles', 'tenant_membership_role_unique', ['tenant_user_membership_id', 'role_id'], true);
        $this->assertIndex('schools', 'schools_tenant_code_unique', ['tenant_id', 'code'], true);
    }

    private function assertForeignKey(string $table, string $column, string $referencedTable, string $deleteRule): void
    {
        $foreignKey = DB::selectOne(
            <<<'SQL'
                SELECT kcu.REFERENCED_TABLE_NAME AS referenced_table,
                       rc.DELETE_RULE AS delete_rule
                FROM information_schema.KEY_COLUMN_USAGE kcu
                INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
                    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
                    AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
                  AND kcu.TABLE_NAME = ?
                  AND kcu.COLUMN_NAME = ?
                  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
                SQL,
            [$table, $column],
        );

        $this->assertNotNull($foreignKey, "Missing {$table}.{$column} foreign key.");
        $this->assertSame($referencedTable, $foreignKey->referenced_table);
        $this->assertSame($deleteRule, $foreignKey->delete_rule);
    }

    /** @param list<string> $expectedColumns */
    private function assertIndex(string $table, string $name, array $expectedColumns, bool $unique): void
    {
        $rows = DB::select(
            <<<'SQL'
                SELECT NON_UNIQUE AS non_unique,
                       SEQ_IN_INDEX AS sequence_number,
                       COLUMN_NAME AS column_name
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND INDEX_NAME = ?
                ORDER BY SEQ_IN_INDEX
                SQL,
            [$table, $name],
        );

        $this->assertNotEmpty($rows, "Missing {$table}.{$name} index.");
        $this->assertSame($expectedColumns, array_map(
            static fn (object $row): string => $row->column_name,
            $rows,
        ));
        $this->assertSame($unique ? 0 : 1, (int) $rows[0]->non_unique);
    }
}
