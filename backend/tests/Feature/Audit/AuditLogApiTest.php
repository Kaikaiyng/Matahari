<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_admin_can_list_and_view_audit_logs(): void
    {
        $this->seed();
        $log = $this->createLog(AuditAction::StudentCreated);

        $this->getJson('/api/audit-logs')->assertUnauthorized();

        foreach (['admin', 'finance'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->getJson('/api/audit-logs')->assertForbidden();
            $this->actingAs($user)->getJson("/api/audit-logs/{$log->id}")->assertForbidden();
        }

        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();
        $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.0.id', $log->id)
            ->assertJsonPath('data.0.action', 'student.created')
            ->assertJsonPath('meta.summary.total', 1)
            ->assertJsonPath('meta.summary.today', 1)
            ->assertJsonPath('meta.summary.active_actors_30_days', 0)
            ->assertJsonPath('meta.summary.security_admin', 0);
        $this->actingAs($superAdmin)
            ->getJson("/api/audit-logs/{$log->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $log->id);
    }

    public function test_list_searches_audit_identifiers_without_exposing_mutation_access(): void
    {
        $this->seed();
        $matching = $this->createLog(AuditAction::PaymentRecorded);
        $this->createLog(AuditAction::StudentCreated);
        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();

        $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs?search='.urlencode((string) $matching->entity_id))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonPath('meta.summary.total', 2);

        $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs?search='.urlencode('PAYMENT.RECORDED'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id);
    }

    public function test_list_uses_strict_filters_cursor_pagination_and_page_cap(): void
    {
        $this->seed();
        $first = $this->createLog(AuditAction::StudentCreated);
        $second = $this->createLog(AuditAction::StudentUpdated);
        $this->createLog(AuditAction::PaymentRecorded);
        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();

        $page = $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs?module=students&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.id', $second->id);

        $cursor = $page->json('meta.next_cursor');
        $this->assertNotEmpty($cursor);

        $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs?module=students&per_page=1&cursor='.urlencode($cursor))
            ->assertOk()
            ->assertJsonPath('data.0.id', $first->id);

        $this->actingAs($superAdmin)
            ->getJson('/api/audit-logs?per_page=101&action=made.up&module=unknown')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page', 'action', 'module']);
    }

    public function test_api_sanitizes_legacy_payloads_again_and_has_no_mutation_route(): void
    {
        $this->seed();
        $school = School::query()->firstOrFail();
        $log = AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => (string) Str::uuid7(),
            'school_id' => $school->id,
            'action' => AuditAction::StudentUpdated->value,
            'module' => AuditModule::Students->value,
            'entity_type' => AuditSubject::Student->value,
            'entity_id' => 99,
            'old_values' => ['notes' => 'Before', 'password' => 'legacy-secret'],
            'new_values' => ['notes' => 'After', 'nested' => ['csrf_token' => 'legacy-token']],
            'metadata' => ['cookie' => 'legacy-cookie', 'source' => 'legacy'],
            'context_type' => 'system',
            'schema_version' => 1,
        ]);
        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();

        $response = $this->actingAs($superAdmin)
            ->getJson("/api/audit-logs/{$log->id}")
            ->assertOk()
            ->assertJsonPath('data.old_values.notes', 'Before')
            ->assertJsonPath('data.new_values.notes', 'After')
            ->assertJsonPath('data.metadata.source', 'legacy');

        $encoded = $response->getContent();
        $this->assertStringNotContainsString('legacy-secret', $encoded);
        $this->assertStringNotContainsString('legacy-token', $encoded);
        $this->assertStringNotContainsString('legacy-cookie', $encoded);

        $this->actingAs($superAdmin)
            ->patchJson("/api/audit-logs/{$log->id}", ['reason' => 'rewrite'])
            ->assertMethodNotAllowed();
        $this->actingAs($superAdmin)
            ->deleteJson("/api/audit-logs/{$log->id}")
            ->assertMethodNotAllowed();
    }

    private function createLog(AuditAction $action): AuditLog
    {
        $school = School::query()->firstOrFail();

        return app(AuditLoggerContract::class)->record(new AuditEvent(
            action: $action,
            module: str_starts_with($action->value, 'payment.') ? AuditModule::Payments : AuditModule::Students,
            schoolId: $school->id,
            subjectType: str_starts_with($action->value, 'payment.') ? AuditSubject::Payment : AuditSubject::Student,
            // Unique fixture IDs cannot also match a UUID request-ID segment.
            subjectId: 9876543210000 + AuditLog::query()->count(),
            newValues: ['status' => 'safe'],
        ), (new AuditContextFactory)->system());
    }
}
