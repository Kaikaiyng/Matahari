<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Services\Billing\InvoiceGenerationService;
use App\Services\Billing\PaymentRecordingService;
use App\Services\Billing\ReceiptNumberService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_invoice_generation_snapshots_fees_and_discounts(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();

        $result = app(InvoiceGenerationService::class)->generateMonthly(
            schoolId: $school->id,
            invoiceMonth: '2026-07',
            issueDate: '2026-07-01',
            dueDate: '2026-07-10',
        );

        $this->assertSame(3, $result['created_count']);
        $this->assertSame(0, $result['skipped_count']);

        $invoice = Invoice::query()
            ->whereHas('student', fn ($query) => $query->where('student_no', 'MIS-2026-001'))
            ->with('items')
            ->firstOrFail();

        $this->assertSame('MIS-INV-2026-000001', $invoice->invoice_no);
        $this->assertSame('2026-07', $invoice->invoice_month);
        $this->assertEquals(970.00, (float) $invoice->subtotal);
        $this->assertEquals(97.00, (float) $invoice->discount_total);
        $this->assertEquals(873.00, (float) $invoice->grand_total);
        $this->assertEquals(873.00, (float) $invoice->outstanding_amount);

        $this->assertTrue($invoice->items->contains(fn ($item) => $item->description === 'Tuition Fee'));
        $this->assertTrue($invoice->items->contains(fn ($item) => $item->description === 'Registration'));
        $this->assertTrue($invoice->items->contains(fn ($item) => $item->description === 'Sibling Discount'));
    }

    public function test_monthly_invoice_generation_skips_existing_invoices(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $service = app(InvoiceGenerationService::class);

        $service->generateMonthly($school->id, '2026-07', '2026-07-01', '2026-07-10');
        $result = $service->generateMonthly($school->id, '2026-07', '2026-07-01', '2026-07-10');

        $this->assertSame(0, $result['created_count']);
        $this->assertSame(3, $result['skipped_count']);
        $this->assertSame(3, Invoice::query()->count());
    }

    public function test_receipt_numbers_are_sequential_and_idempotent_per_payment(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        app(InvoiceGenerationService::class)->generateMonthly($school->id, '2026-07', '2026-07-01', '2026-07-10');

        $student = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $invoice = $student->invoices()->firstOrFail();

        $firstPayment = Payment::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_date' => '2026-07-05',
            'amount' => 400,
            'method' => 'cash',
            'status' => 'confirmed',
        ]);

        $firstPayment->allocations()->create([
            'school_id' => $school->id,
            'invoice_id' => $invoice->id,
            'amount' => 400,
        ]);

        $receiptService = app(ReceiptNumberService::class);
        $firstReceipt = $receiptService->generateForPayment($firstPayment);
        $sameReceipt = $receiptService->generateForPayment($firstPayment);

        $this->assertSame($firstReceipt->id, $sameReceipt->id);
        $this->assertSame('MIS-2026-000001', $firstReceipt->receipt_no);

        $secondPayment = Payment::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_date' => '2026-07-06',
            'amount' => 520,
            'method' => 'bank_transfer',
            'reference_no' => 'MBB123456',
            'status' => 'confirmed',
        ]);

        $secondPayment->allocations()->create([
            'school_id' => $school->id,
            'invoice_id' => $invoice->id,
            'amount' => 520,
        ]);

        $secondReceipt = $receiptService->generateForPayment($secondPayment);

        $this->assertSame('MIS-2026-000002', $secondReceipt->receipt_no);
    }

    public function test_payment_recording_updates_invoice_balance_and_generates_receipt(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        app(InvoiceGenerationService::class)->generateMonthly($school->id, '2026-07', '2026-07-01', '2026-07-10');

        $student = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $invoice = $student->invoices()->firstOrFail();

        $service = app(PaymentRecordingService::class);
        $partialPayment = $service->recordForInvoice(
            invoiceId: $invoice->id,
            paymentDate: '2026-07-05',
            amount: 400,
            method: 'cash',
        );

        $invoice->refresh();

        $this->assertEquals(400.00, (float) $invoice->paid_amount);
        $this->assertEquals(520.00, (float) $invoice->outstanding_amount);
        $this->assertSame('partial', $invoice->status);
        $this->assertSame('MIS-2026-000001', $partialPayment->receipt->receipt_no);

        $fullPayment = $service->recordForInvoice(
            invoiceId: $invoice->id,
            paymentDate: '2026-07-06',
            amount: 520,
            method: 'bank_transfer',
            referenceNo: 'MBB123456',
        );

        $invoice->refresh();

        $this->assertEquals(920.00, (float) $invoice->paid_amount);
        $this->assertEquals(0.00, (float) $invoice->outstanding_amount);
        $this->assertSame('paid', $invoice->status);
        $this->assertSame('MIS-2026-000002', $fullPayment->receipt->receipt_no);
    }
}
