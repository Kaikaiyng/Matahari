<?php

namespace Tests\Feature\Audit;

use Closure;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class AuditLogUpgradeMigrationTest extends TestCase
{
    private const REQUIRED_INDEXES = [
        'audit_logs_event_uuid_unique',
        'audit_logs_created_at_index',
        'audit_logs_request_id_index',
        'audit_logs_batch_id_index',
        'audit_logs_module_index',
        'audit_logs_action_index',
        'audit_logs_related_audit_id_index',
    ];

    public function test_upgrade_preserves_and_backfills_existing_audit_rows(): void
    {
        $this->withUpgradeDatabase(function (): void {
            $legacyId = $this->insertLegacyRow();

            $this->additionMigration()->up();
            $this->backfillMigration()->up();
            $this->constraintMigration()->up();

            $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();

            $this->assertSame('student.updated', $legacy->action);
            $this->assertSame('{"notes":"A"}', $legacy->old_values);
            $this->assertSame('{"notes":"B"}', $legacy->new_values);
            $this->assertTrue(Str::isUuid($legacy->event_uuid, 7));
            $this->assertSame('legacy', $legacy->module);
            $this->assertSame('system', $legacy->context_type);
            $this->assertSame(1, $legacy->schema_version);
            $this->assertTrue(Schema::hasColumns('audit_logs', [
                'request_id',
                'actor_roles',
                'metadata',
                'related_audit_id',
            ]));
        });
    }

    public function test_each_upgrade_stage_can_resume_from_partial_state(): void
    {
        $this->withUpgradeDatabase(function (): void {
            $legacyId = $this->insertLegacyRow();

            $additions = $this->additionMigration();
            $additions->up();
            $additions->up();

            $backfill = $this->backfillMigration();
            $backfill->up();
            $eventUuid = DB::table('audit_logs')->where('id', $legacyId)->value('event_uuid');

            DB::table('audit_logs')->where('id', $legacyId)->update(['module' => null]);

            $backfill->up();

            $this->assertSame(
                $eventUuid,
                DB::table('audit_logs')->where('id', $legacyId)->value('event_uuid'),
            );
            $this->assertSame(
                'legacy',
                DB::table('audit_logs')->where('id', $legacyId)->value('module'),
            );

            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->unique('event_uuid', 'audit_logs_event_uuid_unique');
            });

            $constraints = $this->constraintMigration();
            $constraints->up();
            $constraints->up();

            $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();
            $columns = collect(Schema::getColumns('audit_logs'))->keyBy('name');

            $this->assertSame('student.updated', $legacy->action);
            $this->assertSame('{"notes":"A"}', $legacy->old_values);
            $this->assertSame('{"notes":"B"}', $legacy->new_values);
            $this->assertSame($eventUuid, $legacy->event_uuid);
            $this->assertFalse($columns->get('event_uuid')['nullable']);
            $this->assertFalse($columns->get('module')['nullable']);
            $this->assertEqualsCanonicalizing(
                self::REQUIRED_INDEXES,
                array_values(array_intersect(
                    Schema::getIndexListing('audit_logs'),
                    self::REQUIRED_INDEXES,
                )),
            );
        });
    }

    public function test_constraint_stage_fails_closed_when_backfill_values_are_missing(): void
    {
        $this->withUpgradeDatabase(function (): void {
            $this->insertLegacyRow();
            $this->additionMigration()->up();

            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage(
                'Cannot enforce secure audit constraints while audit_logs.event_uuid contains null values.',
            );

            $this->constraintMigration()->up();
        });
    }

    public function test_rollback_removes_only_secure_audit_additions(): void
    {
        $this->withUpgradeDatabase(function (): void {
            $legacyId = $this->insertLegacyRow();
            $additions = $this->additionMigration();
            $backfill = $this->backfillMigration();
            $constraints = $this->constraintMigration();

            $additions->up();
            $backfill->up();
            $constraints->up();

            $constraints->down();
            $constraints->down();
            $backfill->down();
            $backfill->down();
            $additions->down();
            $additions->down();

            $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();

            $this->assertSame('student.updated', $legacy->action);
            $this->assertSame('{"notes":"A"}', $legacy->old_values);
            $this->assertSame('{"notes":"B"}', $legacy->new_values);
            $this->assertTrue(Schema::hasColumns('audit_logs', [
                'id',
                'action',
                'old_values',
                'new_values',
                'created_at',
                'updated_at',
            ]));
            $this->assertFalse(Schema::hasColumn('audit_logs', 'event_uuid'));
            $this->assertSame([], array_values(array_intersect(
                Schema::getIndexListing('audit_logs'),
                self::REQUIRED_INDEXES,
            )));
        });
    }

    private function withUpgradeDatabase(Closure $callback): void
    {
        Config::set('database.connections.audit_upgrade', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('audit_upgrade');
        $originalDefault = DB::getDefaultConnection();
        DB::setDefaultConnection('audit_upgrade');

        try {
            Schema::create('audit_logs', function (Blueprint $table): void {
                $table->id();
                $table->string('action', 100);
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->timestamps();
            });

            $callback();
        } finally {
            DB::setDefaultConnection($originalDefault);
            DB::purge('audit_upgrade');
        }
    }

    private function insertLegacyRow(): int
    {
        return DB::table('audit_logs')->insertGetId([
            'action' => 'student.updated',
            'old_values' => json_encode(['notes' => 'A'], JSON_THROW_ON_ERROR),
            'new_values' => json_encode(['notes' => 'B'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function additionMigration(): object
    {
        return require database_path('migrations/2026_07_31_000001_add_secure_audit_columns.php');
    }

    private function backfillMigration(): object
    {
        return require database_path('migrations/2026_07_31_000002_backfill_secure_audit_columns.php');
    }

    private function constraintMigration(): object
    {
        return require database_path('migrations/2026_07_31_000003_enforce_secure_audit_invariants.php');
    }
}
