<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class AuditLogImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_log_cannot_be_updated(): void
    {
        $log = $this->auditLog();

        try {
            $log->update(['action' => 'tampered']);
            $this->fail('Audit update should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be updated.', $exception->getMessage());
        }

        $this->assertSame('legacy.test', $log->fresh()->action);
    }

    public function test_existing_log_cannot_be_saved(): void
    {
        $log = $this->auditLog();
        $log->action = 'tampered';

        try {
            $log->save();
            $this->fail('Audit save should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be updated.', $exception->getMessage());
        }

        $this->assertSame('legacy.test', $log->fresh()->action);
    }

    public function test_existing_log_cannot_be_saved_quietly(): void
    {
        $log = $this->auditLog();
        $log->action = 'tampered';

        try {
            $log->saveQuietly();
            $this->fail('Quiet audit save should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be updated.', $exception->getMessage());
        }

        $this->assertSame('legacy.test', $log->fresh()->action);
    }

    public function test_existing_log_cannot_be_deleted(): void
    {
        $log = $this->auditLog();

        try {
            $log->delete();
            $this->fail('Audit delete should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be deleted.', $exception->getMessage());
        }

        $this->assertDatabaseHas('audit_logs', ['id' => $log->id]);
    }

    public function test_existing_log_cannot_be_incremented_or_decremented(): void
    {
        $operations = [
            'increment' => fn (AuditLog $log) => $log->increment('schema_version'),
            'decrement' => fn (AuditLog $log) => $log->decrement('schema_version'),
            'incrementQuietly' => fn (AuditLog $log) => $log->incrementQuietly('schema_version'),
            'decrementQuietly' => fn (AuditLog $log) => $log->decrementQuietly('schema_version'),
            'incrementEach' => fn (AuditLog $log) => $log->incrementEach(['schema_version' => 1]),
            'decrementEach' => fn (AuditLog $log) => $log->decrementEach(['schema_version' => 1]),
        ];

        foreach ($operations as $operation => $mutate) {
            $log = $this->auditLog();
            $exception = null;

            try {
                $mutate($log);
            } catch (LogicException $exception) {
                // The assertion below verifies this is the expected append-only guard.
            }

            $this->assertSame(1, $log->fresh()->schema_version, "Audit {$operation} should not mutate the persisted row.");
            $this->assertInstanceOf(LogicException::class, $exception);
            $this->assertSame('Audit logs are append-only and cannot be updated.', $exception->getMessage());
        }
    }

    private function auditLog(): AuditLog
    {
        return AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'context_type' => 'system',
            'schema_version' => 1,
        ]);
    }
}
