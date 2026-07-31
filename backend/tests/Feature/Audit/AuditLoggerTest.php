<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditContextType;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\School;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Tests\TestCase;

class AuditLoggerTest extends TestCase
{
    use RefreshDatabase;

    public function test_container_binds_the_logger_contract(): void
    {
        $this->assertInstanceOf(AuditLogger::class, app(AuditLoggerContract::class));
    }

    public function test_logger_uses_affected_school_and_sanitizes_payloads(): void
    {
        $school = School::query()->create([
            'code' => 'AUD',
            'name' => 'Audit School',
            'receipt_prefix' => 'AUD',
            'invoice_prefix' => 'AUD-INV',
            'status' => 'active',
        ]);
        $actorSchool = School::query()->create([
            'code' => 'ACT',
            'name' => 'Actor School',
            'receipt_prefix' => 'ACT',
            'invoice_prefix' => 'ACT-INV',
            'status' => 'active',
        ]);
        $actor = User::factory()->create([
            'school_id' => $actorSchool->id,
            'username' => 'superadmin',
        ]);
        $requestId = (string) Str::uuid7();
        $context = new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::Http,
            actorId: $actor->id,
            actorUsername: 'superadmin',
            actorRoles: ['super-admin'],
            actorSchoolId: $actorSchool->id,
            ipAddress: '127.0.0.1',
            userAgent: 'Audit Test',
            routeName: 'students.update',
            httpMethod: 'PATCH',
        );
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: $school->id,
            subjectType: AuditSubject::Student,
            subjectId: 44,
            oldValues: ['notes' => 'A', 'password' => 'remove-me'],
            newValues: ['notes' => 'B', 'nested' => ['csrf_token' => 'remove-me']],
            metadata: ['source' => 'test', 'Cookie' => 'remove-me'],
        );

        $log = app(AuditLoggerContract::class)->record($event, $context);

        $this->assertTrue(Str::isUuid($log->event_uuid, 7));
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame($school->id, $log->school_id);
        $this->assertSame(['notes' => 'A'], $log->old_values);
        $this->assertSame(['notes' => 'B', 'nested' => []], $log->new_values);
        $this->assertSame(['source' => 'test'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
        $this->assertSame('student', $log->entity_type);
        $this->assertSame(44, $log->entity_id);
    }

    public function test_logger_uses_actor_school_when_event_has_no_school(): void
    {
        $actorSchool = School::query()->create([
            'code' => 'FBK',
            'name' => 'Fallback School',
            'receipt_prefix' => 'FBK',
            'invoice_prefix' => 'FBK-INV',
            'status' => 'active',
        ]);
        $context = new AuditContext(
            requestId: (string) Str::uuid7(),
            contextType: AuditContextType::Console,
            actorSchoolId: $actorSchool->id,
        );
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
        );

        $log = app(AuditLoggerContract::class)->record($event, $context);

        $this->assertSame($actorSchool->id, $log->school_id);
    }

    public function test_logger_never_stores_mixed_case_nested_request_or_file_envelopes(): void
    {
        $context = new AuditContext(
            requestId: (string) Str::uuid7(),
            contextType: AuditContextType::System,
        );
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            oldValues: [
                'HEAD-ERS' => 'Authorization: Bearer exposed',
                'token_count' => 4,
            ],
            newValues: [
                'profile' => [
                    'Request Body' => '{"password":"exposed"}',
                    'session_duration' => 900,
                ],
            ],
            metadata: [
                'upload' => [
                    'FiLe_UpLoAdS' => ['identity-card.jpg'],
                    'file.contents' => 'opaque-binary-data',
                    'cookie_policy' => 'strict',
                ],
            ],
        );

        $log = app(AuditLoggerContract::class)->record($event, $context);

        $this->assertSame(['token_count' => 4], $log->old_values);
        $this->assertSame([
            'profile' => [
                'session_duration' => 900,
            ],
        ], $log->new_values);
        $this->assertSame([
            'upload' => [
                'cookie_policy' => 'strict',
            ],
        ], $log->metadata);
    }

    public function test_logger_boundary_rejects_non_uuidv7_request_id_without_storing_a_row(): void
    {
        try {
            app(AuditLoggerContract::class)->record(
                new AuditEvent(
                    action: AuditAction::StudentUpdated,
                    module: AuditModule::Students,
                ),
                new AuditContext(
                    requestId: '550e8400-e29b-41d4-a716-446655440000',
                    contextType: AuditContextType::System,
                ),
            );

            $this->fail('Expected a non-UUIDv7 request ID to be rejected.');
        } catch (InvalidArgumentException $exception) {
            $this->assertSame('Audit request ID must be a UUIDv7.', $exception->getMessage());
        }

        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_logger_boundary_rejects_non_uuidv7_batch_id_without_storing_a_row(): void
    {
        try {
            app(AuditLoggerContract::class)->record(
                new AuditEvent(
                    action: AuditAction::StudentUpdated,
                    module: AuditModule::Students,
                    batchId: '550e8400-e29b-41d4-a716-446655440000',
                ),
                new AuditContext(
                    requestId: (string) Str::uuid7(),
                    contextType: AuditContextType::System,
                ),
            );

            $this->fail('Expected a non-UUIDv7 batch ID to be rejected.');
        } catch (InvalidArgumentException $exception) {
            $this->assertSame('Audit batch ID must be a UUIDv7.', $exception->getMessage());
        }

        $this->assertDatabaseCount('audit_logs', 0);
    }
}
