<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementDiscount;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FeeRecordChargeCellApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_agreement_item_previews_and_activates_twelve_charge_cells(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view', 'fee_record.generate']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $tuitionItem = $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000, [
            'classification' => 'recurring',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonPath('needs_confirmation', false)
            ->assertJsonCount(12, 'charges')
            ->assertJsonPath('charges.0.fee_agreement_item_id', $tuitionItem->id)
            ->assertJsonPath('charges.0.billing_month', '2026-01')
            ->assertJsonPath('charges.11.billing_month', '2026-12')
            ->assertJsonPath('charges.0.expected_amount', 1000);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", [
                'academic_year' => '2026',
            ])
            ->assertCreated()
            ->assertJsonPath('created_count', 12)
            ->assertJsonPath('data.0.charge_origin', 'scheduled')
            ->assertJsonPath('data.0.source_type', 'agreement_item');

        $this->assertDatabaseCount('fee_record_charges', 12);
        $this->assertDatabaseHas('fee_record_charges', [
            'school_id' => $school->id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => $tuitionItem->id,
            'billing_month' => '2026-01',
            'expected_amount' => 1000,
            'paid_amount_cached' => 0,
            'outstanding_amount_cached' => 1000,
            'billing_status' => 'billable',
            'collection_status' => 'unpaid',
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
        ]);
    }

    public function test_one_time_item_generates_only_selected_month_not_twelve_placeholders(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $this->agreementItem($school, $agreement, 'UNIFORM', 'OTHERS', 'Uniform', 250, [
            'classification' => 'one_time',
            'billing_frequency' => 'one_time',
            'billing_months' => [7],
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonCount(1, 'charges')
            ->assertJsonPath('charges.0.billing_month', '2026-07')
            ->assertJsonPath('charges.0.description', 'Uniform');
    }

    public function test_monthly_generation_respects_fee_agreement_effective_dates(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view']);
        $agreement = $this->agreement($school, $student, 'monthly', '2026-03-15', '2026-05-10');
        $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonCount(3, 'charges')
            ->assertJsonPath('charges.0.billing_month', '2026-03')
            ->assertJsonPath('charges.1.billing_month', '2026-04')
            ->assertJsonPath('charges.2.billing_month', '2026-05');
    }

    public function test_termly_or_custom_item_without_billing_months_returns_warning_and_no_silent_charges(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view']);
        $agreement = $this->agreement($school, $student, 'termly');
        $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 3000, [
            'classification' => 'recurring',
            'billing_frequency' => 'termly',
            'billing_months' => null,
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonPath('needs_confirmation', true)
            ->assertJsonCount(0, 'charges')
            ->assertJsonPath('warnings.0.fee_code', 'TUITION')
            ->assertJsonPath('warnings.0.reason', 'billing_months_required');
    }

    public function test_custom_item_with_billing_month_numbers_generates_only_configured_actual_months(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $this->agreementItem($school, $agreement, 'TRANSPORT', 'TR', 'Transport', 400, [
            'classification' => 'optional_service',
            'billing_frequency' => 'custom',
            'billing_months' => [2, 6, 9],
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonPath('needs_confirmation', false)
            ->assertJsonCount(3, 'charges')
            ->assertJsonPath('charges.0.billing_month', '2026-02')
            ->assertJsonPath('charges.1.billing_month', '2026-06')
            ->assertJsonPath('charges.2.billing_month', '2026-09');
    }

    public function test_activate_rejects_duplicate_generation_for_same_student_agreement_and_year(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.generate']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertCreated();

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fee_record']);

        $this->assertDatabaseCount('fee_record_charges', 12);
    }

    public function test_discounted_agreement_cannot_preview_or_activate_until_billing_rules_are_approved(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view', 'fee_record.generate']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000);
        FeeAgreementDiscount::query()->create([
            'school_id' => $school->id,
            'fee_agreement_id' => $agreement->id,
            'discount_label' => 'Sibling discount',
            'discount_type' => 'percentage',
            'scope' => 'tuition_only',
            'value' => 10,
            'remark' => 'Formula not approved for charge generation.',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fee_record']);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fee_record']);

        $this->assertDatabaseCount('fee_record_charges', 0);
    }

    public function test_preview_confirmation_flag_blocks_activation(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view', 'fee_record.generate']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $item = $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000, [
            'requires_preview_confirmation' => true,
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/preview?academic_year=2026")
            ->assertOk()
            ->assertJsonPath('needs_confirmation', true)
            ->assertJsonPath('warnings.0.fee_agreement_item_id', $item->id)
            ->assertJsonPath('warnings.0.reason', 'preview_confirmation_required');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fee_record']);

        $this->assertDatabaseCount('fee_record_charges', 0);
    }

    public function test_outstanding_endpoint_returns_only_billable_unpaid_or_partial_charge_cells(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_record.view', 'fee_record.generate']);
        $agreement = $this->agreement($school, $student, 'monthly');
        $this->agreementItem($school, $agreement, 'TUITION', 'SF+MF', 'Tuition Fee', 1000);

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertCreated();

        \App\Models\FeeRecordCharge::query()->where('billing_month', '2026-01')->update([
            'paid_amount_cached' => 1000,
            'outstanding_amount_cached' => 0,
            'collection_status' => 'paid',
        ]);
        \App\Models\FeeRecordCharge::query()->where('billing_month', '2026-02')->update([
            'paid_amount_cached' => 400,
            'outstanding_amount_cached' => 600,
            'collection_status' => 'partial',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/students/{$student->id}/fee-record/outstanding?academic_year=2026")
            ->assertOk()
            ->assertJsonCount(11, 'data')
            ->assertJsonPath('data.0.billing_month', '2026-02')
            ->assertJsonPath('data.0.outstanding_amount', 600)
            ->assertJsonMissing(['billing_month' => '2026-01']);
    }

    public function test_schema_supports_manual_future_charge_cells_and_fee_agreement_billing_config(): void
    {
        $this->assertTrue(Schema::hasTable('fee_record_charges'));
        $this->assertTrue(Schema::hasColumn('fee_record_charges', 'charge_origin'));
        $this->assertTrue(Schema::hasColumn('fee_record_charges', 'source_type'));
        $this->assertTrue(Schema::hasColumn('fee_agreement_items', 'classification'));
        $this->assertTrue(Schema::hasColumn('fee_agreement_items', 'billing_frequency'));
        $this->assertTrue(Schema::hasColumn('fee_agreement_items', 'billing_months'));
        $this->assertTrue(Schema::hasColumn('fee_agreement_items', 'requires_preview_confirmation'));
    }

    public function test_fee_agreement_create_accepts_item_billing_configuration(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    [
                        'fee_item_id' => $tuition->id,
                        'amount' => 1000,
                        'classification' => 'recurring',
                        'billing_frequency' => 'monthly',
                    ],
                    [
                        'fee_item_id' => $misc->id,
                        'amount' => 120,
                        'classification' => 'one_time',
                        'billing_frequency' => 'one_time',
                        'billing_months' => [7],
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('fee_agreement.items.1.billing_frequency', 'one_time')
            ->assertJsonPath('fee_agreement.items.1.billing_months.0', 7);
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

    private function agreement(
        School $school,
        Student $student,
        string $paymentPlan,
        string $effectiveFrom = '2026-01-01',
        ?string $effectiveTo = '2026-12-31',
    ): FeeAgreement
    {
        return FeeAgreement::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'academic_year' => '2026',
            'version_no' => 1,
            'payment_plan' => $paymentPlan,
            'effective_from' => $effectiveFrom,
            'effective_to' => $effectiveTo,
            'is_current' => true,
            'status' => 'active',
        ]);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function agreementItem(
        School $school,
        FeeAgreement $agreement,
        string $code,
        string $category,
        string $description,
        float $amount,
        array $overrides = [],
    ): FeeAgreementItem {
        $feeItem = $this->feeItem($school, $code, $description, $category);

        return FeeAgreementItem::query()->create([
            'school_id' => $school->id,
            'fee_agreement_id' => $agreement->id,
            'fee_item_id' => $feeItem->id,
            'fee_code' => $code,
            'fee_category' => $category,
            'description' => $description,
            'amount' => $amount,
            'is_mandatory' => in_array($code, ['TUITION', 'MISC'], true),
            'sort_order' => 1,
            ...$overrides,
        ]);
    }

    private function feeItem(School $school, string $code, string $name, string $category): FeeItem
    {
        return FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $code,
            'name' => $name.' '.uniqid(),
            'category' => $category,
            'fee_type' => $code === 'UNIFORM' ? 'one_time' : 'recurring',
            'default_amount' => 0,
            'status' => 'active',
        ]);
    }
}
