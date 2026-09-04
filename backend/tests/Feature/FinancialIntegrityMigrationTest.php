<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\FeeRecordCharge;
use App\Models\School;
use App\Models\Student;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FinancialIntegrityMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_enforces_one_current_agreement_per_student_and_year(): void
    {
        [$school, $student] = $this->schoolAndStudent();

        $this->assertTrue(Schema::hasColumn('fee_agreements', 'current_slot'));

        FeeAgreement::query()->create($this->agreementAttributes($school, $student, 1));

        try {
            DB::transaction(fn () => FeeAgreement::query()->create($this->agreementAttributes($school, $student, 2)));
            $this->fail('A duplicate current Fee Agreement was accepted.');
        } catch (QueryException) {
            $this->assertDatabaseCount('fee_agreements', 1);
        }
    }

    public function test_schema_enforces_one_scheduled_charge_per_agreement_item_and_month(): void
    {
        [$school, $student] = $this->schoolAndStudent();
        $agreement = FeeAgreement::query()->create($this->agreementAttributes($school, $student, 1));
        $feeItem = FeeItem::query()->create([
            'school_id' => $school->id,
            'code' => 'TUITION',
            'name' => 'Tuition Fee',
            'category' => 'mandatory',
            'fee_type' => 'recurring',
            'default_amount' => 1000,
            'status' => 'active',
        ]);
        $agreementItem = FeeAgreementItem::query()->create([
            'school_id' => $school->id,
            'fee_agreement_id' => $agreement->id,
            'fee_item_id' => $feeItem->id,
            'fee_code' => 'TUITION',
            'fee_category' => 'mandatory',
            'description' => 'Tuition Fee',
            'amount' => 1000,
            'is_mandatory' => true,
            'sort_order' => 1,
        ]);
        $attributes = [
            'school_id' => $school->id,
            'student_id' => $student->id,
            'fee_agreement_id' => $agreement->id,
            'fee_agreement_item_id' => $agreementItem->id,
            'fee_item_id' => $feeItem->id,
            'academic_year' => '2026',
            'billing_month' => '2026-01',
            'fee_record_category' => 'SF+MF',
            'fee_code' => 'TUITION',
            'description' => 'Tuition Fee',
            'expected_amount' => 1000,
            'paid_amount_cached' => 0,
            'outstanding_amount_cached' => 1000,
            'billing_status' => 'billable',
            'collection_status' => 'unpaid',
            'charge_origin' => 'scheduled',
            'source_type' => 'agreement_item',
        ];

        FeeRecordCharge::query()->create($attributes);

        try {
            DB::transaction(fn () => FeeRecordCharge::query()->create($attributes));
            $this->fail('A duplicate scheduled charge was accepted.');
        } catch (QueryException) {
            $this->assertDatabaseCount('fee_record_charges', 1);
        }
    }

    /**
     * @return array{0: School, 1: Student}
     */
    private function schoolAndStudent(): array
    {
        $school = $this->createTenantSchool([
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

        return [$school, $student];
    }

    /**
     * @return array<string, mixed>
     */
    private function agreementAttributes(School $school, Student $student, int $version): array
    {
        return [
            'school_id' => $school->id,
            'student_id' => $student->id,
            'academic_year' => '2026',
            'version_no' => $version,
            'payment_plan' => 'monthly',
            'effective_from' => '2026-01-01',
            'effective_to' => '2026-12-31',
            'is_current' => true,
            'current_slot' => 1,
            'status' => 'active',
        ];
    }
}
