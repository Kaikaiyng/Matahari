<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Services\Attendance\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class AttendanceApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1']);
    }

    public function test_teacher_records_scoped_daily_attendance_and_portal_users_can_read_it(): void
    {
        [$teacher, $year, $class, $student] = $this->attendanceFixture();

        $this->actingAs($teacher)
            ->postJson('http://127.0.0.1/api/v1/teacher/attendance/daily', $this->payload($year, $class, $student, 'present'))
            ->assertOk()
            ->assertJsonPath('data.class.name', 'MB1')
            ->assertJsonPath('data.records.0.status', 'present');

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'present',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.recorded',
            'entity_type' => 'attendance_session',
        ]);

        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $this->actingAs($parent)
            ->getJson("http://127.0.0.1/api/v1/portal/parent/children/{$student->id}/attendance")
            ->assertOk()
            ->assertJsonPath('data.0.status', 'present');

        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $this->actingAs($studentUser)
            ->getJson('http://127.0.0.1/api/v1/portal/student/attendance')
            ->assertNotFound();
    }

    public function test_teacher_cannot_record_attendance_for_an_unrelated_class(): void
    {
        [$teacher, $year, , $student] = $this->attendanceFixture();
        $unrelatedClass = SchoolClass::query()->where('name', 'MC1')->firstOrFail();

        $this->actingAs($teacher)
            ->postJson('http://127.0.0.1/api/v1/teacher/attendance/daily', $this->payload($year, $unrelatedClass, $student, 'absent'))
            ->assertForbidden();

        $this->assertDatabaseCount('attendance_sessions', 0);
    }

    public function test_submitted_attendance_requires_a_reason_before_it_can_be_corrected(): void
    {
        [$teacher, $year, $class, $student] = $this->attendanceFixture();
        $this->actingAs($teacher)
            ->postJson('http://127.0.0.1/api/v1/teacher/attendance/daily', $this->payload($year, $class, $student, 'present'))
            ->assertOk();

        $this->actingAs($teacher)
            ->postJson('http://127.0.0.1/api/v1/teacher/attendance/daily', $this->payload($year, $class, $student, 'late'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('correction_reason');

        $corrected = $this->payload($year, $class, $student, 'late');
        $corrected['correction_reason'] = 'Teacher corrected the arrival status.';
        $this->actingAs($teacher)
            ->postJson('http://127.0.0.1/api/v1/teacher/attendance/daily', $corrected)
            ->assertOk();

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'late',
            'correction_reason' => 'Teacher corrected the arrival status.',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.corrected',
            'reason' => 'Teacher corrected the arrival status.',
        ]);
    }

    public function test_parent_academic_access_flag_is_enforced(): void
    {
        [, , , $student] = $this->attendanceFixture();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $parent->guardianProfile->students()->updateExistingPivot($student->id, ['can_view_academics' => false]);

        $this->actingAs($parent)
            ->getJson("http://127.0.0.1/api/v1/portal/parent/children/{$student->id}/attendance")
            ->assertForbidden();
    }

    public function test_attendance_mutation_rolls_back_when_audit_persistence_fails(): void
    {
        [$teacher, $year, $class, $student] = $this->attendanceFixture();
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });

        try {
            app(AttendanceService::class)->saveDaily(
                $teacher->school_id,
                $this->payload($year, $class, $student, 'present'),
                $teacher,
                app(AuditContextFactory::class)->system(),
            );
            $this->fail('The audit failure should have escaped the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseCount('attendance_sessions', 0);
        $this->assertDatabaseCount('attendance_records', 0);
    }

    private function attendanceFixture(): array
    {
        return [
            User::query()->where('username', 'teacher.lim')->firstOrFail(),
            AcademicYear::query()->where('code', '2026')->firstOrFail(),
            SchoolClass::query()->where('name', 'MB1')->firstOrFail(),
            Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail(),
        ];
    }

    private function payload(AcademicYear $year, SchoolClass $class, Student $student, string $status): array
    {
        return [
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'attendance_date' => '2026-08-12',
            'records' => [[
                'student_id' => $student->id,
                'status' => $status,
            ]],
        ];
    }
}
