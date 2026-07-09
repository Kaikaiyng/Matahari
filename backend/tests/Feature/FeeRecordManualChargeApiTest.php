<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeRecordManualChargeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_admin_can_create_manual_charge_cell(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.manage']);
        $agreement = $this->agreement($school, $student);
        $uniform = $this->feeItem($school, 'UNIFORM', 'Uniform', 'optional');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2026-07',
                'fee_record_category' => 'OTHERS',
                'fee_item_id' => $uniform->id,
                'description' => 'Uniform',
                'expected_amount' => 120,
                'remark' => 'Bought one set.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.student_id', $student->id)
            ->assertJsonPath('data.fee_agreement_id', $agreement->id)
            ->assertJsonPath('data.billing_month', '2026-07')
            ->assertJsonPath('data.fee_record_category', 'OTHERS')
            ->assertJsonPath('data.fee_item_id', $uniform->id)
            ->assertJsonPath('data.fee_code', 'UNIFORM')
            ->assertJsonPath('data.description', 'Uniform')
            ->assertJsonPath('data.remark', 'Bought one set.')
            ->assertJsonPath('data.expected_amount', 120)
            ->assertJsonPath('data.paid_amount', 0)
            ->assertJsonPath('data.outstanding_amount', 120)
            ->assertJsonPath('data.billing_status', 'billable')
            ->assertJsonPath('data.collection_status', 'unpaid')
            ->assertJsonPath('data.charge_origin', 'manual')
            ->assertJsonPath('data.source_type', 'manual_charge');

        $this->assertDatabaseHas('fee_record_charges', [
            'school_id' => $school->id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => null,
            'fee_item_id' => $uniform->id,
            'academic_year' => '2026',
            'billing_month' => '2026-07',
            'fee_record_category' => 'OTHERS',
            'fee_code' => 'UNIFORM',
            'description' => 'Uniform',
            'remark' => 'Bought one set.',
            'expected_amount' => 120,
            'paid_amount_cached' => 0,
            'outstanding_amount_cached' => 120,
            'billing_status' => 'billable',
            'collection_status' => 'unpaid',
            'charge_origin' => 'manual',
            'source_type' => 'manual_charge',
        ]);
    }

    public function test_finance_without_manage_permission_cannot_create_manual_charge_cell(): void
    {
        [$school, $student, $finance] = $this->schoolStudentAndUser(['fee_record.view', 'payments.verify']);
        $this->agreement($school, $student);

        $this->actingAs($finance)
            ->postJson("/api/students/{$student->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2026-07',
                'fee_record_category' => 'OTHERS',
                'description' => 'Uniform',
                'expected_amount' => 120,
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('fee_record_charges', 0);
    }

    public function test_manual_charge_appears_in_outstanding_summary_and_category_monthly(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.manage', 'fee_record.view']);
        $this->agreement($school, $student);

        $chargeId = $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2026-07',
                'fee_record_category' => 'PAYMENT',
                'fee_code' => 'OLD_BALANCE',
                'description' => 'Old Balance',
                'expected_amount' => 450,
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/outstanding?academic_year=2026")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $chargeId)
            ->assertJsonPath('data.0.description', 'Old Balance')
            ->assertJsonPath('data.0.outstanding_amount', 450)
            ->assertJsonPath('data.0.charge_origin', 'manual');

        $this->actingAs($admin)
            ->getJson('/api/fee-record/summary?academic_year=2026')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.total_expected', 450)
            ->assertJsonPath('data.0.total_paid', 0)
            ->assertJsonPath('data.0.total_outstanding', 450)
            ->assertJsonPath('data.0.outstanding_categories', ['PAYMENT']);

        $this->actingAs($admin)
            ->getJson('/api/fee-record/category-monthly?academic_year=2026&category=PAYMENT')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.months.6.month', '2026-07')
            ->assertJsonPath('data.0.months.6.expected_amount', 450)
            ->assertJsonPath('data.0.months.6.outstanding_amount', 450)
            ->assertJsonPath('data.0.months.6.collection_status', 'unpaid')
            ->assertJsonPath('data.0.months.6.charge_count', 1)
            ->assertJsonPath('data.0.months.6.raw_categories', ['PAYMENT'])
            ->assertJsonPath('data.0.months.6.fee_codes', ['OLD_BALANCE'])
            ->assertJsonPath('data.0.total_outstanding', 450);
    }

    public function test_manual_charge_rejects_other_school_student_or_fee_item(): void
    {
        [$school, , $admin] = $this->schoolStudentAndUser(['fee_record.manage']);
        $otherSchool = School::query()->create([
            'code' => 'OTH',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherStudent = Student::query()->create([
            'school_id' => $otherSchool->id,
            'student_no' => 'OTH-001',
            'full_name' => 'Other Student',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $otherItem = $this->feeItem($otherSchool, 'UNIFORM', 'Uniform', 'optional');

        $this->actingAs($admin)
            ->postJson("/api/students/{$otherStudent->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2026-07',
                'fee_record_category' => 'OTHERS',
                'description' => 'Uniform',
                'expected_amount' => 120,
            ])
            ->assertForbidden();

        [$sameSchool, $sameStudent, $sameAdmin] = $this->schoolStudentAndUser(['fee_record.manage'], 'MIS2');
        $this->agreement($sameSchool, $sameStudent);

        $this->actingAs($sameAdmin)
            ->postJson("/api/students/{$sameStudent->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2026-07',
                'fee_record_category' => 'OTHERS',
                'fee_item_id' => $otherItem->id,
                'description' => 'Uniform',
                'expected_amount' => 120,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fee_item_id']);
    }

    public function test_manual_charge_validates_amount_description_and_billing_month_year(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.manage']);
        $this->agreement($school, $student);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/manual-charges", [
                'academic_year' => '2026',
                'billing_month' => '2025-07',
                'fee_record_category' => 'OTHERS',
                'description' => '',
                'expected_amount' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_month', 'description', 'expected_amount']);
    }

    /**
     * @param array<int, string> $permissionSlugs
     * @return array{0: School, 1: Student, 2: User}
     */
    private function schoolStudentAndUser(array $permissionSlugs, string $schoolCode = 'MIS'): array
    {
        $school = School::query()->create([
            'code' => $schoolCode,
            'name' => $schoolCode.' School',
            'receipt_prefix' => $schoolCode,
            'invoice_prefix' => $schoolCode.'-INV',
            'status' => 'active',
        ]);

        $student = Student::query()->create([
            'school_id' => $school->id,
            'student_no' => $schoolCode.'-STD-0001',
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

    private function agreement(School $school, Student $student): FeeAgreement
    {
        return FeeAgreement::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'academic_year' => '2026',
            'version_no' => 1,
            'payment_plan' => 'monthly',
            'effective_from' => '2026-01-01',
            'effective_to' => '2026-12-31',
            'is_current' => true,
            'status' => 'active',
        ]);
    }

    private function feeItem(School $school, string $code, string $name, string $category): FeeItem
    {
        return FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $code,
            'name' => $name.' '.uniqid(),
            'category' => $category,
            'fee_type' => 'one_time',
            'default_amount' => 0,
            'status' => 'active',
        ]);
    }
}
