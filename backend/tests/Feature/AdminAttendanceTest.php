<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AttendanceSession;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => 'localhost']);
    }

    public function test_admin_retrieves_school_wide_attendance_overview(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $response = $this->actingAs($admin)
            ->getJson('http://localhost/api/v1/admin/attendance/overview?attendance_date=2026-08-12')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'attendance_date',
                    'academic_year' => ['id', 'name'],
                    'totals' => [
                        'attendance_rate',
                        'total_enrolled',
                        'recorded_count',
                        'present',
                        'late',
                        'absent',
                        'excused',
                    ],
                    'classes' => [
                        '*' => [
                            'class_id',
                            'class_name',
                            'level_group',
                            'enrolled_count',
                            'is_submitted',
                            'counts' => ['present', 'late', 'absent', 'excused'],
                        ],
                    ],
                ],
            ]);

        $this->assertSame('2026-08-12', $response->json('data.attendance_date'));
    }

    public function test_admin_records_daily_attendance_and_corrects_with_audit_reason(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $year = AcademicYear::query()->where('code', '2026')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();

        // 1. Initial creation
        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/daily', [
                'academic_year_id' => $year->id,
                'class_id' => $class->id,
                'attendance_date' => '2026-08-12',
                'records' => [[
                    'student_id' => $student->id,
                    'status' => 'present',
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'present',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.recorded',
            'entity_type' => 'attendance_session',
        ]);

        // 2. Fetch daily sheet
        $this->actingAs($admin)
            ->getJson("http://localhost/api/v1/admin/attendance/daily?class_id={$class->id}&attendance_date=2026-08-12")
            ->assertOk()
            ->assertJsonPath('data.class.name', 'MB1')
            ->assertJsonPath('data.students.0.status', 'present');

        // 3. Correction without reason fails
        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/daily', [
                'academic_year_id' => $year->id,
                'class_id' => $class->id,
                'attendance_date' => '2026-08-12',
                'records' => [[
                    'student_id' => $student->id,
                    'status' => 'late',
                ]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('correction_reason');

        // 4. Correction with reason succeeds
        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/daily', [
                'academic_year_id' => $year->id,
                'class_id' => $class->id,
                'attendance_date' => '2026-08-12',
                'records' => [[
                    'student_id' => $student->id,
                    'status' => 'late',
                ]],
                'correction_reason' => 'Administrative correction: bus arrived late.',
            ])
            ->assertOk();

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'late',
            'correction_reason' => 'Administrative correction: bus arrived late.',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'attendance.corrected',
            'reason' => 'Administrative correction: bus arrived late.',
        ]);
    }

    public function test_gate_check_in_event_records_attendance_automatically(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();

        // 1. On-time gate check-in (07:45 <= 08:00 cutoff)
        $response = $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/gate-event', [
                'student_no' => $student->student_no,
                'scanned_at' => '2026-08-12T07:45:00+08:00',
                'device_id' => 'GATE-MAIN-01',
                'direction' => 'entry',
            ])
            ->assertOk()
            ->assertJsonPath('data.success', true)
            ->assertJsonPath('data.status', 'present')
            ->assertJsonPath('data.is_late', false)
            ->assertJsonPath('data.student.student_no', $student->student_no);

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'present',
        ]);

        $this->assertSame('in_progress', AttendanceSession::query()->sole()->status);

        // A later duplicate scan is idempotent and cannot rewrite the first decision.
        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/gate-event', [
                'student_no' => $student->student_no,
                'scanned_at' => '2026-08-12T08:15:00+08:00',
                'device_id' => 'GATE-MAIN-01',
                'direction' => 'entry',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'present')
            ->assertJsonPath('data.is_late', false)
            ->assertJsonPath('data.duplicate', true);

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'status' => 'present',
        ]);

        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/gate-event', [
                'student_no' => $student->student_no,
                'direction' => 'exit',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('direction');
    }

    public function test_batch_gate_check_in_events(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $year = AcademicYear::query()->where('code', '2026')->firstOrFail();
        $student1 = Student::query()->where('student_no', 'MIS-2026-001')->firstOrFail();
        $student2 = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        ClassEnrolment::query()->create([
            'school_id' => $admin->school_id,
            'academic_year_id' => $year->id,
            'class_id' => $student2->class_id,
            'student_id' => $student2->id,
            'starts_on' => '2026-01-01',
            'status' => 'active',
            'current_slot' => 1,
            'created_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->postJson('http://localhost/api/v1/admin/attendance/gate-events/batch', [
                'events' => [
                    [
                        'student_no' => $student1->student_no,
                        'scanned_at' => '2026-08-12T07:50:00+08:00',
                        'device_id' => 'GATE-MAIN-01',
                    ],
                    [
                        'student_no' => $student2->student_no,
                        'scanned_at' => '2026-08-12T08:20:00+08:00',
                        'device_id' => 'GATE-MAIN-01',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.total_processed', 2)
            ->assertJsonPath('data.total_failed', 0)
            ->assertJsonPath('data.results.0.status', 'present')
            ->assertJsonPath('data.results.1.status', 'late');

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student1->id,
            'status' => 'present',
        ]);
        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student2->id,
            'status' => 'late',
        ]);
    }

    public function test_legacy_admin_attendance_routes_are_not_exposed(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)
            ->getJson('http://localhost/api/attendance/overview?attendance_date=2026-08-12')
            ->assertNotFound();
    }

    public function test_roster_uses_current_enrolments_and_missing_records_remain_unmarked(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $year = AcademicYear::query()->where('code', '2026')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $students = Student::query()->whereIn('student_no', ['MIS-2026-001', 'MIS-2026-002'])->orderBy('student_no')->get();
        $students[1]->update(['class_id' => $class->id]);

        $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/daily', [
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'attendance_date' => '2026-08-13',
            'records' => [[
                'student_id' => $students[0]->id,
                'status' => 'present',
            ]],
        ])->assertOk();

        $response = $this->actingAs($admin)
            ->getJson("http://localhost/api/v1/admin/attendance/daily?class_id={$class->id}&attendance_date=2026-08-13")
            ->assertOk();

        $this->assertSame([$students[0]->id], collect($response->json('data.students'))->pluck('student_id')->all());
    }

    public function test_unmarked_is_display_only_and_cannot_replace_an_existing_record(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $year = AcademicYear::query()->where('code', '2026')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $students = Student::query()->whereIn('student_no', ['MIS-2026-001', 'MIS-2026-002'])->orderBy('student_no')->get();
        ClassEnrolment::query()->create([
            'school_id' => $admin->school_id,
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'student_id' => $students[1]->id,
            'starts_on' => '2026-01-01',
            'status' => 'active',
            'current_slot' => 1,
            'created_by' => $admin->id,
        ]);
        $payload = [
            'academic_year_id' => $year->id,
            'class_id' => $class->id,
            'attendance_date' => '2026-08-14',
            'records' => [
                ['student_id' => $students[0]->id, 'status' => 'present'],
                ['student_id' => $students[1]->id, 'status' => 'unmarked'],
            ],
        ];

        $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/daily', $payload)->assertOk();
        $this->assertDatabaseMissing('attendance_records', ['student_id' => $students[1]->id]);

        $payload['records'] = [['student_id' => $students[0]->id, 'status' => 'unmarked']];
        $payload['correction_reason'] = 'Should not erase history.';
        $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/daily', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('records');
        $this->assertDatabaseHas('attendance_records', ['student_id' => $students[0]->id, 'status' => 'present']);
    }
}
