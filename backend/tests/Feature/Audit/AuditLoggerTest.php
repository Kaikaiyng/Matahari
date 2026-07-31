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
        $actor = User::factory()->create([
            'school_id' => null,
            'username' => 'superadmin',
        ]);
        $requestId = (string) Str::uuid7();
        $context = new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::Http,
            actorId: $actor->id,
            actorUsername: 'superadmin',
            actorRoles: ['super-admin'],
            actorSchoolId: null,
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

        $this->assertTrue(Str::isUuid($log->event_uuid));
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame($school->id, $log->school_id);
        $this->assertSame(['notes' => 'A'], $log->old_values);
        $this->assertSame(['notes' => 'B', 'nested' => []], $log->new_values);
        $this->assertSame(['source' => 'test'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
        $this->assertSame('student', $log->entity_type);
        $this->assertSame(44, $log->entity_id);
    }
}
