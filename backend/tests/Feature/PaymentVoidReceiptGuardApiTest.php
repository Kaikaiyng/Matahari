<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Receipt;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentVoidReceiptGuardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_void_verified_payment_with_issued_receipt_and_balances_stay_unchanged(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'payments.create',
            'payments.void',
            'receipts.create',
        ]);
        $charge = $this->charge($school, $student, expectedAmount: 1000);
        $payment = $this->cashChargePayment($student, $admin, $charge, 1000, 'VOID-GUARD-ISSUED');
        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertCreated()
            ->json('receipt.id');

        $response = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/void", [
                'void_reason' => 'Wrong payment.',
            ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment'])
            ->assertJsonPath('errors.payment.0', 'Void the issued receipt before voiding this payment.');

        $payment->refresh();
        $charge->refresh();
        $receipt = Receipt::query()->findOrFail($receiptId);

        $this->assertSame('verified', $payment->status);
        $this->assertEquals(1000.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(0.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('paid', $charge->collection_status);
        $this->assertSame('issued', $receipt->status);
        $this->assertSame($payment->id, $receipt->active_payment_id);
    }

    public function test_can_void_payment_after_issued_receipt_is_voided(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'payments.create',
            'payments.void',
            'receipts.create',
            'receipts.void',
        ]);
        $charge = $this->charge($school, $student, expectedAmount: 1000);
        $payment = $this->cashChargePayment($student, $admin, $charge, 1000, 'VOID-GUARD-VOIDED-RECEIPT');
        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertCreated()
            ->json('receipt.id');

        $this->actingAs($admin)
            ->postJson("/api/receipts/{$receiptId}/void", [
                'void_reason' => 'Wrong payer name.',
            ])
            ->assertOk()
            ->assertJsonPath('receipt.status', 'voided');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/void", [
                'void_reason' => 'Payment was wrong after receipt correction.',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'voided');

        $charge->refresh();
        $receipt = Receipt::query()->findOrFail($receiptId);

        $this->assertEquals(0.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(1000.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('unpaid', $charge->collection_status);
        $this->assertSame('voided', $receipt->status);
        $this->assertNull($receipt->active_payment_id);
    }

    public function test_can_void_verified_or_pending_payment_with_no_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'payments.create',
            'payments.void',
        ]);
        $verifiedCharge = $this->charge($school, $student, expectedAmount: 1000);
        $pendingCharge = $this->charge($school, $student, '2026-08', expectedAmount: 500);
        $verifiedPayment = $this->cashChargePayment($student, $admin, $verifiedCharge, 400, 'VOID-GUARD-NO-RECEIPT');
        $pendingPayment = $this->pendingChargePayment($student, $admin, $pendingCharge, 500, 'VOID-GUARD-PENDING');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$verifiedPayment->id}/void", [
                'void_reason' => 'Wrong verified payment.',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'voided');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$pendingPayment->id}/void", [
                'void_reason' => 'Wrong pending payment.',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'voided');

        $verifiedCharge->refresh();
        $pendingCharge->refresh();

        $this->assertEquals(0.0, (float) $verifiedCharge->paid_amount_cached);
        $this->assertEquals(1000.0, (float) $verifiedCharge->outstanding_amount_cached);
        $this->assertEquals(0.0, (float) $pendingCharge->paid_amount_cached);
        $this->assertEquals(500.0, (float) $pendingCharge->outstanding_amount_cached);
    }

    /**
     * @param  array<int, string>  $permissionSlugs
     * @return array{0: School, 1: Student, 2: User}
     */
    private function schoolStudentAndUser(array $permissionSlugs): array
    {
        $school = $this->createTenantSchool([
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

        return [$school, $student, $this->userWithPermissions($school, $permissionSlugs)];
    }

    /**
     * @param  array<int, string>  $permissionSlugs
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

    private function cashChargePayment(
        Student $student,
        User $admin,
        FeeRecordCharge $charge,
        float $amount,
        string $referenceNo,
    ): Payment {
        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-07',
                'received_date' => '2026-07-07',
                'amount' => $amount,
                'paid_by' => 'Michelle Tan',
                'reference_no' => $referenceNo,
                'allocations' => [
                    [
                        'allocation_type' => 'charge',
                        'fee_record_charge_id' => $charge->id,
                        'amount' => $amount,
                    ],
                ],
            ])
            ->assertCreated();

        return Payment::query()->where('reference_no', $referenceNo)->firstOrFail();
    }

    private function pendingChargePayment(
        Student $student,
        User $admin,
        FeeRecordCharge $charge,
        float $amount,
        string $referenceNo,
    ): Payment {
        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-07',
                'amount' => $amount,
                'paid_by' => 'Michelle Tan',
                'reference_no' => $referenceNo,
                'payment_proof' => 'WhatsApp screenshot',
                'allocations' => [
                    [
                        'allocation_type' => 'charge',
                        'fee_record_charge_id' => $charge->id,
                        'amount' => $amount,
                    ],
                ],
            ])
            ->assertCreated();

        return Payment::query()->where('reference_no', $referenceNo)->firstOrFail();
    }

    private function charge(
        School $school,
        Student $student,
        string $billingMonth = '2026-07',
        float $expectedAmount = 1000,
    ): FeeRecordCharge {
        $feeItem = FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => 'TUITION-'.uniqid(),
            'name' => 'Tuition Fee '.uniqid(),
            'category' => 'SF+MF',
            'fee_type' => 'recurring',
            'default_amount' => 0,
            'status' => 'active',
        ]);
        $versionNo = ((int) FeeAgreement::query()
            ->where('school_id', $school->id)
            ->where('student_id', $student->id)
            ->where('academic_year', '2026')
            ->max('version_no')) + 1;

        $agreement = FeeAgreement::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'academic_year' => '2026',
            'version_no' => $versionNo,
            'payment_plan' => 'monthly',
            'effective_from' => '2026-01-01',
            'effective_to' => '2026-12-31',
            'is_current' => $versionNo === 1,
            'status' => 'active',
        ]);
        $agreementItem = FeeAgreementItem::query()->create([
            'school_id' => $school->id,
            'fee_agreement_id' => $agreement->id,
            'fee_item_id' => $feeItem->id,
            'fee_code' => 'TUITION',
            'fee_category' => 'SF+MF',
            'description' => 'Tuition Fee July',
            'amount' => $expectedAmount,
            'is_mandatory' => true,
            'sort_order' => 1,
            'classification' => 'recurring',
            'billing_frequency' => 'monthly',
        ]);

        return FeeRecordCharge::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => $agreementItem->id,
            'fee_item_id' => $feeItem->id,
            'academic_year' => '2026',
            'billing_month' => $billingMonth,
            'fee_record_category' => 'SF+MF',
            'fee_code' => 'TUITION',
            'description' => 'Tuition Fee July',
            'expected_amount' => $expectedAmount,
            'paid_amount_cached' => 0,
            'outstanding_amount_cached' => $expectedAmount,
            'billing_status' => 'billable',
            'collection_status' => 'unpaid',
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
            'activated_at' => now(),
        ]);
    }
}
