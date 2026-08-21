<?php

namespace Tests\Feature\Operations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApplicationLogApiTest extends TestCase
{
    use RefreshDatabase;

    private string $logDirectory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->logDirectory = storage_path('framework/testing/application-logs-'.Str::uuid());
        File::ensureDirectoryExists($this->logDirectory);
        config()->set('logging.application_log_viewer_path', $this->logDirectory);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->logDirectory);

        parent::tearDown();
    }

    public function test_only_super_admin_can_read_sanitized_application_logs(): void
    {
        $this->seed();
        File::put($this->logDirectory.'/laravel.log', implode(PHP_EOL, [
            '[2026-08-21 10:00:00] testing.INFO: Health check completed {"route":"health"}',
            '[2026-08-21 10:01:00] testing.ERROR: Login failed password=plain-secret {"request_id":"request-1","password":"context-secret","nested":{"api_token":"token-secret"},"actor":"superadmin","ip":"127.0.0.1"}',
        ]).PHP_EOL);

        $this->getJson('/api/application-logs')->assertUnauthorized();

        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->actingAs($admin)->getJson('/api/application-logs')->assertForbidden();

        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();
        $response = $this->actingAs($superAdmin)
            ->getJson('/api/application-logs?level=ERROR&per_page=10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.level', 'ERROR')
            ->assertJsonPath('data.0.environment', 'testing')
            ->assertJsonPath('data.0.context.request_id', 'request-1')
            ->assertJsonPath('data.0.actor', 'superadmin')
            ->assertJsonPath('data.0.ip_address', '127.0.0.1')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.level_counts.ERROR', 1);

        $encoded = $response->getContent();
        $this->assertStringNotContainsString('plain-secret', $encoded);
        $this->assertStringNotContainsString('context-secret', $encoded);
        $this->assertStringNotContainsString('token-secret', $encoded);
    }

    public function test_logs_support_search_level_validation_and_page_pagination(): void
    {
        $this->seed();
        File::put($this->logDirectory.'/laravel.log', implode(PHP_EOL, [
            '[2026-08-21 10:00:00] testing.WARN: Queue is delayed {"job":"reminder"}',
            '[2026-08-21 10:01:00] testing.ERROR: Database request failed {"route":"payments.store"}',
            '[2026-08-21 10:02:00] testing.INFO: Request completed {"route":"dashboard"}',
        ]).PHP_EOL);
        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();

        $this->actingAs($superAdmin)
            ->getJson('/api/application-logs?search=request&per_page=1&page=2')
            ->assertOk()
            ->assertJsonPath('data.0.message', 'Database request failed')
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.total_pages', 2);

        $this->actingAs($superAdmin)
            ->getJson('/api/application-logs?level=DEBUG&per_page=101&page=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['level', 'per_page', 'page']);

        $this->actingAs($superAdmin)
            ->deleteJson('/api/application-logs')
            ->assertMethodNotAllowed();
    }
}
