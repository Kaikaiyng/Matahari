<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_fresh_schema_contains_secure_audit_columns(): void
    {
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
    }

    public function test_event_uuid_is_unique(): void
    {
        $uuid = (string) Str::uuid7();
        $base = [
            'event_uuid' => $uuid,
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'context_type' => 'system',
            'schema_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('audit_logs')->insert($base);

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->insert([
            ...$base,
            'request_id' => (string) Str::uuid7(),
        ]);
    }

    public function test_model_casts_json_snapshots_and_metadata_to_arrays(): void
    {
        $log = AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'old_values' => ['status' => 'active'],
            'new_values' => ['status' => 'inactive'],
            'metadata' => ['source' => 'test'],
            'actor_roles' => ['super-admin'],
            'context_type' => 'system',
            'schema_version' => 1,
        ]);

        $this->assertSame(['status' => 'active'], $log->old_values);
        $this->assertSame(['status' => 'inactive'], $log->new_values);
        $this->assertSame(['source' => 'test'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
    }
}
