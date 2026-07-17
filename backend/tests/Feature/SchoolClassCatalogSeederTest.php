<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\SchoolClassSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchoolClassCatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_the_school_class_catalog(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(
            ['Kindergarten', 'MA1', 'MB1', 'MC1', 'MD1', 'ME1', 'MF1', 'MP1', 'MQ1', 'MR1', 'MS1', 'MT1', 'STP'],
            SchoolClass::query()->orderBy('name')->pluck('name')->all(),
        );
    }

    public function test_class_seeder_moves_existing_students_from_legacy_year_names(): void
    {
        $school = School::query()->create([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);
        $yearTwo = SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'Year 2',
            'status' => 'active',
        ]);
        $student = Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $yearTwo->id,
            'student_no' => 'MIS-STD-0001',
            'full_name' => 'Alyssa Tan',
            'level_group' => 'primary',
            'status' => 'active',
        ]);

        $this->seed(SchoolClassSeeder::class);

        $this->assertSame('MB1', $student->fresh('class')->class->name);
        $this->assertSame('inactive', $yearTwo->fresh()->status);
    }
}
