<?php

namespace Tests\Feature;

use App\Models\FeeItem;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
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
        $feeItem = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $admin = User::query()->where('email', 'admin@mis.test')->firstOrFail();

        $firstPayment = Payment::query()->create([
            'school_id' => $school->id,
            'student_id' => $student->id,
            'payment_date' => '2026-07-05',
            'received_date' => '2026-07-05',
            'amount' => 400,
            'payment_method' => 'cash',
            'status' => 'verified',
            'recorded_by' => $admin->id,
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);

        $firstPayment->allocations()->create([
            'school_id' => $school->id,
            'fee_item_id' => $feeItem->id,
            'fee_code' => $feeItem->code,
            'description' => $feeItem->name,
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
            'received_date' => '2026-07-06',
            'amount' => 520,
            'payment_method' => 'bank_transfer',
            'reference_no' => 'MBB123456',
            'status' => 'verified',
            'recorded_by' => $admin->id,
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);

        $secondPayment->allocations()->create([
            'school_id' => $school->id,
            'fee_item_id' => $feeItem->id,
            'fee_code' => $feeItem->code,
            'description' => $feeItem->name,
            'amount' => 520,
        ]);

        $secondReceipt = $receiptService->generateForPayment($secondPayment);

        $this->assertSame('MIS-2026-000002', $secondReceipt->receipt_no);
    }

    public function test_payment_recording_is_student_first_and_does_not_touch_invoice_or_receipt(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        app(InvoiceGenerationService::class)->generateMonthly($school->id, '2026-07', '2026-07-01', '2026-07-10');

        $student = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $invoice = $student->invoices()->firstOrFail();
        $feeItem = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $admin = User::query()->where('email', 'admin@mis.test')->firstOrFail();

        $service = app(PaymentRecordingService::class);
        $payment = $service->createForStudent($student, [
            'payment_method' => 'cash',
            'payment_date' => '2026-07-05',
            'received_date' => '2026-07-05',
            'amount' => 400,
            'remark' => 'Cash received at office.',
            'allocations' => [
                ['fee_item_id' => $feeItem->id, 'amount' => 400],
            ],
        ], $admin);

        $invoice->refresh();

        $this->assertSame('verified', $payment->status);
        $this->assertEquals(0.00, (float) $invoice->paid_amount);
        $this->assertEquals(920.00, (float) $invoice->outstanding_amount);
        $this->assertSame('pending', $invoice->status);
        $this->assertDatabaseCount('receipts', 0);
    }
}
