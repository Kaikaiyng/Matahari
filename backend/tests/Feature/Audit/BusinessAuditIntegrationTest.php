<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\FeeAgreement;
use App\Models\FeeItem;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class BusinessAuditIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_create_update_and_status_change_are_audited(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $studentId = $this->actingAs($admin)->postJson('/api/students', [
            'student_no' => 'MIS-2026-AUDIT',
            'full_name' => 'Audit Student',
            'level_group' => 'primary',
            'status' => 'active',
            'notes' => 'Initial note',
        ])->assertCreated()->json('student.id');

        $this->actingAs($admin)->patchJson("/api/students/{$studentId}", [
            'full_name' => 'Updated Audit Student',
            'notes' => 'Updated note',
        ])->assertOk();

        $this->actingAs($admin)->patchJson("/api/students/{$studentId}/status", [
            'status' => 'withdraw',
        ])->assertOk();

        $logs = AuditLog::query()->where('entity_type', 'student')->where('entity_id', $studentId)->get();

        $this->assertSame([
            'student.created',
            'student.updated',
            'student.status_changed',
        ], $logs->pluck('action')->all());
        $this->assertSame($admin->id, $logs->first()->user_id);
        $this->assertSame('Audit Student', $logs[0]->new_values['full_name']);
        $this->assertSame('Audit Student', $logs[1]->old_values['full_name']);
        $this->assertSame('Updated Audit Student', $logs[1]->new_values['full_name']);
        $this->assertSame('active', $logs[2]->old_values['status']);
        $this->assertSame('withdraw', $logs[2]->new_values['status']);
    }

    public function test_agreement_payment_and_receipt_lifecycle_is_audited(): void
    {
        $this->seed();
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $student = Student::query()->where('school_id', $school->id)->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $finance = User::query()->where('username', 'finance')->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $misc = FeeItem::query()->where('school_id', $school->id)->where('code', 'MISC')->firstOrFail();

        $agreementId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])->assertCreated()->json('fee_agreement.id');

        $replacementId = $this->actingAs($admin)
            ->postJson("/api/fee-agreements/{$agreementId}/supersede", [
                'effective_from' => '2026-06-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 820],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])->assertCreated()->json('fee_agreement.id');

        $paymentId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'paid_by' => 'Parent Name',
                'amount' => 100,
                'allocations' => [[
                    'fee_item_id' => $tuition->id,
                    'amount' => 100,
                ]],
            ])->assertCreated()->json('payment.id');

        $this->actingAs($finance)->postJson("/api/payments/{$paymentId}/verify", [
            'received_date' => '2026-07-06',
        ])->assertOk();

        $receiptId = $this->actingAs($finance)
            ->postJson("/api/payments/{$paymentId}/receipts", [])
            ->assertCreated()->json('receipt.id');

        $this->actingAs($finance)->postJson("/api/receipts/{$receiptId}/void", [
            'void_reason' => 'Incorrect receipt date.',
        ])->assertOk();

        $this->actingAs($finance)->postJson("/api/payments/{$paymentId}/void", [
            'void_reason' => 'Duplicate bank transfer.',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'fee_agreement.created',
            'entity_type' => 'fee_agreement',
            'entity_id' => $agreementId,
            'user_id' => $admin->id,
        ]);
        $superseded = AuditLog::query()->where('action', 'fee_agreement.superseded')->firstOrFail();
        $this->assertSame($replacementId, $superseded->new_values['replacement_agreement_id']);

        foreach ([
            'payment.recorded',
            'payment.verified',
            'payment.voided',
            'receipt.issued',
            'receipt.voided',
        ] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action]);
        }

        $this->assertSame('Duplicate bank transfer.', AuditLog::query()
            ->where('action', 'payment.voided')->firstOrFail()->reason);
    }

    public function test_required_audit_failure_rolls_back_student_creation(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $before = Student::query()->count();
        $this->bindThrowingAuditLogger();

        $this->actingAs($admin)->postJson('/api/students', [
            'student_no' => 'MIS-ROLLBACK-STUDENT',
            'full_name' => 'Rollback Student',
            'level_group' => 'primary',
            'status' => 'active',
        ])->assertServerError();

        $this->assertSame($before, Student::query()->count());
    }

    public function test_required_audit_failure_rolls_back_agreement_and_payment_creation(): void
    {
        $this->seed();
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $student = Student::query()->where('school_id', $school->id)->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $misc = FeeItem::query()->where('school_id', $school->id)->where('code', 'MISC')->firstOrFail();
        $this->bindThrowingAuditLogger();

        $this->actingAs($admin)->postJson("/api/students/{$student->id}/fee-agreements", [
            'academic_year' => '2026',
            'payment_plan' => 'monthly',
            'effective_from' => '2026-01-01',
            'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => 800],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ],
        ])->assertServerError();
        $this->assertDatabaseCount('fee_agreements', 0);

        $this->actingAs($admin)->postJson("/api/students/{$student->id}/payments", [
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-05',
            'amount' => 100,
            'allocations' => [['fee_item_id' => $tuition->id, 'amount' => 100]],
        ])->assertServerError();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_required_audit_failure_rolls_back_payment_verification_and_receipt_issue(): void
    {
        $this->seed();
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $student = Student::query()->where('school_id', $school->id)->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $finance = User::query()->where('username', 'finance')->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();

        $pendingId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'paid_by' => 'Parent Name',
                'amount' => 100,
                'allocations' => [['fee_item_id' => $tuition->id, 'amount' => 100]],
            ])->assertCreated()->json('payment.id');

        $this->bindThrowingAuditLogger();

        $this->actingAs($finance)->postJson("/api/payments/{$pendingId}/verify", [
            'received_date' => '2026-07-06',
        ])->assertServerError();
        $this->assertSame('pending_verification', Payment::query()->findOrFail($pendingId)->status);

        $this->app->forgetInstance(AuditLoggerContract::class);
        $cashId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-05',
                'received_date' => '2026-07-05',
                'paid_by' => 'Parent Name',
                'amount' => 50,
                'allocations' => [['fee_item_id' => $tuition->id, 'amount' => 50]],
            ])->assertCreated()->json('payment.id');

        $this->bindThrowingAuditLogger();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$cashId}/receipts", [])
            ->assertServerError();
        $this->assertDatabaseCount('receipts', 0);
        $this->assertDatabaseCount('receipt_sequences', 0);
    }

    private function bindThrowingAuditLogger(): void
    {
        $this->app->instance(AuditLoggerContract::class, new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Audit storage unavailable.');
            }
        });
    }
}
