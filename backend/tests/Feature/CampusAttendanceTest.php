<?php

namespace Tests\Feature;

use App\Models\Guardian;
use App\Models\PortalNotification;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampusAttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => 'localhost']);
    }

    public function test_entry_and_exit_are_immutable_movements_and_notify_the_linked_parent(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('school_id', $admin->school_id)->where('status', 'active')->firstOrFail();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $guardian = Guardian::query()->where('user_id', $parent->id)->firstOrFail();
        StudentParentLink::query()->updateOrCreate(
            ['school_id' => $admin->school_id, 'student_id' => $student->id, 'parent_id' => $guardian->id],
            ['relationship' => 'guardian', 'status' => 'active', 'can_view_academics' => true, 'current_slot' => 1],
        );

        foreach ([['entry', '07:55:00'], ['exit', '14:45:00']] as [$direction, $time]) {
            $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/gate-event', [
                'student_id' => $student->id,
                'direction' => $direction,
                'method' => 'card',
                'occurred_at' => "2026-08-23T{$time}+08:00",
                'source' => 'test',
                'external_event_id' => "event-{$direction}",
            ])->assertOk()->assertJsonPath('data.direction', $direction);
        }

        $this->assertDatabaseCount('campus_attendance_events', 2);
        $this->assertSame(2, PortalNotification::query()->where('recipient_user_id', $parent->id)->whereIn('title', ['School Entry', 'School Exit'])->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'attendance.campus_recorded', 'entity_type' => 'campus_attendance_event']);

        $this->actingAs($admin)->getJson('http://localhost/api/v1/admin/attendance/campus-records?date=2026-08-23')
            ->assertOk()->assertJsonPath('data.summary.off_campus', 1)->assertJsonPath('data.students.0.movement_count', 2);
    }

    public function test_external_event_id_is_idempotent(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('school_id', $admin->school_id)->firstOrFail();
        $payload = ['student_id' => $student->id, 'direction' => 'entry', 'method' => 'face', 'source' => 'hikvision', 'external_event_id' => 'hik-123'];

        $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/gate-event', $payload)->assertOk()->assertJsonPath('data.duplicate', false);
        $this->actingAs($admin)->postJson('http://localhost/api/v1/admin/attendance/gate-event', $payload)->assertOk()->assertJsonPath('data.duplicate', true);
        $this->assertDatabaseCount('campus_attendance_events', 1);
    }
}
