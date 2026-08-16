<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParentReceiptDetailApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_parent_can_view_an_authoritative_receipt_snapshot_for_their_child(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $receipt = $this->createReceipt($student, 'MIS.A0001 (08/2026)');

        $this->actingAs($parent)
            ->getJson("http://127.0.0.1/api/v1/portal/parent/children/{$student->id}/receipts/{$receipt->id}")
            ->assertOk()
            ->assertJsonPath('data.receipt_no', 'MIS.A0001 (08/2026)')
            ->assertJsonPath('data.student_no', 'MIS-2026-001')
            ->assertJsonPath('data.student_name', 'Alyssa Tan')
            ->assertJsonPath('data.amount', 2670)
            ->assertJsonPath('data.amount_in_words', 'Two Thousand Six Hundred Seventy Ringgit Only')
            ->assertJsonPath('data.items.0.fee_code', 'TUITION')
            ->assertJsonPath('data.items.0.amount', 2670);
    }

    public function test_parent_cannot_open_another_childs_receipt_through_the_selected_child_url(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $selectedChild = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $otherChild = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $receipt = $this->createReceipt($otherChild, 'MIS.A0002 (08/2026)');

        $this->actingAs($parent)
            ->getJson("http://127.0.0.1/api/v1/portal/parent/children/{$selectedChild->id}/receipts/{$receipt->id}")
            ->assertForbidden();
    }

    public function test_parent_receipt_detail_requires_the_finance_capability_link(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $receipt = $this->createReceipt($student, 'MIS.A0003 (08/2026)');
        $parent->guardianProfile->students()->updateExistingPivot($student->id, ['can_view_finance' => false]);

        $this->actingAs($parent)
            ->getJson("http://127.0.0.1/api/v1/portal/parent/children/{$student->id}/receipts/{$receipt->id}")
            ->assertForbidden();
    }

    private function createReceipt(Student $student, string $receiptNo): Receipt
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $payment = Payment::query()->create([
            'school_id' => $student->school_id,
            'student_id' => $student->id,
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-08-10',
            'received_date' => '2026-08-10',
            'amount' => '2670.00',
            'paid_by' => 'Rachel Wong',
            'reference_no' => 'TEST-'.$receiptNo,
            'status' => 'verified',
            'recorded_by' => $admin->id,
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);
        $receipt = Receipt::query()->create([
            'school_id' => $student->school_id,
            'payment_id' => $payment->id,
            'active_payment_id' => $payment->id,
            'student_id' => $student->id,
            'student_no' => $student->student_no,
            'student_name' => $student->full_name,
            'paid_by' => 'Rachel Wong',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-08-10',
            'received_date' => '2026-08-10',
            'receipt_date' => '2026-08-10',
            'receipt_no' => $receiptNo,
            'amount' => '2670.00',
            'amount_in_words' => 'Two Thousand Six Hundred Seventy Ringgit Only',
            'status' => 'issued',
            'issued_by' => $admin->id,
            'issued_at' => now(),
        ]);
        ReceiptItem::query()->create([
            'school_id' => $student->school_id,
            'receipt_id' => $receipt->id,
            'fee_code' => 'TUITION',
            'description' => 'Tuition Fee August',
            'amount' => '2670.00',
            'sort_order' => 1,
        ]);

        return $receipt;
    }
}
