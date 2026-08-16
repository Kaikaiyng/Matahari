<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\FeeAgreement;
use App\Models\FeeRecordCharge;
use App\Models\PortalNotification;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class ParentFinanceReminderApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_authorized_admin_sends_current_balance_to_only_eligible_guardians(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $this->createOutstanding($student);

        $this->actingAs($admin)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertCreated()
            ->assertJsonPath('data.student_id', $student->id)
            ->assertJsonPath('data.academic_year', '2026')
            ->assertJsonPath('data.outstanding_amount', 2670)
            ->assertJsonPath('data.recipient_count', 1);

        $this->assertDatabaseHas('portal_notifications', [
            'school_id' => $student->school_id,
            'recipient_user_id' => $parent->id,
            'type' => 'payment_reminder',
        ]);
        $notification = PortalNotification::query()->sole();
        $this->assertSame($student->id, $notification->context_json['student_id']);
        $this->assertSame('2026', $notification->context_json['academic_year']);
        $this->assertSame(2670.0, (float) $notification->context_json['outstanding_amount']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.reminder_sent',
            'entity_type' => 'student',
            'entity_id' => $student->id,
        ]);
    }

    public function test_user_without_reminder_permission_is_forbidden(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();

        $this->actingAs($parent)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertForbidden();

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    public function test_reminder_rejects_a_student_without_a_confirmed_current_enrolment(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();

        $this->actingAs($admin)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('academic_year');

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    public function test_reminder_rejects_a_student_from_another_school(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $otherSchool = $this->createTenantSchool([
            'name' => 'Other School',
            'code' => 'OTHER',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $student = Student::query()->create([
            'school_id' => $otherSchool->id,
            'student_no' => 'OTHER-001',
            'full_name' => 'Other Student',
            'level_group' => 'primary',
            'registration_date' => '2026-01-01',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertForbidden();

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    public function test_reminder_requires_positive_current_outstanding(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        FeeRecordCharge::query()->where('student_id', $student->id)->delete();

        $this->actingAs($admin)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('outstanding');

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    public function test_reminder_requires_an_eligible_finance_guardian(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $this->createOutstanding($student);
        $student->parents()->updateExistingPivot(
            $student->parents()->where('full_name', 'Rachel Wong')->firstOrFail()->id,
            ['can_view_finance' => false],
        );

        $this->actingAs($admin)
            ->postJson("http://localhost/api/students/{$student->id}/payment-reminders")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recipients');

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    public function test_notification_creation_rolls_back_when_audit_persistence_fails(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $this->createOutstanding($student);
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });
        $this->withoutExceptionHandling();

        try {
            $this->actingAs($admin)
                ->postJson("http://localhost/api/students/{$student->id}/payment-reminders");
            $this->fail('The forced audit failure did not escape the request.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseCount('portal_notifications', 0);
    }

    private function createOutstanding(Student $student, string $amount = '2670.00'): FeeRecordCharge
    {
        $agreement = FeeAgreement::query()->create([
            'school_id' => $student->school_id,
            'student_id' => $student->id,
            'agreement_no' => 'TEST-'.$student->id,
            'academic_year' => '2026',
            'version_no' => 1,
            'payment_plan' => 'monthly',
            'effective_from' => '2026-01-01',
            'is_current' => false,
            'status' => 'draft',
        ]);

        return FeeRecordCharge::query()->create([
            'school_id' => $student->school_id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'academic_year' => '2026',
            'billing_month' => '2026-08',
            'fee_record_category' => 'TUITION',
            'fee_code' => 'TUITION',
            'description' => 'Tuition Fee August',
            'expected_amount' => $amount,
            'paid_amount_cached' => '0.00',
            'outstanding_amount_cached' => $amount,
            'billing_status' => 'billable',
            'collection_status' => 'unpaid',
            'charge_origin' => 'manual',
            'source_type' => 'manual',
            'activated_at' => now(),
        ]);
    }
}
