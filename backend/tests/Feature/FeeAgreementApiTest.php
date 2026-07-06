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
