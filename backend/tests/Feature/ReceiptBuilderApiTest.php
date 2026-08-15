<?php

namespace Tests\Feature;

use App\Models\FeeItem;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Receipt;
use App\Models\ReceiptSequence;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReceiptBuilderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_payment_cannot_generate_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create']);
        $payment = $this->payment($school, $student, $admin, 'pending_verification', paidBy: 'Michelle Tan');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);

        $this->assertDatabaseCount('receipts', 0);
    }

    public function test_voided_payment_cannot_generate_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create']);
        $payment = $this->payment($school, $student, $admin, 'voided', paidBy: 'Michelle Tan');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);

        $this->assertDatabaseCount('receipts', 0);
    }

    public function test_verified_payment_can_generate_receipt_with_snapshotted_items(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create', 'receipts.view']);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: 'Michelle Tan');

        $response = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertCreated()
            ->assertJsonPath('receipt.receipt_no', 'MIS.A0001 (07/2026)')
            ->assertJsonPath('receipt.status', 'issued')
            ->assertJsonPath('receipt.paid_by', 'Michelle Tan')
            ->assertJsonPath('receipt.student_no', 'MIS-STD-0001')
            ->assertJsonPath('receipt.student_name', 'Alyssa Tan')
            ->assertJsonPath('receipt.amount', 1250.5)
            ->assertJsonPath('receipt.amount_in_words', 'One Thousand Two Hundred Fifty Ringgit and Fifty Sen Only')
            ->assertJsonPath('receipt.items.0.fee_code', 'TUITION')
            ->assertJsonPath('receipt.items.0.description', 'Tuition Fee July')
            ->assertJsonPath('receipt.items.0.amount', 1000)
            ->assertJsonPath('receipt.items.1.fee_code', 'MISC')
            ->assertJsonPath('receipt.items.1.amount', 250.5);

        $receiptId = $response->json('receipt.id');

        $this->assertDatabaseHas('receipts', [
            'id' => $receiptId,
            'school_id' => $school->id,
            'payment_id' => $payment->id,
            'active_payment_id' => $payment->id,
            'student_id' => $student->id,
            'student_no' => 'MIS-STD-0001',
            'student_name' => 'Alyssa Tan',
            'paid_by' => 'Michelle Tan',
            'receipt_no' => 'MIS.A0001 (07/2026)',
            'status' => 'issued',
            'issued_by' => $admin->id,
        ]);

        $this->assertDatabaseCount('receipt_items', 2);
        $this->assertSame($payment->allocations()->firstOrFail()->id, $response->json('receipt.items.0.payment_allocation_id'));
    }

    public function test_receipt_number_is_continuous_and_does_not_reset_monthly(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create']);
        $julyPayment = $this->payment($school, $student, $admin, 'verified', '2026-07-10', 'Michelle Tan', 'JULY-REF');
        $augustPayment = $this->payment($school, $student, $admin, 'verified', '2026-08-05', 'Michelle Tan', 'AUGUST-REF');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$julyPayment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertCreated()
            ->assertJsonPath('receipt.receipt_no', 'MIS.A0001 (07/2026)');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$augustPayment->id}/receipts", ['receipt_date' => '2026-08-05'])
            ->assertCreated()
            ->assertJsonPath('receipt.receipt_no', 'MIS.A0002 (08/2026)');

        $this->assertDatabaseHas('receipt_sequences', [
            'school_id' => $school->id,
            'prefix' => 'MIS',
            'series' => 'A',
            'current_number' => 2,
        ]);
    }

    public function test_second_issued_receipt_for_same_payment_fails_until_existing_receipt_is_voided(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create', 'receipts.void']);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: 'Michelle Tan');

        $firstReceiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertCreated()
            ->assertJsonPath('receipt.receipt_no', 'MIS.A0001 (07/2026)')
            ->json('receipt.id');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-10'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);

        $this->actingAs($admin)
            ->postJson("/api/receipts/{$firstReceiptId}/void", ['void_reason' => 'Wrong payer name.'])
            ->assertOk()
            ->assertJsonPath('receipt.status', 'voided');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['receipt_date' => '2026-07-11'])
            ->assertCreated()
            ->assertJsonPath('receipt.receipt_no', 'MIS.A0002 (07/2026)');

        $this->assertDatabaseHas('receipts', [
            'id' => $firstReceiptId,
            'status' => 'voided',
            'active_payment_id' => null,
            'void_reason' => 'Wrong payer name.',
        ]);

        $this->assertSame(2, Receipt::query()->where('payment_id', $payment->id)->count());
    }

    public function test_school_admin_can_create_and_print_but_cannot_void_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'receipts.view',
            'receipts.create',
            'receipts.print',
        ]);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: 'Michelle Tan');

        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');

        $this->actingAs($admin)
            ->getJson("/api/receipts/{$receiptId}/print")
            ->assertOk()
            ->assertJsonPath('receipt.id', $receiptId);

        $this->actingAs($admin)
            ->postJson("/api/receipts/{$receiptId}/void", ['void_reason' => 'Wrong payer name.'])
            ->assertForbidden();
    }

    public function test_finance_can_create_print_and_void_receipt(): void
    {
        [$school, $student, $finance] = $this->schoolStudentAndUser([
            'receipts.view',
            'receipts.create',
            'receipts.void',
            'receipts.print',
        ]);
        $payment = $this->payment($school, $student, $finance, 'verified', paidBy: 'Michelle Tan');

        $receiptId = $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');

        $this->actingAs($finance)
            ->getJson("/api/receipts/{$receiptId}/print")
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/receipts/{$receiptId}/void", ['void_reason' => 'Duplicate receipt.'])
            ->assertOk()
            ->assertJsonPath('receipt.status', 'voided')
            ->assertJsonPath('receipt.void_reason', 'Duplicate receipt.');
    }

    public function test_receipt_generation_requires_paid_by_if_payment_is_missing_it_but_can_accept_and_persist_it(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create']);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: null);

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['paid_by']);

        $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts", ['paid_by' => 'Michelle Tan'])
            ->assertCreated()
            ->assertJsonPath('receipt.paid_by', 'Michelle Tan');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'paid_by' => 'Michelle Tan',
        ]);
    }

    public function test_student_receipt_history_and_show_endpoint_return_immutable_snapshot(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.view', 'receipts.create']);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: 'Michelle Tan');

        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');

        $payment->allocations()->firstOrFail()->update(['description' => 'Changed After Receipt']);
        $student->update(['full_name' => 'Changed Student']);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/receipts")
            ->assertOk()
            ->assertJsonPath('data.0.id', $receiptId)
            ->assertJsonPath('data.0.student_name', 'Alyssa Tan')
            ->assertJsonPath('data.0.items.0.description', 'Tuition Fee July');

        $this->actingAs($admin)
            ->getJson("/api/receipts/{$receiptId}")
            ->assertOk()
            ->assertJsonPath('receipt.student_name', 'Alyssa Tan')
            ->assertJsonPath('receipt.items.0.description', 'Tuition Fee July');
    }

    public function test_no_edit_or_delete_endpoint_exists_for_receipts(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['receipts.create']);
        $payment = $this->payment($school, $student, $admin, 'verified', paidBy: 'Michelle Tan');

        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$payment->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');

        $this->actingAs($admin)
            ->patchJson("/api/receipts/{$receiptId}", ['paid_by' => 'Changed'])
            ->assertStatus(405);

        $this->actingAs($admin)
            ->deleteJson("/api/receipts/{$receiptId}")
            ->assertStatus(405);
    }

    public function test_payment_create_and_verify_do_not_auto_generate_receipt(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['payments.create', 'payments.view']);
        $finance = $this->userWithPermissions($school, ['payments.verify', 'payments.view']);
        $feeItem = $this->feeItem($school, 'TUITION', 'Tuition Fee');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", [
                'payment_method' => 'bank_transfer',
                'payment_date' => '2026-07-10',
                'amount' => 500,
                'paid_by' => 'Michelle Tan',
                'reference_no' => 'BANK-REF-001',
                'allocations' => [
                    ['fee_item_id' => $feeItem->id, 'amount' => 500],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('payment.status', 'pending_verification')
            ->assertJsonPath('payment.paid_by', 'Michelle Tan');

        $payment = Payment::query()->where('reference_no', 'BANK-REF-001')->firstOrFail();

        $this->assertDatabaseCount('receipts', 0);

        $this->actingAs($finance)
            ->postJson("/api/payments/{$payment->id}/verify", ['received_date' => '2026-07-11'])
            ->assertOk();

        $this->assertDatabaseCount('receipts', 0);
    }

    public function test_receipt_schema_uses_continuous_sequence_and_active_payment_guard(): void
    {
        $this->assertTrue(Schema::hasColumn('payments', 'paid_by'));
        $this->assertTrue(Schema::hasColumn('receipts', 'active_payment_id'));
        $this->assertTrue(Schema::hasColumn('receipt_sequences', 'series'));
        $this->assertFalse(Schema::hasColumn('receipt_sequences', 'year'));
        $this->assertFalse(Schema::hasColumn('receipt_sequences', 'month'));

        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        ReceiptSequence::query()->create([
            'school_id' => $school->id,
            'prefix' => 'MIS',
            'series' => 'A',
            'current_number' => 1,
        ]);

        $this->expectException(QueryException::class);

        ReceiptSequence::query()->create([
            'school_id' => $school->id,
            'prefix' => 'MIS',
            'series' => 'A',
            'current_number' => 2,
        ]);
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

    private function payment(
        School $school,
        Student $student,
        User $recordedBy,
        string $status,
        string $paymentDate = '2026-07-10',
        ?string $paidBy = 'Michelle Tan',
        string $referenceNo = 'BANK-REF-001',
    ): Payment {
        $payment = Payment::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_method' => 'bank_transfer',
            'payment_date' => $paymentDate,
            'received_date' => $status === 'verified' ? $paymentDate : null,
            'amount' => 1250.50,
            'paid_by' => $paidBy,
            'bank_account' => 'Maybank 1234567890',
            'reference_no' => $referenceNo,
            'payment_proof' => 'WhatsApp proof',
            'remark' => 'July payment.',
            'status' => $status,
            'recorded_by' => $recordedBy->id,
            'verified_by' => $status === 'verified' ? $recordedBy->id : null,
            'verified_at' => $status === 'verified' ? now() : null,
            'voided_by' => $status === 'voided' ? $recordedBy->id : null,
            'voided_at' => $status === 'voided' ? now() : null,
            'void_reason' => $status === 'voided' ? 'Wrong payment.' : null,
        ]);

        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee');

        $payment->allocations()->create([
            'school_id' => $school->id,
            'fee_item_id' => $tuition->id,
            'fee_agreement_item_id' => null,
            'fee_code' => 'TUITION',
            'description' => 'Tuition Fee July',
            'amount' => 1000,
            'sort_order' => 0,
        ]);

        $payment->allocations()->create([
            'school_id' => $school->id,
            'fee_item_id' => $misc->id,
            'fee_agreement_item_id' => null,
            'fee_code' => 'MISC',
            'description' => 'Misc Fee July',
            'amount' => 250.50,
            'sort_order' => 1,
        ]);

        return $payment->refresh();
    }

    private function feeItem(School $school, string $code, string $name): FeeItem
    {
        return FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $code.'-'.uniqid(),
            'name' => $name.' '.uniqid(),
            'category' => 'mandatory',
            'fee_type' => 'recurring',
            'default_amount' => 0,
            'status' => 'active',
        ]);
    }
}
