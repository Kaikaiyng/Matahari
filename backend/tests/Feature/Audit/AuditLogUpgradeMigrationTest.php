<?php

namespace Tests\Feature\Audit;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogUpgradeMigrationTest extends TestCase
{
    public function test_upgrade_preserves_and_backfills_existing_audit_rows(): void
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

            $legacyId = DB::table('audit_logs')->insertGetId([
                'action' => 'student.updated',
                'old_values' => json_encode(['notes' => 'A'], JSON_THROW_ON_ERROR),
                'new_values' => json_encode(['notes' => 'B'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $migration = require database_path('migrations/2026_07_31_000001_expand_audit_logs_for_secure_events.php');
            $migration->up();

            $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();

            $this->assertSame('student.updated', $legacy->action);
            $this->assertTrue(Str::isUuid($legacy->event_uuid));
            $this->assertSame('legacy', $legacy->module);
            $this->assertSame('system', $legacy->context_type);
            $this->assertSame(1, $legacy->schema_version);
            $this->assertTrue(Schema::hasColumns('audit_logs', [
                'request_id',
                'actor_roles',
                'metadata',
                'related_audit_id',
            ]));
        } finally {
            DB::setDefaultConnection($originalDefault);
            DB::purge('audit_upgrade');
        }
    }
}
