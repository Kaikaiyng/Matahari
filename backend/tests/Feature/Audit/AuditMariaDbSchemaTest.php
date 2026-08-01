<?php

namespace Tests\Feature\Audit;

require_once __DIR__.'/../../Support/MariaDbDestructiveTestGate.php';

use App\Models\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\MariaDbDestructiveTestGate;
use Tests\TestCase;

#[Group('mariadb')]
class AuditMariaDbSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $connectionName = DB::getDefaultConnection();
        $environmentDatabaseUrl = Env::get('DB_URL');
        $configuredDatabaseUrl = config("database.connections.{$connectionName}.url");
        $databaseUrl = (string) $environmentDatabaseUrl !== ''
            ? (string) $environmentDatabaseUrl
            : (is_string($configuredDatabaseUrl) ? $configuredDatabaseUrl : null);

        $decision = MariaDbDestructiveTestGate::evaluate(
            optIn: (string) Env::get('AUDIT_MARIADB_DESTRUCTIVE_TEST', ''),
            driver: DB::connection($connectionName)->getDriverName(),
            databaseUrl: $databaseUrl,
            configuredDatabase: (string) config("database.connections.{$connectionName}.database"),
            probe: static function (): array {
                $database = DB::selectOne('SELECT DATABASE() AS database_name');
                $version = DB::selectOne('SELECT VERSION() AS server_version');

                return [
                    'database' => $database?->database_name,
                    'version' => $version?->server_version,
                ];
            },
        );

        if ($decision === MariaDbDestructiveTestGate::SKIP) {
            $this->markTestSkipped(
                'Destructive MariaDB audit tests require AUDIT_MARIADB_DESTRUCTIVE_TEST=1.',
            );
        }

        $this->artisan('migrate:fresh', ['--force' => true])->assertExitCode(0);
    }

    public function test_secure_fresh_schema_round_trips_native_json(): void
    {
        $eventUuid = (string) Str::uuid7();

        $this->assertTrue(Schema::hasColumns('audit_logs', [
            'event_uuid',
            'request_id',
            'batch_id',
            'actor_username',
            'actor_roles',
            'module',
            'metadata',
            'reason',
            'related_audit_id',
            'route_name',
            'http_method',
            'context_type',
            'schema_version',
        ]));

        $log = AuditLog::query()->create([
            'event_uuid' => $eventUuid,
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'old_values' => ['amount' => '100.00'],
            'new_values' => ['amount' => '120.00'],
            'metadata' => ['driver' => DB::getDriverName()],
            'actor_roles' => ['super-admin'],
            'context_type' => 'system',
            'schema_version' => 1,
        ])->fresh();

        $this->assertSame(['amount' => '100.00'], $log->old_values);
        $this->assertSame(['amount' => '120.00'], $log->new_values);
        $this->assertSame(['driver' => 'mariadb'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
        $this->assertSame($eventUuid, $log->event_uuid);
    }

    public function test_duplicate_event_uuid_is_rejected(): void
    {
        $eventUuid = (string) Str::uuid7();
        $row = $this->validRawAuditRow($eventUuid);

        DB::table('audit_logs')->insert($row);

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->insert([
            ...$row,
            'request_id' => (string) Str::uuid7(),
        ]);
    }

    public function test_required_named_indexes_exist(): void
    {
        $indexes = collect(DB::select(
            <<<'SQL'
                SELECT DISTINCT INDEX_NAME AS index_name
                FROM information_schema.statistics
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'audit_logs'
                SQL,
        ))->pluck('index_name')->all();

        $this->assertEqualsCanonicalizing([
            'audit_logs_event_uuid_unique',
            'audit_logs_created_at_index',
            'audit_logs_request_id_index',
            'audit_logs_batch_id_index',
            'audit_logs_module_index',
            'audit_logs_action_index',
            'audit_logs_related_audit_id_index',
        ], array_values(array_intersect($indexes, [
            'audit_logs_event_uuid_unique',
            'audit_logs_created_at_index',
            'audit_logs_request_id_index',
            'audit_logs_batch_id_index',
            'audit_logs_module_index',
            'audit_logs_action_index',
            'audit_logs_related_audit_id_index',
        ])));
    }

    public function test_payment_allocation_foreign_key_is_exact_and_idempotent(): void
    {
        $migration = require database_path(
            'migrations/2026_06_30_000006_ensure_payment_allocation_fee_agreement_item_foreign_key.php',
        );

        $migration->up();
        $migration->up();

        $foreignKeys = array_values(array_filter(
            Schema::getForeignKeys('payment_allocations'),
            static fn (array $foreignKey): bool => in_array(
                'fee_agreement_item_id',
                $foreignKey['columns'],
                true,
            ),
        ));
        $column = collect(Schema::getColumns('payment_allocations'))
            ->firstWhere('name', 'fee_agreement_item_id');

        $this->assertSame([[
            'name' => 'payment_allocations_fee_agreement_item_ensured_foreign',
            'columns' => ['fee_agreement_item_id'],
            'foreign_schema' => 'matahari_audit_test',
            'foreign_table' => 'fee_agreement_items',
            'foreign_columns' => ['id'],
            'on_update' => 'restrict',
            'on_delete' => 'set null',
        ]], $foreignKeys);
        $this->assertSame('bigint', $column['type_name']);
        $this->assertStringContainsString('unsigned', $column['type']);
        $this->assertTrue($column['nullable']);
    }

    public function test_constraint_stage_rejects_a_same_named_fulltext_index(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropIndex('audit_logs_module_index');
        });
        DB::statement(
            'CREATE FULLTEXT INDEX audit_logs_module_index ON audit_logs (module)',
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage(
            'Cannot manage secure audit index audit_logs_module_index because MariaDB/MySQL reports a non-BTREE or prefix definition.',
        );

        $constraints = require database_path(
            'migrations/2026_07_31_000003_enforce_secure_audit_invariants.php',
        );
        $constraints->up();
    }

    public function test_constraint_stage_rejects_a_same_named_prefix_index(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropIndex('audit_logs_module_index');
        });
        DB::statement(
            'CREATE INDEX audit_logs_module_index ON audit_logs (module(20))',
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage(
            'Cannot manage secure audit index audit_logs_module_index because MariaDB/MySQL reports a non-BTREE or prefix definition.',
        );

        $constraints = require database_path(
            'migrations/2026_07_31_000003_enforce_secure_audit_invariants.php',
        );
        $constraints->up();
    }

    public function test_invalid_native_json_is_rejected(): void
    {
        $invalidRow = [
            ...$this->validRawAuditRow((string) Str::uuid7()),
            'old_values' => '{"invalid":',
        ];

        try {
            DB::table('audit_logs')->insert($invalidRow);
            $this->fail('MariaDB accepted invalid JSON in audit_logs.old_values.');
        } catch (QueryException) {
            DB::table('audit_logs')->insert([
                ...$invalidRow,
                'old_values' => json_encode(['valid' => true], JSON_THROW_ON_ERROR),
            ]);
        }

        $this->assertSame(1, DB::table('audit_logs')->count());
    }

    public function test_populated_legacy_row_survives_secure_upgrade_with_backfill(): void
    {
        Schema::drop('audit_logs');
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('action', 100);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->timestamps();
        });

        $legacyId = DB::table('audit_logs')->insertGetId([
            'action' => 'student.updated',
            'old_values' => json_encode(['notes' => 'A'], JSON_THROW_ON_ERROR),
            'new_values' => json_encode(['notes' => 'B'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $additions = require database_path('migrations/2026_07_31_000001_add_secure_audit_columns.php');
        $backfill = require database_path('migrations/2026_07_31_000002_backfill_secure_audit_columns.php');
        $constraints = require database_path('migrations/2026_07_31_000003_enforce_secure_audit_invariants.php');

        $additions->up();
        $additions->up();
        $backfill->up();

        $eventUuid = DB::table('audit_logs')->where('id', $legacyId)->value('event_uuid');

        DB::table('audit_logs')->where('id', $legacyId)->update(['module' => null]);

        $backfill->up();
        $constraints->up();
        $constraints->up();

        $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();

        $this->assertSame('student.updated', $legacy->action);
        $this->assertSame('{"notes":"A"}', $legacy->old_values);
        $this->assertSame('{"notes":"B"}', $legacy->new_values);
        $this->assertTrue(Str::isUuid($legacy->event_uuid, 7));
        $this->assertSame($eventUuid, $legacy->event_uuid);
        $this->assertSame('legacy', $legacy->module);
        $this->assertSame('system', $legacy->context_type);
        $this->assertSame(1, $legacy->schema_version);
    }

    /**
     * @return array<string, mixed>
     */
    private function validRawAuditRow(string $eventUuid): array
    {
        return [
            'event_uuid' => $eventUuid,
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'context_type' => 'system',
            'schema_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
