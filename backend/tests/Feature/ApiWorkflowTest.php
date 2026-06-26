<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\School;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_generation_and_dashboard_api_flow(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();

        $this->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])
            ->assertCreated()
            ->assertJsonPath('created_count', 3)
            ->assertJsonPath('skipped_count', 0);

        $this->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07')
            ->assertOk()
            ->assertJsonPath('school.code', 'MIS')
            ->assertJsonPath('metrics.active_students', 3)
            ->assertJsonPath('metrics.invoices_this_month', 3)
            ->assertJsonPath('metrics.outstanding_fees', 2713);
    }

    public function test_payment_api_records_payment_and_generates_receipt(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();

        $this->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])->assertCreated();

        $invoice = Invoice::query()
            ->whereHas('student', fn ($query) => $query->where('student_no', 'MIS-2026-002'))
            ->firstOrFail();

        $this->postJson('/api/payments', [
            'invoice_id' => $invoice->id,
            'payment_date' => '2026-07-05',
            'amount' => 400,
            'method' => 'cash',
        ])
            ->assertCreated()
            ->assertJsonPath('payment.amount', 400)
            ->assertJsonPath('payment.receipt_no', 'MIS-2026-000001');

        $invoice->refresh();

        $this->assertSame('partial', $invoice->status);
        $this->assertEquals(400.00, (float) $invoice->paid_amount);
        $this->assertEquals(520.00, (float) $invoice->outstanding_amount);
    }
}
