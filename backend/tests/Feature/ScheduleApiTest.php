<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\ClassScheduleEntry;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Services\Schedule\ClassScheduleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class ScheduleApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_publishes_schedule_visible_only_through_student_and_guardian_relationships(): void
    {
        [$admin, $student, $assignment] = $this->fixture();
        $draft = $this->actingAs($admin)->postJson('/api/v1/admin/class-schedules', $this->payload($assignment, 'draft'))->assertCreated()->json('data.id');
        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();

        $this->actingAs($studentUser)->getJson('/api/v1/portal/student/schedule')->assertOk()->assertJsonCount(0, 'data.entries');
        $this->actingAs($admin)->patchJson("/api/v1/admin/class-schedules/{$draft}", ['status' => 'published'])->assertOk();
        $this->actingAs($studentUser)->getJson('/api/v1/portal/student/schedule')->assertOk()->assertJsonPath('data.entries.0.title', 'English')->assertJsonPath('data.entries.0.starts_at', '08:00');
        $this->actingAs($parent)->getJson("/api/v1/portal/parent/children/{$student->id}/schedule")->assertOk()->assertJsonPath('data.entries.0.teacher', $assignment->teacher->name);
        $this->assertDatabaseHas('audit_logs', ['action' => 'class_schedule.updated', 'entity_id' => $draft]);
    }

    public function test_guardian_academic_access_and_cross_school_scope_are_enforced(): void
    {
        [$admin, $student, $assignment] = $this->fixture();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $parent->guardianProfile->students()->updateExistingPivot($student->id, ['can_view_academics' => false]);
        $this->actingAs($parent)->getJson("/api/v1/portal/parent/children/{$student->id}/schedule")->assertForbidden();

        $otherSchool = $this->createTenantSchool(['name' => 'Other School', 'code' => 'OTHER', 'receipt_prefix' => 'OTH', 'invoice_prefix' => 'OTH']);
        $otherYear = AcademicYear::query()->create(['school_id' => $otherSchool->id, 'code' => '2027', 'name' => '2027']);
        $otherClass = SchoolClass::query()->create(['school_id' => $otherSchool->id, 'name' => 'O1', 'status' => 'active']);
        $entry = ClassScheduleEntry::query()->create(['school_id' => $otherSchool->id, 'academic_year_id' => $otherYear->id, 'class_id' => $otherClass->id, 'title' => 'Private', 'day_of_week' => 1, 'starts_at' => '08:00', 'ends_at' => '09:00', 'status' => 'published', 'created_by_user_id' => $admin->id]);
        $this->actingAs($admin)->patchJson("/api/v1/admin/class-schedules/{$entry->id}", ['title' => 'Changed'])->assertForbidden();
    }

    public function test_schedule_creation_rolls_back_when_audit_fails(): void
    {
        [$admin, , $assignment] = $this->fixture();
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });

        $this->expectException(RuntimeException::class);
        try {
            app(ClassScheduleService::class)->create($admin->school_id, $this->payload($assignment, 'published'), $admin, app(AuditContextFactory::class)->system());
        } finally {
            $this->assertDatabaseCount('class_schedule_entries', 0);
        }
    }

    private function fixture(): array
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = Student::query()->where('user_id', User::query()->where('username', 'alyssa.tan')->value('id'))->firstOrFail();
        $enrolment = ClassEnrolment::query()->where('student_id', $student->id)->where('current_slot', 1)->firstOrFail();
        $assignment = TeachingAssignment::query()->with('teacher')->where('class_id', $enrolment->class_id)->where('academic_year_id', $enrolment->academic_year_id)->where('current_slot', 1)->firstOrFail();

        return [$admin, $student, $assignment];
    }

    private function payload(TeachingAssignment $assignment, string $status): array
    {
        return ['academic_year_id' => $assignment->academic_year_id, 'class_id' => $assignment->class_id, 'subject_id' => $assignment->subject_id, 'teaching_assignment_id' => $assignment->id, 'title' => 'English', 'day_of_week' => 2, 'starts_at' => '08:00', 'ends_at' => '09:00', 'location' => 'Room 3', 'status' => $status];
    }
}
