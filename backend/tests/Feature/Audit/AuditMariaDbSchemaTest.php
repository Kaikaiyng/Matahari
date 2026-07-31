<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('mariadb')]
class AuditMariaDbSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::getDriverName(), ['mariadb', 'mysql'], true)) {
            $this->markTestSkipped('Run with DB_CONNECTION=mariadb or mysql.');
        }
    }

    public function test_secure_audit_json_and_unique_uuid_use_real_mariadb(): void
    {
        $eventUuid = (string) Str::uuid7();

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
        ]);

        $this->assertSame(['amount' => '100.00'], $log->old_values);
        $this->assertSame(['amount' => '120.00'], $log->new_values);
        $this->assertSame($eventUuid, $log->event_uuid);
        $this->assertSame(1, DB::table('audit_logs')->where('event_uuid', $eventUuid)->count());
    }
}
