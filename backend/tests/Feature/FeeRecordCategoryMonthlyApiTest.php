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

class FeeRecordCategoryMonthlyApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_category_monthly_requires_fee_record_view_permission_and_is_read_only(): void
    {
        [$school, $viewer] = $this->schoolAndUser(['students.view']);
        $admin = $this->userWithPermissions($school, ['fee_record.view']);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 0);

        $this->actingAs($viewer)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertForbidden();

        $before = FeeRecordCharge::query()->firstOrFail()->only([
            'expected_amount',
            'paid_amount_cached',
            'outstanding_amount_cached',
            'collection_status',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertMethodNotAllowed();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk();

        $after = FeeRecordCharge::query()->firstOrFail()->only([
            'expected_amount',
            'paid_amount_cached',
            'outstanding_amount_cached',
            'collection_status',
        ]);

        $this->assertSame($before, $after);
    }

    public function test_category_monthly_returns_one_row_per_active_student_for_selected_category(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $class = $this->schoolClass($school, 'Year 4');
        $alyssa = $this->student($school, 'MIS-2026-001', 'Alyssa Tan', 'primary', 'active', $class->id);
        $daniel = $this->student($school, 'MIS-2026-002', 'Daniel Lim', 'primary', 'active', $class->id);
        $withdrawn = $this->student($school, 'MIS-2026-003', 'Mika Wong', 'primary', 'withdraw', $class->id);
        $transportOnly = $this->student($school, 'MIS-2026-004', 'Sara Lee', 'primary', 'active', $class->id);

        $this->charge($school, $alyssa, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        $this->charge($school, $daniel, '2026-02', 'MISC', 'mandatory', 200, 200);
        $this->charge($school, $withdrawn, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        $this->charge($school, $transportOnly, '2026-01', 'TRANSPORT', 'optional', 250, 0);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001')
            ->assertJsonPath('data.0.class_name', 'Year 4')
            ->assertJsonPath('data.0.level_group', 'primary')
            ->assertJsonPath('data.0.months.0.month', '2026-01')
            ->assertJsonPath('data.0.months.0.expected_amount', 1000)
            ->assertJsonPath('data.0.months.0.paid_amount', 0)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 1000)
            ->assertJsonPath('data.0.months.0.collection_status', 'unpaid')
            ->assertJsonPath('data.0.months.0.charge_count', 1)
            ->assertJsonPath('data.0.months.0.raw_categories', ['mandatory'])
            ->assertJsonPath('data.0.months.0.fee_codes', ['TUITION'])
            ->assertJsonPath('data.0.total_outstanding', 1000)
            ->assertJsonPath('data.1.student_no', 'MIS-2026-002');
    }

    public function test_category_monthly_aggregates_multiple_charges_in_same_student_category_month(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');

        $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 400);
        $this->charge($school, $student, '2026-01', 'MISC', 'mandatory', 300, 0);
        $this->charge($school, $student, '2026-02', 'TUITION', 'mandatory', 1000, 1000);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.expected_amount', 1300)
            ->assertJsonPath('data.0.months.0.paid_amount', 400)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 900)
            ->assertJsonPath('data.0.months.0.collection_status', 'partial')
            ->assertJsonPath('data.0.months.0.charge_count', 2)
            ->assertJsonPath('data.0.months.0.raw_categories', ['mandatory'])
            ->assertJsonPath('data.0.months.0.fee_codes', ['TUITION', 'MISC'])
            ->assertJsonPath('data.0.months.1.collection_status', 'paid')
            ->assertJsonPath('data.0.total_expected', 2300)
            ->assertJsonPath('data.0.total_paid', 1400)
            ->assertJsonPath('data.0.total_outstanding', 900);
    }

    public function test_category_monthly_uses_charge_balances_not_pending_payments_or_invoices(): void
    {
        [$school, $admin] = $this->schoolAndUser([
            'fee_record.view',
            'payments.create',
            'payments.verify',
            'payments.void',
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
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.paid_amount', 0)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 1000);

        $this->actingAs($admin)
            ->postJson("/api/payments/{$pending->id}/verify", ['received_date' => '2026-01-15'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.paid_amount', 400)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 600)
            ->assertJsonPath('data.0.months.0.collection_status', 'partial');

        $this->actingAs($admin)
            ->postJson("/api/payments/{$pending->id}/void", ['void_reason' => 'Duplicate bank transfer.'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.paid_amount', 0)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 1000)
            ->assertJsonPath('data.0.months.0.collection_status', 'unpaid');
    }

    public function test_category_monthly_cash_payment_and_receipt_refs_use_only_active_issued_receipts(): void
    {
        [$school, $admin] = $this->schoolAndUser([
            'fee_record.view',
            'payments.create',
            'receipts.create',
            'receipts.void',
        ]);
        $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
        $charge = $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 0);

        $cash = $this->chargePayment($admin, $student, $charge, 1000, 'CASH-PAID', 'cash');
        $receiptId = $this->actingAs($admin)
            ->postJson("/api/payments/{$cash->id}/receipts")
            ->assertCreated()
            ->json('receipt.id');
        $receiptNo = Receipt::query()->findOrFail($receiptId)->receipt_no;

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.paid_amount', 1000)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 0)
            ->assertJsonPath('data.0.months.0.collection_status', 'paid')
            ->assertJsonPath('data.0.months.0.receipt_refs', [$receiptNo]);

        $this->actingAs($admin)
            ->postJson("/api/receipts/{$receiptId}/void", ['void_reason' => 'Wrong payer name.'])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF')
            ->assertOk()
            ->assertJsonPath('data.0.months.0.paid_amount', 1000)
            ->assertJsonPath('data.0.months.0.outstanding_amount', 0)
            ->assertJsonPath('data.0.months.0.receipt_refs', []);
    }

    public function test_category_monthly_filters_outstanding_search_level_group_and_student_status(): void
    {
        [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
        $activeOutstanding = $this->student($school, 'MIS-2026-001', 'Alyssa Tan', 'primary');
        $activePaid = $this->student($school, 'MIS-2026-002', 'Daniel Lim', 'primary');
        $secondaryOutstanding = $this->student($school, 'MIS-2026-003', 'Priya Shah', 'secondary');
        $withdrawn = $this->student($school, 'MIS-2026-004', 'Mika Wong', 'primary', 'withdraw');

        $this->charge($school, $activeOutstanding, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        $this->charge($school, $activePaid, '2026-01', 'TUITION', 'mandatory', 1000, 1000);
        $this->charge($school, $secondaryOutstanding, '2026-01', 'TUITION', 'mandatory', 1000, 0);
        $this->charge($school, $withdrawn, '2026-01', 'TUITION', 'mandatory', 1000, 0);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF&outstanding_only=true')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001')
            ->assertJsonPath('data.1.student_no', 'MIS-2026-003');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF&search=daniel')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-002');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF&level_group=secondary')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-003');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=SF%2BMF&student_status=withdraw')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_no', 'MIS-2026-004');
    }

    /**
     * @param  array<int, string>  $permissionSlugs
     * @return array{0: School, 1: User}
     */
    private function schoolAndUser(array $permissionSlugs): array
    {
        $school = $this->createTenantSchool([
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
            ->where('academic_year', substr($billingMonth, 0, 4))
            ->max('version_no')) + 1;

        $agreement = FeeAgreement::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'academic_year' => substr($billingMonth, 0, 4),
            'version_no' => $versionNo,
            'payment_plan' => 'monthly',
            'effective_from' => substr($billingMonth, 0, 4).'-01-01',
            'effective_to' => substr($billingMonth, 0, 4).'-12-31',
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
            'academic_year' => substr($billingMonth, 0, 4),
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
}
