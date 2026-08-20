<?php

namespace Database\Seeders;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\Guardian;
use App\Models\Payment;
use App\Models\PortalNotification;
use App\Models\Receipt;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Services\Billing\FeeRecordChargeGenerationService;
use App\Services\Billing\PaymentRecordingService;
use App\Services\Billing\ReceiptGenerationService;
use Illuminate\Database\Seeder;

class DemoScenarioSeeder extends Seeder
{
    public function run(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $yearTwo = SchoolClass::query()
            ->where('school_id', $school->id)
            ->where('name', 'MB1')
            ->firstOrFail();

        $this->createUnconfiguredStudent($school, $yearTwo);

        $tuition = FeeItem::query()
            ->where('school_id', $school->id)
            ->where('code', 'TUITION')
            ->firstOrFail();
        $misc = FeeItem::query()
            ->where('school_id', $school->id)
            ->where('code', 'MISC')
            ->firstOrFail();

        $alyssa = Student::query()->where('school_id', $school->id)->where('student_no', 'MIS-2026-001')->firstOrFail();
        $daniel = Student::query()->where('school_id', $school->id)->where('student_no', 'MIS-2026-002')->firstOrFail();
        $mika = Student::query()->where('school_id', $school->id)->where('student_no', 'MIS-2026-003')->firstOrFail();

        $this->activateAgreement($alyssa, $admin, [$tuition, $misc], [7, 8, 9]);
        $this->activateAgreement($daniel, $admin, [$tuition, $misc], [7, 8, 9]);
        $this->activateAgreement($mika, $admin, [$tuition, $misc], [7, 8, 9]);

        $this->createPaidScenario($daniel, $admin);
        $this->createPartialScenario($mika, $admin);
        $this->createDemoNotifications($school);
    }

    private function createUnconfiguredStudent(School $school, SchoolClass $schoolClass): void
    {
        $student = Student::query()->updateOrCreate(
            ['school_id' => $school->id, 'student_no' => 'MIS-2026-004'],
            [
                'class_id' => $schoolClass->id,
                'level_group' => 'primary',
                'full_name' => 'Noor Aisyah',
                'gender' => null,
                'registration_date' => '2026-07-01',
                'status' => 'active',
                'notes' => 'New enrolment awaiting fee agreement.',
            ],
        );

        $guardian = Guardian::query()->updateOrCreate(
            ['school_id' => $school->id, 'phone' => '+60 12-100 0004'],
            [
                'full_name' => 'Siti Rahmah',
                'email' => null,
                'address' => 'Malaysia',
                'emergency_contact' => '+60 12-100 0004',
            ],
        );

        $student->parents()->syncWithoutDetaching([
            $guardian->id => [
                'school_id' => $school->id,
                'relationship' => 'guardian',
                'is_primary_contact' => true,
            ],
        ]);
    }

    /**
     * @param  array<int, FeeItem>  $feeItems
     * @param  array<int, int>  $billingMonths
     */
    private function activateAgreement(Student $student, User $admin, array $feeItems, array $billingMonths): void
    {
        $agreement = FeeAgreement::query()->updateOrCreate(
            [
                'school_id' => $student->school_id,
                'student_id' => $student->id,
                'academic_year' => '2026',
                'version_no' => 1,
            ],
            [
                'agreement_no' => 'FA-2026-'.$student->student_no,
                'payment_plan' => 'custom',
                'effective_from' => '2026-01-01',
                'effective_to' => '2026-12-31',
                'is_current' => true,
                'status' => 'active',
                'remarks' => 'Fee agreement',
                'created_by' => $admin->id,
                'updated_by' => $admin->id,
            ],
        );

        foreach ($feeItems as $index => $feeItem) {
            FeeAgreementItem::query()->updateOrCreate(
                [
                    'school_id' => $student->school_id,
                    'fee_agreement_id' => $agreement->id,
                    'fee_item_id' => $feeItem->id,
                ],
                [
                    'fee_code' => $feeItem->code,
                    'fee_category' => $feeItem->category,
                    'description' => $feeItem->name,
                    'amount' => $feeItem->default_amount,
                    'is_mandatory' => $feeItem->category === 'mandatory',
                    'sort_order' => $index + 1,
                    'classification' => 'recurring',
                    'billing_frequency' => 'custom',
                    'billing_months' => $billingMonths,
                    'requires_preview_confirmation' => false,
                ],
            );
        }

        $hasCharges = FeeRecordCharge::query()
            ->where('school_id', $student->school_id)
            ->where('student_id', $student->id)
            ->where('fee_agreement_id', $agreement->id)
            ->where('academic_year', '2026')
            ->exists();

        if (! $hasCharges) {
            app(FeeRecordChargeGenerationService::class)->activate($student, '2026');
        }
    }

