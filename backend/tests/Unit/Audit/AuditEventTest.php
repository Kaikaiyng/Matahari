<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class AuditEventTest extends TestCase
{
    public function test_subject_type_and_id_must_be_supplied_together(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: 4,
            subjectType: AuditSubject::Student,
        );
    }

    public function test_blank_reason_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new AuditEvent(
            action: AuditAction::PaymentVoided,
            module: AuditModule::Payments,
            schoolId: 4,
            subjectType: AuditSubject::Payment,
            subjectId: 12,
            reason: '   ',
        );
    }

    #[DataProvider('invalidBatchIds')]
    public function test_non_null_batch_id_must_be_uuidv7(string $batchId): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Audit batch ID must be a UUIDv7.');

        new AuditEvent(
            action: AuditAction::PaymentVoided,
            module: AuditModule::Payments,
            batchId: $batchId,
        );
    }

    public function test_uuidv7_batch_id_is_preserved(): void
    {
        $batchId = (string) Str::uuid7();

        $event = new AuditEvent(
            action: AuditAction::PaymentVoided,
            module: AuditModule::Payments,
            batchId: $batchId,
        );

        $this->assertSame($batchId, $event->batchId);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidBatchIds(): array
    {
        return [
            'malformed' => ['not-a-uuid'],
            'uuidv4' => ['550e8400-e29b-41d4-a716-446655440000'],
        ];
    }

    public function test_valid_event_preserves_affected_school_and_changed_fields(): void
    {
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: 4,
            subjectType: AuditSubject::Student,
            subjectId: 12,
            oldValues: ['notes' => 'A'],
            newValues: ['notes' => 'B'],
        );

        $this->assertSame(4, $event->schoolId);
        $this->assertSame(['notes' => 'A'], $event->oldValues);
        $this->assertSame(['notes' => 'B'], $event->newValues);
    }
}
