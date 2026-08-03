<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class AuthAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_failure_success_and_logout_are_audited_without_credentials(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'wrong-secret',
        ])->assertUnprocessable();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk();

        $logs = AuditLog::query()->orderBy('id')->get();
        $this->assertSame([
            'auth.login_failed',
            'auth.login_succeeded',
            'auth.logout',
        ], $logs->pluck('action')->all());
        $this->assertSame($admin->id, $logs[1]->user_id);
        $this->assertSame($admin->id, $logs[2]->user_id);
        $this->assertSame('invalid_credentials', $logs[0]->metadata['reason']);

        $encoded = $logs->toJson();
        $this->assertStringNotContainsString('wrong-secret', $encoded);
        $this->assertStringNotContainsString('password', $encoded);
        $this->assertStringNotContainsString('XSRF', $encoded);
    }

    public function test_inactive_login_is_audited_as_failure_with_generic_response(): void
    {
        $this->seed();
        User::query()->where('username', 'admin')->update(['status' => 'inactive']);

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertUnprocessable();

        $log = AuditLog::query()->firstOrFail();
        $this->assertSame('auth.login_failed', $log->action);
        $this->assertSame('inactive_account', $log->metadata['reason']);
    }

    public function test_authentication_and_logout_complete_safely_when_audit_storage_fails(): void
    {
        $this->seed();
        $this->bindThrowingAuditLogger();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'wrong-secret',
        ])->assertUnprocessable();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk();
        $this->getJson('/api/me')->assertUnauthorized();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    private function bindThrowingAuditLogger(): void
    {
        $this->app->instance(AuditLoggerContract::class, new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Audit storage unavailable with password=do-not-log.');
            }
        });
    }
}
