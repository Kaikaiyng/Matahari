<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Receipt;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeRecordSummaryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_summary_returns_one_row_per_active_student_with_charge_totals_and_latest_receipt(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $class = $this->schoolClass($school, 'Year 4');
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan', 'primary', 'active', $class->id);

        $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 400);
        $this->charge($school, $student, '2026-02', 'TRANSPORT', 'optional', 200, 0);
        $this->receipt($school, $student, 'MIS-R-0001', '2026-02-01');
        $this->receipt($school, $student, 'MIS-R-0002', '2026-03-01');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_id', $student->id)
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001')
            ->assertJsonPath('data.0.student_name', 'Alyssa Tan')
            ->assertJsonPath('data.0.level_group', 'primary')
            ->assertJsonPath('data.0.class_name', 'Year 4')
            ->assertJsonPath('data.0.student_status', 'active')
            ->assertJsonPath('data.0.academic_year', '2026')
            ->assertJsonPath('data.0.total_expected', 1200)
            ->assertJsonPath('data.0.total_paid', 400)
            ->assertJsonPath('data.0.total_outstanding', 800)
            ->assertJsonPath('data.0.outstanding_months', ['2026-01', '2026-02'])
            ->assertJsonPath('data.0.outstanding_categories', ['SF+MF', 'TR'])
            ->assertJsonPath('data.0.latest_receipt_no', 'MIS-R-0002')
            ->assertJsonPath('data.0.latest_receipt_date', '2026-03-01')
            ->assertJsonPath('data.0.collection_status_summary', 'partial');
    }

    public function test_summary_filters_charge_totals_by_billing_month(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');

        $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 400);
        $this->charge($school, $student, '2026-02', 'TRANSPORT', 'optional', 200, 0);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-01')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.total_expected', 1000)
            ->assertJsonPath('data.0.total_paid', 400)
            ->assertJsonPath('data.0.total_outstanding', 600)
            ->assertJsonPath('data.0.outstanding_months', ['2026-01']);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-03')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_summary_rejects_invalid_or_mismatched_billing_months(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=July')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('billing_month');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2025-07')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('billing_month');
    }

    public function test_month_filter_preserves_school_and_student_status_scope(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $active = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $withdrawn = $this->student($school, 'MIS-2026-002', 'Daniel Lim', status: 'withdraw');
        $otherSchool = School::query()->create([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $outsideScope = $this->student($otherSchool, 'OTH-2026-001', 'Outside Student');

        $this->charge($school, $active, '2026-07', 'TUITION', 'mandatory', 500, 300);
        $this->charge($school, $withdrawn, '2026-07', 'TUITION', 'mandatory', 600, 0);
        $this->charge($otherSchool, $outsideScope, '2026-07', 'TUITION', 'mandatory', 700, 0);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-07')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-07&student_status=withdraw')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-002');
    }

    public function test_summary_filters_outstanding_search_and_student_status(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $activeOutstanding = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $activePaid = $this->student($school, 'MIS-2026-002', 'Daniel Lim');
        $withdrawn = $this->student($school, 'MIS-2026-003', 'Mika Wong', status: 'withdraw');

        $this->charge($school, $activeOutstanding, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        $this->charge($school, $activePaid, '2026-01', 'TUITION', 'mandatory', 1000, 1000);
        $this->charge($school, $withdrawn, '2026-01', 'TUITION', 'mandatory', 1000, 0);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&outstanding_only=true')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&search=daniel')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-002');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026&student_status=withdraw')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-003');
    }

    public function test_summary_uses_charge_cell_balances_not_invoices_or_receipts(): void
    {
        [$school, $admin] = $this->schoolAndUser([
            'fee_record.view',
            'payments.create',
            'payments.verify',
            'payments.void',
            'receipts.create',
            'receipts.void',
        ]);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $charge = $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        Invoice::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'invoice_no' => 'INV-IGNORE-001',
            'invoice_month' => '2026-01',
            'issue_date' => '2026-01-01',
            'due_date' => '2026-01-31',
            'subtotal' => 9999,
            'discount_total' => 0,
            'grand_total' => 9999,
            'paid_amount' => 9999,
            'outstanding_amount' => 0,
            'status' => 'paid',
            'created_by' => $admin->id,
        ]);

        $pending = $this->chargePayment($admin, $student, $charge, 400, 'BANK-PENDING');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonPath('data.0.total_paid', 0)
            ->assertJsonPath('data.0.total_outstanding', 1000);

        $this->actingAs($admin)
            ->postJson("/api/payments/{$pending->id}/verify", ['received_date' => '2026-01-15'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonPath('data.0.total_paid', 400)
            ->assertJsonPath('data.0.total_outstanding', 600);

        $cash = $this->chargePayment($admin, $student, $charge, 600, 'CASH-PAID', 'cash');
        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$cash->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');
        $this->actingAs($admin)
            ->postJson("/api/receipts/{$receiptId}/void", ['void_reason' => 'Reference correction.'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonPath('data.0.total_paid', 1000)
            ->assertJsonPath('data.0.total_outstanding', 0)
            ->assertJsonPath('data.0.collection_status_summary', 'paid');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$pending->id}/void", ['void_reason' => 'Duplicate bank transfer.'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonPath('data.0.total_paid', 600)
            ->assertJsonPath('data.0.total_outstanding', 400)
            ->assertJsonPath('data.0.collection_status_summary', 'partial');
    }

    public function test_summary_endpoint_is_read_only_and_requires_fee_record_view_permission(): void
    {
        [$school, $viewer] = $this->schoolAndUser(['students.view']);
        $admin = $this->userWithPermissions($school, ['fee_record.view']);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 0);

        $this->actingAs($viewer)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertForbidden();

        $before = FeeRecordCharge::query()->firstOrFail()->only([
            'expected_amount',
            'paid_amount_cached',
            'outstanding_amount_cached',
            'collection_status',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/fee-record/summary?academic_year=2026')
            ->assertMethodNotAllowed();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk();

        $after = FeeRecordCharge::query()->firstOrFail()->only([
            'expected_amount',
            'paid_amount_cached',
            'outstanding_amount_cached',
            'collection_status',
        ]);

        $this->assertSame($before, $after);
    }

    /**
     * @param  array<int, string>  $permissionSlugs
     * @return array{0: School, 1: User}
     */
    private function schoolAndUser(array $permissionSlugs): array
    {
        $school = School::query()->create([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);

        return [$school, $this->userWithPermissions($school, $permissionSlugs)];
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

    private function schoolClass(School $school, string $name): SchoolClass
    {
        return SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => $name,
            'status' => 'active',
        ]);
    }

    private function student(
        School $school,
        string $studentNo,
        string $name,
        string $levelGroup = 'primary',
        string $status = 'active',
        ?int $classId = null,
    ): Student {
        return Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $classId,
            'student_no' => $studentNo,
            'full_name' => $name,
            'level_group' => $levelGroup,
            'status' => $status,
        ]);
    }

    private function charge(
        School $school,
        Student $student,
        string $billingMonth,
        string $feeCode,
        string $feeRecordCategory,
        float $expectedAmount,
        float $paidAmount,
    ): FeeRecordCharge {
        $feeItem = FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $feeCode.'-'.uniqid(),
            'name' => $feeCode.' Fee '.uniqid(),
            'category' => $feeRecordCategory,
            'fee_type' => 'recurring',
            'default_amount' => $expectedAmount,
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
            'fee_code' => $feeCode,
            'fee_category' => $feeRecordCategory,
            'description' => $feeCode.' '.$billingMonth,
            'amount' => $expectedAmount,
            'is_mandatory' => true,
            'sort_order' => 1,
            'classification' => 'recurring',
            'billing_frequency' => 'monthly',
        ]);
        $outstandingAmount = max(0, $expectedAmount - $paidAmount);

        return FeeRecordCharge::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => $agreementItem->id,
            'fee_item_id' => $feeItem->id,
            'academic_year' => '2026',
            'billing_month' => $billingMonth,
            'fee_record_category' => $feeRecordCategory,
            'fee_code' => $feeCode,
            'description' => $feeCode.' '.$billingMonth,
            'expected_amount' => $expectedAmount,
            'paid_amount_cached' => $paidAmount,
            'outstanding_amount_cached' => $outstandingAmount,
            'billing_status' => $expectedAmount > 0 ? 'billable' : 'no_charge',
            'collection_status' => $outstandingAmount <= 0 ? 'paid' : ($paidAmount > 0 ? 'partial' : 'unpaid'),
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
            'activated_at' => now(),
        ]);
    }

    private function chargePayment(
        User $admin,
        Student $student,
        FeeRecordCharge $charge,
        float $amount,
        string $referenceNo,
        string $method = 'bank_transfer',
    ): Payment {
        $payload = [
            'payment_method' => $method,
            'payment_date' => '2026-01-10',
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
        ];

        if ($method === 'cash') {
            $payload['received_date'] = '2026-01-10';
        }

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/payments", $payload)
            ->assertCreated();

        return Payment::query()->where('reference_no', $referenceNo)->firstOrFail();
    }

    private function receipt(School $school, Student $student, string $receiptNo, string $receiptDate): Receipt
    {
        $payment = Payment::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_method' => 'cash',
            'payment_date' => $receiptDate,
            'received_date' => $receiptDate,
            'amount' => 100,
            'paid_by' => 'Michelle Tan',
            'status' => 'verified',
        ]);

        return Receipt::query()->create([
            'school_id' => $school->id,
            'payment_id' => $payment->id,
            'active_payment_id' => $payment->id,
            'student_id' => $student->id,
            'student_no' => $student->student_no,
            'student_name' => $student->full_name,
            'paid_by' => 'Michelle Tan',
            'payment_method' => 'cash',
            'payment_date' => $receiptDate,
            'received_date' => $receiptDate,
            'receipt_no' => $receiptNo,
            'receipt_date' => $receiptDate,
            'amount' => 100,
            'amount_in_words' => 'One Hundred Ringgit Only',
            'status' => 'issued',
            'issued_by' => null,
            'issued_at' => now(),
        ]);
    }
}
