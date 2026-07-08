<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeRecordPaymentAllocationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_non_cash_charge_payment_links_allocation_without_reducing_outstanding(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $charge = $this->charge($school, $student, expectedAmount: 1000);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-07',
                'amount' => 1000,
                'paid_by' => 'Michelle Tan',
                'reference_no' => 'BANK-CHARGE-001',
                'payment_proof' => 'WhatsApp screenshot',
                'allocations' => [
                    [
                        'allocation_type' => 'charge',
                        'fee_record_charge_id' => $charge->id,
                        'amount' => 1000,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'pending_verification')
            ->assertJsonPath('payment.allocations.0.allocation_type', 'charge')
            ->assertJsonPath('payment.allocations.0.fee_record_charge_id', $charge->id)
            ->assertJsonPath('payment.allocations.0.description', 'Tuition Fee July');

        $charge->refresh();

        $this->assertEquals(0.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(1000.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('unpaid', $charge->collection_status);
    }

    public function test_charge_allocation_rejects_other_student_or_other_school_or_over_outstanding_or_non_billable_charge(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.create']);
        $otherStudent = Student::query()->create([
            'school_id' => $school->id,
            'student_no' => 'MIS-STD-0002',
            'full_name' => 'Daniel Lim',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $otherSchool = School::query()->create([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherSchoolStudent = Student::query()->create([
            'school_id' => $otherSchool->id,
            'student_no' => 'OTH-STD-0001',
            'full_name' => 'Other Student',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        $otherStudentCharge = $this->charge($school, $otherStudent, expectedAmount: 1000);
        $otherSchoolCharge = $this->charge($otherSchool, $otherSchoolStudent, expectedAmount: 1000);
        $smallCharge = $this->charge($school, $student, expectedAmount: 100);
        $noCharge = $this->charge($school, $student, expectedAmount: 0, billingStatus: 'no_charge', collectionStatus: 'paid');

        foreach ([
            [$otherStudentCharge->id, 1000],
            [$otherSchoolCharge->id, 1000],
            [$smallCharge->id, 150],
            [$noCharge->id, 1],
        ] as $case) {
            [$chargeId, $amount] = $case;

            $this->actingAs($admin)
                ->postJson("/api/students/{$student->id}/payments", [
                    'payment_method' => 'bank_transfer',
                    'payment_date' => '2026-07-07',
                    'amount' => $amount,
                    'reference_no' => 'BAD-'.$chargeId,
                    'allocations' => [
                        [
                            'allocation_type' => 'charge',
                            'fee_record_charge_id' => $chargeId,
                            'amount' => $amount,
                        ],
                    ],
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['allocations']);
        }
    }

    public function test_manual_allocation_still_works_without_charge_cell(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-07',
                'amount' => 100,
                'reference_no' => 'MANUAL-001',
                'allocations' => [
                    [
                        'allocation_type' => 'manual',
                        'description' => 'Unclassified old balance',
                        'amount' => 100,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('payment.allocations.0.allocation_type', 'manual')
            ->assertJsonPath('payment.allocations.0.fee_record_charge_id', null)
            ->assertJsonPath('payment.allocations.0.description', 'Unclassified old balance');
    }

    public function test_finance_verifies_pending_charge_payment_and_updates_partial_status(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.view', 'payments.verify', 'fee_record.view']);
        $charge = $this->charge($school, $student, expectedAmount: 1000);
        $payment = $this->pendingChargePayment($student, $admin, $charge, 400);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-08',
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'verified');

        $charge->refresh();

        $this->assertEquals(400.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(600.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('partial', $charge->collection_status);

        $this->actingAs($finance)
            ->getJson("/api/students/{$student->id}/fee-record/outstanding?academic_year=2026")
            ->assertOk()
            ->assertJsonPath('data.0.id', $charge->id)
            ->assertJsonPath('data.0.outstanding_amount', 600);
    }

    public function test_verified_charge_payment_marks_charge_paid_when_fully_cleared(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.verify']);
        $charge = $this->charge($school, $student, expectedAmount: 1000);
        $payment = $this->pendingChargePayment($student, $admin, $charge, 1000);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", [
                'received_date' => '2026-07-08',
            ])
            ->assertOk();

        $charge->refresh();

        $this->assertEquals(1000.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(0.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('paid', $charge->collection_status);
    }

    public function test_verify_cannot_over_clear_charge_if_another_payment_already_cleared_it(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.verify']);
        $charge = $this->charge($school, $student, expectedAmount: 1000);
        $firstPayment = $this->pendingChargePayment($student, $admin, $charge, 1000, 'FIRST-CLEAR');
        $secondPayment = $this->pendingChargePayment($student, $admin, $charge, 1000, 'SECOND-CLEAR');

        $this->actingAs($finance)
            ->postJson("/api/payments/{$firstPayment->id}/verify", [
                'received_date' => '2026-07-08',
            ])
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$secondPayment->id}/verify", [
                'received_date' => '2026-07-09',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);

        $secondPayment->refresh();
        $charge->refresh();

        $this->assertSame('pending_verification', $secondPayment->status);
        $this->assertEquals(1000.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(0.0, (float) $charge->outstanding_amount_cached);
    }

    public function test_cash_charge_payment_is_verified_and_applies_balance_immediately(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $charge = $this->charge($school, $student, expectedAmount: 1000);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-07',
                'received_date' => '2026-07-07',
                'amount' => 1000,
                'paid_by' => 'Michelle Tan',
                'allocations' => [
                    [
                        'allocation_type' => 'charge',
                        'fee_record_charge_id' => $charge->id,
                        'amount' => 1000,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'verified');

        $charge->refresh();

        $this->assertEquals(1000.0, (float) $charge->paid_amount_cached);
        $this->assertEquals(0.0, (float) $charge->outstanding_amount_cached);
        $this->assertSame('paid', $charge->collection_status);
    }

    public function test_voiding_verified_payment_reverses_charge_balance_and_voiding_pending_payment_does_not(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.view', 'payments.create']);
        $finance = $this->userWithPermissions($school, ['payments.verify', 'payments.void']);
        $verifiedCharge = $this->charge($school, $student, expectedAmount: 1000);
        $pendingCharge = $this->charge($school, $student, '2026-08', expectedAmount: 500);
        $verifiedPayment = $this->pendingChargePayment($student, $admin, $verifiedCharge, 400, 'VOID-VERIFIED');
        $pendingPayment = $this->pendingChargePayment($student, $admin, $pendingCharge, 500, 'VOID-PENDING');

        $this->actingAs($finance)
            ->postJson("/api/payments/{$verifiedPayment->id}/verify", [
                'received_date' => '2026-07-08',
            ])
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/payments/{$verifiedPayment->id}/void", [
                'void_reason' => 'Wrong payment.',
            ])
            ->assertOk();

        $verifiedCharge->refresh();

        $this->assertEquals(0.0, (float) $verifiedCharge->paid_amount_cached);
        $this->assertEquals(1000.0, (float) $verifiedCharge->outstanding_amount_cached);
        $this->assertSame('unpaid', $verifiedCharge->collection_status);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$pendingPayment->id}/void", [
                'void_reason' => 'Duplicate pending payment.',
            ])
            ->assertOk();

        $pendingCharge->refresh();

        $this->assertEquals(0.0, (float) $pendingCharge->paid_amount_cached);
        $this->assertEquals(500.0, (float) $pendingCharge->outstanding_amount_cached);
        $this->assertSame('unpaid', $pendingCharge->collection_status);
    }

    public function test_receipt_generation_and_void_do_not_change_charge_balance(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'payments.create',
            'receipts.create',
            'receipts.void',
        ]);
        $charge = $this->charge($school, $student, expectedAmount: 1000);

        $paymentId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'cash',
                'payment_date' => '2026-07-07',
                'received_date' => '2026-07-07',
                'amount' => 1000,
                'paid_by' => 'Michelle Tan',
                'allocations' => [
                    [
                        'allocation_type' => 'charge',
                        'fee_record_charge_id' => $charge->id,
                        'amount' => 1000,
                    ],
                ],
            ])
            ->assertCreated()
            ->json('payment.id');

        $charge->refresh();
        $afterPayment = [
            (float) $charge->paid_amount_cached,
            (float) $charge->outstanding_amount_cached,
            $charge->collection_status,
        ];

        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$paymentId}/receipts")
            ->assertCreated()
            ->json('receipt.id');

        $charge->refresh();
        $this->assertSame($afterPayment, [
            (float) $charge->paid_amount_cached,
            (float) $charge->outstanding_amount_cached,
            $charge->collection_status,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/receipts/{$receiptId}/void", [
                'void_reason' => 'Wrong payer name.',
            ])
            ->assertOk();

        $charge->refresh();
        $this->assertSame($afterPayment, [
            (float) $charge->paid_amount_cached,
            (float) $charge->outstanding_amount_cached,
            $charge->collection_status,
        ]);
    }

    /**
     * @param array<int, string> $permissionSlugs
     * @return array{0: School, 1: Student, 2: User}
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

    private function pendingChargePayment(
        Student $student,
        User $admin,
        FeeRecordCharge $charge,
        float $amount,
        string $referenceNo = 'BANK-CHARGE-001',
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
        string $billingStatus = 'billable',
        string $collectionStatus = 'unpaid',
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

        $paidAmount = $collectionStatus === 'paid' ? $expectedAmount : 0;
        $outstandingAmount = $billingStatus === 'billable' ? $expectedAmount - $paidAmount : 0;

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
            'paid_amount_cached' => $paidAmount,
            'outstanding_amount_cached' => $outstandingAmount,
            'billing_status' => $billingStatus,
            'collection_status' => $collectionStatus,
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
            'activated_at' => now(),
        ]);
    }
}
