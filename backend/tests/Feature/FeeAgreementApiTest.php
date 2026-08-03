<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeItem;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeAgreementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_admin_can_create_fee_agreement_with_mandatory_fee_items(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'remarks' => 'Initial enrollment pricing.',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
                'discounts' => [
                    [
                        'discount_label' => 'Manual scholarship',
                        'discount_type' => 'fixed_amount',
                        'value' => 100,
                        'remark' => 'Approved manually by admin.',
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('fee_agreement.student.student_no', 'MIS-STD-0001')
            ->assertJsonPath('fee_agreement.version_no', 1)
            ->assertJsonPath('fee_agreement.is_current', true)
            ->assertJsonPath('fee_agreement.discounts.0.scope', 'total_payable');

        $agreement = FeeAgreement::query()->with(['items', 'discounts'])->firstOrFail();
        $this->assertTrue($agreement->items->contains('fee_code', 'TUITION'));
        $this->assertTrue($agreement->items->contains('fee_code', 'MISC'));
        $this->assertSame('total_payable', $agreement->discounts->first()->scope);
    }

    public function test_fee_agreement_requires_tuition_and_misc_items(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);
    }

    public function test_superseding_current_fee_agreement_preserves_old_version(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create', 'fee_agreements.update']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])
            ->assertCreated();

        $current = FeeAgreement::query()->firstOrFail();

        $this->actingAs($admin)
            ->postJson("/api/fee-agreements/{$current->id}/supersede", [
                'effective_from' => '2026-06-01',
                'remarks' => 'Manual mid-year adjustment.',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 820],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('fee_agreement.version_no', 2)
            ->assertJsonPath('fee_agreement.is_current', true);

        $current->refresh();
        $this->assertSame('superseded', $current->status);
        $this->assertFalse($current->is_current);
        $this->assertSame('2026-05-31', $current->effective_to->toDateString());

        $this->assertSame(1, FeeAgreement::query()
            ->where('student_id', $student->id)
            ->where('academic_year', '2026')
            ->where('is_current', true)
            ->count());
    }

    public function test_supersede_is_blocked_when_old_agreement_has_future_charge_history(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser([
            'fee_agreements.create',
            'fee_agreements.update',
            'fee_record.generate',
        ]);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])->assertCreated();

        $current = FeeAgreement::query()->firstOrFail();

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-record/activate", ['academic_year' => '2026'])
            ->assertCreated();

        $this->actingAs($admin)
            ->postJson("/api/fee-agreements/{$current->id}/supersede", [
                'effective_from' => '2026-06-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 820],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])
            ->assertConflict()
            ->assertJsonPath('message', 'Fee Agreement cannot be superseded while charge history exists on or after the new effective month.');

        $current->refresh();
        $this->assertTrue($current->is_current);
        $this->assertSame('active', $current->status);
        $this->assertDatabaseCount('fee_agreements', 1);
        $this->assertDatabaseCount('fee_record_charges', 24);
    }

    public function test_superseding_fee_agreement_stores_item_billing_configuration(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create', 'fee_agreements.update']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');
        $uniform = $this->feeItem($school, 'UNIFORM', 'Uniform', 'optional');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
            ])
            ->assertCreated();

        $current = FeeAgreement::query()->firstOrFail();

        $this->actingAs($admin)
            ->postJson("/api/fee-agreements/{$current->id}/supersede", [
                'effective_from' => '2026-02-01',
                'items' => [
                    [
                        'fee_item_id' => $tuition->id,
                        'amount' => 800,
                        'classification' => 'recurring',
                        'billing_frequency' => 'termly',
                        'billing_months' => [2, 6, 9],
                    ],
                    [
                        'fee_item_id' => $misc->id,
                        'amount' => 90,
                        'classification' => 'recurring',
                        'billing_frequency' => 'yearly',
                        'billing_months' => [1],
                    ],
                    [
                        'fee_item_id' => $uniform->id,
                        'amount' => 120,
                        'classification' => 'one_time',
                        'billing_frequency' => 'one_time',
                        'billing_months' => [7],
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('fee_agreement.items.0.billing_frequency', 'termly')
            ->assertJsonPath('fee_agreement.items.0.billing_months', [2, 6, 9])
            ->assertJsonPath('fee_agreement.items.2.classification', 'one_time')
            ->assertJsonPath('fee_agreement.items.2.billing_frequency', 'one_time')
            ->assertJsonPath('fee_agreement.items.2.billing_months', [7]);
    }

    public function test_fee_agreement_item_billing_month_rules_are_validated(): void
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
                        'amount' => 800,
                        'classification' => 'recurring',
                        'billing_frequency' => 'termly',
                        'billing_months' => [],
                    ],
                    [
                        'fee_item_id' => $misc->id,
                        'amount' => 90,
                        'classification' => 'recurring',
                        'billing_frequency' => 'yearly',
                        'billing_months' => [1, 7],
                    ],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'items.0.billing_months',
                'items.1.billing_months',
            ]);
    }

    public function test_fee_agreement_rejects_ambiguous_year_duplicate_items_and_invalid_money(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');

        foreach ([
            ['academic_year' => '2026/2027', 'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => 800],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ], 'error' => 'academic_year'],
            ['academic_year' => '2026', 'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => 800],
                ['fee_item_id' => $tuition->id, 'amount' => 800],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ], 'error' => 'items.1.fee_item_id'],
            ['academic_year' => '2026', 'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => '800.001'],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ], 'error' => 'items.0.amount'],
            ['academic_year' => '2026', 'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => '100000000.00'],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ], 'error' => 'items.0.amount'],
        ] as $case) {
            $this->actingAs($admin)
                ->postJson("/api/students/{$student->id}/fee-agreements", [
                    'academic_year' => $case['academic_year'],
                    'payment_plan' => 'monthly',
                    'effective_from' => '2026-01-01',
                    'items' => $case['items'],
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors([$case['error']]);
        }

        $this->assertDatabaseCount('fee_agreements', 0);
    }

    public function test_fee_agreement_rejects_cross_school_fee_item_without_server_error(): void
    {
        [$school, $student, $admin] = $this->schoolStudentAndUser(['fee_agreements.create']);
        $tuition = $this->feeItem($school, 'TUITION', 'Tuition Fee', 'mandatory');
        $misc = $this->feeItem($school, 'MISC', 'Misc Fee', 'mandatory');
        $otherSchool = School::query()->create([
            'code' => 'OTH',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherItem = $this->feeItem($otherSchool, 'UNIFORM', 'Uniform', 'optional');

        $this->actingAs($admin)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                    ['fee_item_id' => $otherItem->id, 'amount' => 120],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.2.fee_item_id']);

        $this->assertDatabaseCount('fee_agreements', 0);
    }

    public function test_selected_discount_codes_and_percentage_are_strictly_validated(): void
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
                    ['fee_item_id' => $tuition->id, 'amount' => 800],
                    ['fee_item_id' => $misc->id, 'amount' => 90],
                ],
                'discounts' => [[
                    'discount_label' => 'Invalid discount',
                    'discount_type' => 'percentage',
                    'scope' => 'selected_fee_items',
                    'value' => 101,
                    'remark' => 'Test validation.',
                    'selected_fee_codes' => ['UNKNOWN', 'UNKNOWN'],
                ]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'discounts.0.value',
                'discounts.0.selected_fee_codes.1',
                'discounts.0.selected_fee_codes',
            ]);

        $this->assertDatabaseCount('fee_agreements', 0);
    }

    public function test_finance_user_can_view_but_cannot_create_fee_agreement(): void
    {
        [$school, $student, $finance] = $this->schoolStudentAndUser(['fee_agreements.view']);

        $this->actingAs($finance)
            ->getJson("/api/students/{$student->id}/fee-agreements")
            ->assertOk();

        $this->actingAs($finance)
            ->postJson("/api/students/{$student->id}/fee-agreements", [
                'academic_year' => '2026',
                'payment_plan' => 'monthly',
                'effective_from' => '2026-01-01',
                'items' => [],
            ])
            ->assertForbidden();
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

        return [$school, $student, $user];
    }

    private function feeItem(School $school, string $code, string $name, string $category): FeeItem
    {
        return FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => $code,
            'name' => $name,
            'category' => $category,
            'fee_type' => 'recurring',
            'default_amount' => 0,
            'status' => 'active',
        ]);
    }
}
