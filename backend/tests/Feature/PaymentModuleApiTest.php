<?php

namespace Tests\Feature;

use App\Models\FeeItem;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentModuleApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_admin_can_create_non_cash_payment_as_pending_verification(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');

        $response = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'amount' => 3000,
                'bank_account' => 'Maybank 1234567890',
                'reference_no' => 'BANK-REF-001',
                'payment_proof' => 'WhatsApp proof from parent',
                'remark' => 'July payment.',
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 3000],
                ],
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('payment.status', 'pending_verification')
            ->assertJsonPath('payment.payment_method', 'bank_transfer')
            ->assertJsonPath('payment.recorded_by.id', $admin->id)
            ->assertJsonPath('payment.verified_by', null)
            ->assertJsonPath('payment.allocations.0.fee_code', 'TUITION')
            ->assertJsonPath('payment.allocations.0.description', 'Tuition Fee');

        $this->assertDatabaseHas('payments', [
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_method' => 'bank_transfer',
            'status' => 'pending_verification',
            'recorded_by' => $admin->id,
            'verified_by' => null,
        ]);
    }

    public function test_school_admin_cannot_verify_non_cash_payment(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-06',
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'pending_verification',
            'verified_by' => null,
        ]);
    }

    public function test_school_admin_can_create_cash_payment_as_verified(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-05',
                'received_date' => '2026-07-05',
                'amount' => 500,
                'remark' => 'Cash received at office.',
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 500],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'verified')
            ->assertJsonPath('payment.recorded_by.id', $admin->id)
            ->assertJsonPath('payment.verified_by.id', $admin->id);

        $payment = Payment::query()->firstOrFail();

        $this->assertSame('verified', $payment->status);
        $this->assertSame($admin->id, $payment->recorded_by);
        $this->assertSame($admin->id, $payment->verified_by);
        $this->assertNotNull($payment->verified_at);
    }

    public function test_finance_can_verify_pending_non_cash_payment(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.verify']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-06',
                'bank_account' => 'Maybank 1234567890',
                'reference_no' => 'BANK-REF-001',
                'remark' => 'Matched to bank statement.',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'verified')
            ->assertJsonPath('payment.verified_by.id', $finance->id);

        $payment->refresh();

        $this->assertSame('verified', $payment->status);
        $this->assertSame($finance->id, $payment->verified_by);
        $this->assertSame('2026-07-06', $payment->received_date->toDateString());
    }

    public function test_verify_requires_received_date(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.verify']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['received_date']);
    }

    public function test_cannot_verify_voided_or_already_verified_payment(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.verify', 'payments.void']);
        $voidedPayment = $this->pendingPayment($school, $student, $admin, 'VOID-ME');
        $verifiedPayment = $this->pendingPayment($school, $student, $admin, 'VERIFY-ME');

        $this->actingAs($finance)
            ->postJson("/api/payments/{$voidedPayment->id}/void", [
                'void_reason' => 'Wrong student.',
            ])
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$voidedPayment->id}/verify", [
                'received_date' => '2026-07-06',
            ])
            ->assertUnprocessable();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$verifiedPayment->id}/verify", [
                'received_date' => '2026-07-06',
            ])
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$verifiedPayment->id}/verify", [
                'received_date' => '2026-07-07',
            ])
            ->assertUnprocessable();
    }

    public function test_finance_can_void_payment_with_reason(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.void']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/void", [
                'void_reason' => 'Duplicate bank reference.',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'voided')
            ->assertJsonPath('payment.voided_by.id', $finance->id)
            ->assertJsonPath('payment.void_reason', 'Duplicate bank reference.');

        $payment->refresh();

        $this->assertSame('voided', $payment->status);
        $this->assertSame($finance->id, $payment->voided_by);
        $this->assertNotNull($payment->voided_at);
        $this->assertSame('Duplicate bank reference.', $payment->void_reason);
    }

    public function test_no_delete_endpoint_exists_for_payments(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->actingAs($admin)
            ->deleteJson("/api/payments/{$payment->id}")
            ->assertStatus(404);

        $this->assertDatabaseHas('payments', ['id' => $payment->id]);
    }

    public function test_allocations_must_sum_to_payment_amount(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'amount' => 1000,
                'reference_no' => 'BAD-SUM',
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 900],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);
    }

    public function test_cannot_create_payment_for_another_schools_student(): void
    {
        [$school, $student] = $this->schoolStudentAndUser([]);
        $otherSchool = School::query()->create([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherAdmin = $this->userWithPermissions($otherSchool, ['payments.view', 'payments.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');

        $this->actingAs($otherAdmin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'amount' => 1000,
                'reference_no' => 'OTHER-SCHOOL',
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 1000],
                ],
            ])
            ->assertForbidden();
    }

    public function test_cross_school_payment_status_is_not_exposed_during_verify(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $otherSchool = School::query()->create([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherFinance = $this->userWithPermissions($otherSchool, ['payments.view', 'payments.verify']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $payment->update(['status' => 'voided']);

        $this->actingAs($otherFinance)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-06',
            ])
            ->assertForbidden();
    }

    public function test_create_and_verify_payment_do_not_generate_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.verify']);
        $payment = $this->pendingPayment($school, $student, $admin);

        $this->assertDatabaseCount('receipts', 0);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-06',
            ])
            ->assertOk();

        $this->assertDatabaseCount('receipts', 0);
    }

    public function test_payment_is_not_connected_to_invoice_balance_behavior(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');
        $invoice = Invoice::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'invoice_no' => 'INV-001',
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
            'subtotal' => 1000,
            'discount_total' => 0,
            'grand_total' => 1000,
            'paid_amount' => 0,
            'outstanding_amount' => 1000,
            'status' => 'pending',
            'created_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-05',
                'received_date' => '2026-07-05',
                'amount' => 1000,
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 1000],
                ],
            ])
            ->assertCreated();

        $invoice->refresh();

        $this->assertSame('pending', $invoice->status);
        $this->assertEquals(0.0, (float) $invoice->paid_amount);
        $this->assertEquals(1000.0, (float) $invoice->outstanding_amount);
    }

    public function test_student_payment_history_can_be_listed(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $this->pendingPayment($school, $student, $admin);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/payments")
            ->assertOk()
            ->assertJsonPath('data.0.status', 'pending_verification')
            ->assertJsonPath('data.0.recorded_by.id', $admin->id);
    }

    /**
     * @param array<int, string> $permissionSlugs
     * @return array{0: School, 1: Student, 2?: User}
     */
    private function schoolStudentAndUser(array $permissionSlugs): array
    {
        $school = School::query()->create([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        $student = Student::query()->create([
            'school_id' => $school->id,
            'student_no' => 'MIS-STD-0001',
            'full_name' => 'Alyssa Tan',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        if ($permissionSlugs === []) {
            return [$school, $student];
        }

        return [$school, $student, $this->userWithPermissions($school, $permissionSlugs)];
    }

    /**
     * @param array<int, string> $permissionSlugs
     */
    private function userWithPermissions(School $school, array $permissionSlugs): User
    {
        $user = User::factory()->create(['school_id' => $school->id]);
        $role = Role::query()->create(['name' => 'Test Role', 'slug' => 'test-role-'.uniqid()]);

        foreach ($permissionSlugs as $permissionSlug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $permissionSlug],
                ['name' => $permissionSlug],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $user->roles()->syncWithoutDetaching([$role->id]);

        return $user;
    }

    private function feeItem(School $school, string $code, string $name): FeeItem
    {
        return FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $code,
            'name' => $name,
            'category' => 'mandatory',
            'fee_type' => 'recurring',
            'default_amount' => 0,
            'status' => 'active',
        ]);
    }

    private function pendingPayment(School $school, Student $student, User $admin, string $referenceNo = 'BANK-REF-001'): Payment
    {
        $tuition = $this->feeItem($school, 'TUITION-'.$referenceNo, 'Tuition Fee '.$referenceNo);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-05',
                'amount' => 1000,
                'bank_account' => 'Maybank 1234567890',
                'reference_no' => $referenceNo,
                'payment_proof' => 'WhatsApp proof '.$referenceNo,
                'remark' => 'Manual bank transfer.',
                'allocations' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 1000],
                ],
            ])
            ->assertCreated();

        return Payment::query()->where('reference_no', $referenceNo)->firstOrFail();
    }
}
