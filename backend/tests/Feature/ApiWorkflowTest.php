<?php

namespace Tests\Feature;

use App\Models\FeeRecordCharge;
use App\Models\School;
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

        $school = School::query()->where('code', 'MIS')->firstOrFail();
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
            ->assertJsonPath('school.code', 'MIS')
            ->assertJsonPath('metrics.active_students', 4)
            ->assertJsonPath('metrics.invoices_this_month', 3);

        $this->assertSame($expectedOutstanding, (float) $dashboardResponse->json('metrics.outstanding_fees'));
    }

    public function test_legacy_invoice_first_payment_endpoint_is_not_available(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
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
}