    private function createPaidScenario(Student $student, User $admin): void
    {
        $payment = Payment::query()
            ->where('student_id', $student->id)
            ->where('remark', 'Fully paid account')
            ->first();

        if (! $payment) {
            $charges = FeeRecordCharge::query()
                ->where('student_id', $student->id)
                ->where('billing_status', 'billable')
                ->orderBy('billing_month')
                ->orderBy('id')
                ->get();
            $amount = (float) $charges->sum('outstanding_amount_cached');

            $payment = app(PaymentRecordingService::class)->createForStudent($student, [
                'payment_method' => 'cash',
                'payment_date' => '2026-08-10',
                'received_date' => '2026-08-10',
                'amount' => $amount,
                'paid_by' => 'Jonathan Lim',
                'remark' => 'Fully paid account',
                'academic_year' => '2026',
                'allocations' => $charges->map(fn (FeeRecordCharge $charge) => [
                    'allocation_type' => 'charge',
                    'fee_record_charge_id' => $charge->id,
                    'description' => $charge->description,
                    'amount' => (float) $charge->outstanding_amount_cached,
                ])->all(),
            ], $admin);
        }

        $hasReceipt = Receipt::query()
            ->where('payment_id', $payment->id)
            ->where('status', 'issued')
            ->exists();

        if (! $hasReceipt) {
            app(ReceiptGenerationService::class)->generate($payment, [
                'receipt_date' => '2026-08-10',
                'paid_by' => 'Jonathan Lim',
            ], $admin);
        }
    }

    private function createPartialScenario(Student $student, User $admin): void
    {
        if (Payment::query()->where('student_id', $student->id)->where('remark', 'Partial payment')->exists()) {
            return;
        }

        $charge = FeeRecordCharge::query()
            ->where('student_id', $student->id)
            ->where('billing_status', 'billable')
            ->where('outstanding_amount_cached', '>', 400)
            ->orderBy('billing_month')
            ->orderByDesc('expected_amount')
            ->firstOrFail();

        app(PaymentRecordingService::class)->createForStudent($student, [
            'payment_method' => 'cash',
            'payment_date' => '2026-08-12',
            'received_date' => '2026-08-12',
            'amount' => 400,
            'paid_by' => 'Rachel Wong',
            'remark' => 'Partial payment',
            'academic_year' => '2026',
            'allocations' => [[
                'allocation_type' => 'charge',
                'fee_record_charge_id' => $charge->id,
                'description' => $charge->description,
                'amount' => 400,
            ]],
        ], $admin);
    }

    private function createDemoNotifications(School $school): void
    {
        $parent = User::query()->where('school_id', $school->id)->where('username', 'rachel.wong')->first();
        $student = User::query()->where('school_id', $school->id)->where('username', 'alyssa.tan')->first();
        $teacher = User::query()->where('school_id', $school->id)->where('username', 'teacher.lim')->first();
        if (! $parent && ! $student && ! $teacher) {
            return;
        }

        if ($parent) {
            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $parent->id, 'title' => 'Term 3 Fee Invoice Issued'],
                [
                    'type' => 'finance',
                    'body' => 'Fee invoice for Term 3 (2026) has been generated. Please view outstanding balance and payment history in Finance tab.',
                    'read_at' => null,
                    'created_at' => now()->subHours(2),
                ],
            );

            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $parent->id, 'title' => 'Attendance Update: Grade MB1'],
                [
                    'type' => 'attendance',
                    'body' => 'Alyssa Tan was marked Present for Morning Roll Call today.',
                    'read_at' => now()->subHours(5),
                    'created_at' => now()->subHours(6),
                ],
            );

            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $parent->id, 'title' => 'New Assessment Result Published'],
                [
                    'type' => 'academic',
                    'body' => 'Mathematics Quiz 1 results for Alyssa Tan have been published. Tap to review scores and teacher comments.',
                    'read_at' => null,
                    'created_at' => now()->subDays(1),
                ],
            );
        }

        if ($student) {
            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $student->id, 'title' => 'Parent-Teacher Conference Scheduled'],
                [
                    'type' => 'general',
                    'body' => 'Mid-term Parent-Teacher Conference will be held on Friday, August 28th. Please confirm attendance with your class teacher.',
                    'read_at' => null,
                    'created_at' => now()->subDays(1),
                ],
            );

            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $student->id, 'title' => 'New Science Quiz Available'],
                [
                    'type' => 'academic',
                    'body' => 'Unit 2: Ecosystems & Plants formal quiz is now open for submission in the Quiz tab.',
                    'read_at' => null,
                    'created_at' => now()->subHours(4),
                ],
            );

            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $student->id, 'title' => 'School Timetable Updated'],
                [
                    'type' => 'general',
                    'body' => 'Thursday physical education session moved to Sports Hall A starting this week.',
                    'read_at' => now()->subDays(2),
                    'created_at' => now()->subDays(2),
                ],
            );
        }

        if ($teacher) {
            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $teacher->id, 'title' => 'Morning Attendance Roll Submitted'],
                [
                    'type' => 'attendance',
                    'body' => 'Attendance for Grade MB1 has been recorded successfully for today.',
                    'read_at' => null,
                    'created_at' => now()->subHours(3),
                ],
            );

            PortalNotification::query()->updateOrCreate(
                ['school_id' => $school->id, 'recipient_user_id' => $teacher->id, 'title' => 'Community Standards Update'],
                [
                    'type' => 'community_moderation',
                    'body' => 'New community media posting guidelines are now in effect for all academic staff.',
                    'read_at' => null,
                    'created_at' => now()->subDays(1),
                ],
            );
        }
    }
}
