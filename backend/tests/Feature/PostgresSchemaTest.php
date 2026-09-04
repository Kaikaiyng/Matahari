<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PostgresSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_postgres_preserves_financial_and_tenant_database_guards(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('PostgreSQL schema inspection requires the disposable matahari_test database.');
        }

        $this->assertStringContainsString('PostgreSQL', DB::selectOne('SELECT version() AS version')->version);

        foreach ([
            ['fee_agreements', 'fee_agreements_one_current_unique', ['school_id', 'student_id', 'academic_year', 'current_slot']],
            ['fee_record_charges', 'fee_record_scheduled_item_month_unique', ['school_id', 'fee_agreement_item_id', 'billing_month']],
            ['tenant_domains', 'tenant_domains_one_primary_surface_unique', ['tenant_id', 'primary_surface']],
            ['audit_logs', 'audit_logs_event_uuid_unique', ['event_uuid']],
        ] as [$table, $name, $columns]) {
            $index = collect(Schema::getIndexes($table))->firstWhere('name', $name);
            $this->assertNotNull($index, $name);
            $this->assertTrue($index['unique'], $name);
            $this->assertSame($columns, $index['columns'], $name);
        }

        $amount = DB::selectOne("SELECT data_type, numeric_scale FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount'");
        $this->assertSame('numeric', $amount->data_type);
        $this->assertSame(2, (int) $amount->numeric_scale);

        foreach ([
            ['tenant_user_memberships', ['tenant_id', 'default_school_id'], 'schools', ['tenant_id', 'id']],
            ['tenant_membership_schools', ['tenant_id', 'school_id'], 'schools', ['tenant_id', 'id']],
            ['payment_allocations', ['fee_agreement_item_id'], 'fee_agreement_items', ['id']],
        ] as [$table, $columns, $foreignTable, $foreignColumns]) {
            $foreign = collect(Schema::getForeignKeys($table))->first(fn (array $key): bool => $key['columns'] === $columns);
            $this->assertNotNull($foreign, $table);
            $this->assertSame($foreignTable, $foreign['foreign_table']);
            $this->assertSame($foreignColumns, $foreign['foreign_columns']);
        }
    }
}
