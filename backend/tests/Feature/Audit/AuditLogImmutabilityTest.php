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
