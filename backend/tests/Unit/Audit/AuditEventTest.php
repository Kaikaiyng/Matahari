<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use InvalidArgumentException;
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
