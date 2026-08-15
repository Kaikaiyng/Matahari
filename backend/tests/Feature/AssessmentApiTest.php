<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicTerm;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Services\Assessment\AssessmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class AssessmentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_teacher_creates_scores_and_publishes_results_visible_to_linked_parent_and_student(): void
    {
        [$teacher, $assignment, $students] = $this->fixture();
        $assessmentId = $this->actingAs($teacher)->postJson('/api/v1/assessments', $this->assessmentPayload($assignment))
            ->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');

        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $linkedStudent = Student::query()->where('user_id', User::query()->where('username', 'alyssa.tan')->value('id'))->firstOrFail();
        $this->actingAs($parent)->getJson("/api/v1/portal/parent/children/{$linkedStudent->id}/assessment-results")->assertOk()->assertJsonCount(0, 'data');

        $rows = $students->map(fn (Student $student) => ['student_id' => $student->id, 'score' => 82, 'grade_label' => 'A', 'teacher_comment' => 'Good progress.'])->all();
        $this->actingAs($teacher)->putJson("/api/v1/assessments/{$assessmentId}/results", ['results' => $rows])->assertOk();
        $this->actingAs($teacher)->postJson("/api/v1/assessments/{$assessmentId}/publish")->assertOk()->assertJsonPath('data.status', 'published');

        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $this->actingAs($studentUser)->getJson('/api/v1/portal/student/assessment-results')->assertOk()->assertJsonPath('data.0.score', 82);
        $this->actingAs($parent)->getJson("/api/v1/portal/parent/children/{$linkedStudent->id}/assessment-results")->assertOk()->assertJsonPath('data.0.teacher_comment', 'Good progress.');
        $this->assertDatabaseHas('audit_logs', ['action' => 'assessment.published', 'entity_id' => $assessmentId]);

        $this->actingAs($teacher)->putJson("/api/v1/assessments/{$assessmentId}/results", ['results' => $rows])->assertStatus(409);
    }

    public function test_teacher_cannot_target_an_unrelated_class(): void
    {
        [$teacher, $assignment] = $this->fixture();
        $payload = $this->assessmentPayload($assignment);
        $payload['class_ids'] = [SchoolClass::query()->where('name', 'MC1')->value('id')];
        $this->actingAs($teacher)->postJson('/api/v1/assessments', $payload)->assertForbidden();
        $this->assertDatabaseCount('assessments', 0);
    }

    public function test_publication_requires_scores_for_every_current_target_student(): void
    {
        [$teacher, $assignment, $students] = $this->fixture();
        $assessmentId = $this->actingAs($teacher)->postJson('/api/v1/assessments', $this->assessmentPayload($assignment))->json('data.id');
        if ($students->count() > 1) {
            $this->actingAs($teacher)->putJson("/api/v1/assessments/{$assessmentId}/results", ['results' => [['student_id' => $students->first()->id, 'score' => 70]]])->assertOk();
        }
        $this->actingAs($teacher)->postJson("/api/v1/assessments/{$assessmentId}/publish")->assertUnprocessable()->assertJsonValidationErrors('results');
    }

    public function test_parent_academic_capability_is_required_for_published_results(): void
    {
        [, , $students] = $this->fixture();
        $student = $students->first();
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $parent->guardianProfile->students()->updateExistingPivot($student->id, ['can_view_academics' => false]);
        $this->actingAs($parent)->getJson("/api/v1/portal/parent/children/{$student->id}/assessment-results")->assertForbidden();
    }

    public function test_assessment_creation_rolls_back_when_audit_fails(): void
    {
        [$teacher, $assignment] = $this->fixture();
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });
        try {
            app(AssessmentService::class)->create($teacher->school_id, $this->assessmentPayload($assignment), $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Audit failure should escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }
        $this->assertDatabaseCount('assessments', 0);
        $this->assertDatabaseCount('assessment_class_targets', 0);
    }

    public function test_school_admin_manages_academic_terms_without_inferred_dates(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $yearId = TeachingAssignment::query()->value('academic_year_id');
        $response = $this->actingAs($admin)->postJson('/api/v1/admin/academic-terms', ['academic_year_id' => $yearId, 'code' => 'T1', 'name' => 'Term 1'])
            ->assertCreated()->assertJsonPath('data.starts_on', null);
        $this->assertDatabaseHas('audit_logs', ['action' => 'academic_term.created', 'entity_id' => $response->json('data.id')]);
    }

    public function test_school_admin_cannot_update_another_schools_academic_term(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $otherSchool = $this->createTenantSchool(['name' => 'Other School', 'code' => 'OTHER', 'receipt_prefix' => 'OTH', 'invoice_prefix' => 'OTH']);
        $year = AcademicYear::query()->create(['school_id' => $otherSchool->id, 'code' => '2027', 'name' => '2027']);
        $term = AcademicTerm::query()->create(['school_id' => $otherSchool->id, 'academic_year_id' => $year->id, 'code' => 'T1', 'name' => 'Term 1']);

        $this->actingAs($admin)->patchJson("/api/v1/admin/academic-terms/{$term->id}", ['name' => 'Changed'])->assertForbidden();
        $this->assertDatabaseHas('academic_terms', ['id' => $term->id, 'name' => 'Term 1']);
    }

    private function fixture(): array
    {
        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $student = Student::query()->where('user_id', $studentUser->id)->firstOrFail();
        $enrolment = ClassEnrolment::query()->where('student_id', $student->id)->where('current_slot', 1)->firstOrFail();
        $assignment = TeachingAssignment::query()->where('class_id', $enrolment->class_id)->where('academic_year_id', $enrolment->academic_year_id)->where('current_slot', 1)->firstOrFail();
        $students = ClassEnrolment::query()->with('student')->where('class_id', $assignment->class_id)->where('academic_year_id', $assignment->academic_year_id)->where('current_slot', 1)->get()->pluck('student');

        return [$assignment->teacher, $assignment, $students];
    }

    private function assessmentPayload(TeachingAssignment $assignment): array
    {
        return ['academic_year_id' => $assignment->academic_year_id, 'subject_id' => $assignment->subject_id, 'title' => 'Term checkpoint', 'assessment_type' => 'test', 'max_score' => 100, 'class_ids' => [$assignment->class_id]];
    }
}
