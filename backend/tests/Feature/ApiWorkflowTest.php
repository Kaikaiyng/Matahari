<?php

namespace Tests\Feature;

use App\Models\FeeRecordCharge;
use App\Models\Invoice;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\DemoScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_generation_and_dashboard_api_flow(): void
    {
        $this->seed();
        $this->seed(DemoScenarioSeeder::class);

        $school = School::query()->where('code', 'DEMO')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $expectedOutstanding = (float) FeeRecordCharge::query()
            ->where('school_id', $school->id)
            ->where('academic_year', '2026')
            ->sum('outstanding_amount_cached');

        $this->assertGreaterThan(0, $expectedOutstanding);

        $this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])
            ->assertCreated()
            ->assertJsonPath('created_count', 3)
            ->assertJsonPath('skipped_count', 1);

        $dashboardResponse = $this->actingAs($admin)
            ->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07&academic_year=2026')
            ->assertOk()
            ->assertJsonPath('school.code', 'DEMO')
            ->assertJsonPath('metrics.active_students', 4)
            ->assertJsonPath('metrics.invoices_this_month', 3);

        $this->assertSame($expectedOutstanding, (float) $dashboardResponse->json('metrics.outstanding_fees'));
    }

    public function test_legacy_invoice_first_payment_endpoint_is_not_available(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'DEMO')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])->assertCreated();

        $this->postJson('/api/payments', [
            'invoice_id' => 1,
            'payment_date' => '2026-07-05',
            'amount' => 400,
            'method' => 'cash',
        ])->assertNotFound();
    }

    public function test_school_bound_user_cannot_read_or_generate_for_another_school(): void
    {
        $this->seed();

        $otherSchool = School::query()->create([
            'code' => 'OTH',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)
            ->getJson('/api/dashboard/school?school_id='.$otherSchool->id.'&academic_year=2026')
            ->assertForbidden();

        $this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $otherSchool->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])->assertForbidden();

        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_invoice_generation_ignores_forged_actor_and_uses_authenticated_user(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'DEMO')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();

        $this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
            'created_by' => $superAdmin->id,
        ])->assertCreated();

        $this->assertSame($admin->id, Invoice::query()->firstOrFail()->created_by);
    }

    public function test_finance_role_cannot_call_legacy_invoice_generation(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'DEMO')->firstOrFail();
        $finance = User::query()->where('username', 'finance')->firstOrFail();

        $this->actingAs($finance)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])->assertForbidden();
    }

    public function test_seeded_super_admin_defaults_to_the_single_school_and_rejects_another_scope(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('username', 'superadmin')->firstOrFail();
        $school = School::query()->where('code', 'DEMO')->firstOrFail();

        $this->assertSame($school->id, $superAdmin->school_id);

        $this->actingAs($superAdmin)
            ->getJson('/api/dashboard/school?academic_year=2026')
            ->assertOk()
            ->assertJsonPath('school.id', $school->id);

        $this->actingAs($superAdmin)
            ->getJson('/api/dashboard/school?school_id=999999&academic_year=2026')
            ->assertForbidden();
    }

    public function test_invoice_generation_rejects_a_class_from_another_school(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'DEMO')->firstOrFail();
        $otherSchool = School::query()->create([
            'code' => 'OTH',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH-INV',
            'status' => 'active',
        ]);
        $otherClass = SchoolClass::query()->create([
            'school_id' => $otherSchool->id,
            'name' => 'Other Class',
            'status' => 'active',
        ]);
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'class_id' => $otherClass->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['class_id']);

        $this->assertDatabaseCount('invoices', 0);
    }
}
