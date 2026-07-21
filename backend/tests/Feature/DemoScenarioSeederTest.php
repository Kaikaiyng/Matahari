<?php

namespace Tests\Feature;

use App\Models\FeeAgreement;
use App\Models\FeeRecordCharge;
use App\Models\Receipt;
use App\Models\Student;
use Database\Seeders\DemoScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoScenarioSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seed_creates_clean_and_varied_demo_finance_scenarios(): void
    {
        $this->seed();
        $this->seed(DemoScenarioSeeder::class);

        $this->assertSame([
            'Alyssa Tan',
            'Daniel Lim',
            'Mika Wong',
            'Noor Aisyah',
        ], Student::query()->orderBy('student_no')->pluck('full_name')->all());

        $this->assertSame(0, Student::query()->where('full_name', 'like', 'QA%')->count());

        $alyssa = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $daniel = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $mika = Student::query()->where('student_no', 'MIS-2026-003')->firstOrFail();
        $noor = Student::query()->where('student_no', 'MIS-2026-004')->firstOrFail();

        $this->assertTrue(FeeRecordCharge::query()
            ->where('student_id', $alyssa->id)
            ->where('collection_status', 'unpaid')
            ->exists());

        $this->assertGreaterThan(0, FeeRecordCharge::query()->where('student_id', $daniel->id)->count());
        $this->assertSame(0, FeeRecordCharge::query()
            ->where('student_id', $daniel->id)
            ->where('collection_status', '!=', 'paid')
            ->count());
        $this->assertTrue(Receipt::query()
            ->where('student_id', $daniel->id)
            ->where('status', 'issued')
            ->exists());

        $this->assertTrue(FeeRecordCharge::query()
            ->where('student_id', $mika->id)
            ->where('collection_status', 'partial')
            ->exists());

        $this->assertSame(0, FeeAgreement::query()->where('student_id', $noor->id)->count());
        $this->assertSame(0, FeeRecordCharge::query()->where('student_id', $noor->id)->count());
    }
}
