<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\Quiz;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Services\Quiz\QuizService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class FormalQuizApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_teacher_publishes_materialized_assignment_and_student_is_scored_server_side(): void
    {
        [$teacher,$assignment,$students] = $this->fixture();
        $quizId = $this->actingAs($teacher)->postJson('/api/v1/quizzes', $this->quizPayload($assignment))->assertCreated()->json('data.id');
        $assignmentId = $this->actingAs($teacher)->postJson("/api/v1/quizzes/{$quizId}/assignments", ['academic_year_id' => $assignment->academic_year_id, 'class_ids' => [$assignment->class_id], 'student_ids' => [$students->first()->id], 'attempt_limit' => 1])->assertCreated()->json('data.id');
        $this->actingAs($teacher)->postJson("/api/v1/quizzes/assignments/{$assignmentId}/publish")->assertOk();
        $this->assertDatabaseCount('quiz_assignment_recipients', $students->count());
        $studentUser = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $list = $this->actingAs($studentUser)->getJson('/api/v1/portal/student/quizzes')->assertOk()->assertJsonPath('data.0.title', 'Fractions')->json('data.0');
        $this->assertArrayNotHasKey('questions', $list);
        $attempt = $this->actingAs($studentUser)->postJson("/api/v1/portal/student/quizzes/assignments/{$assignmentId}/attempts")->assertCreated()->json('data');
        foreach ($attempt['questions'] as $question) {
            foreach ($question['options'] as $option) {
                $this->assertArrayNotHasKey('is_correct', $option);
            }
        }
        $quiz = Quiz::query()->with('questions.options')->findOrFail($quizId);
        $answers = $quiz->questions->map(fn ($q) => ['question_id' => $q->id, 'option_id' => $q->options->firstWhere('is_correct', true)->id])->all();
        $this->actingAs($studentUser)->postJson("/api/v1/portal/student/quizzes/attempts/{$attempt['id']}/submit", ['answers' => $answers])->assertOk()->assertJsonPath('data.score', 3)->assertJsonPath('data.max_score', 3);
        $this->actingAs($studentUser)->postJson("/api/v1/portal/student/quizzes/assignments/{$assignmentId}/attempts")->assertStatus(409);
        $this->assertDatabaseHas('audit_logs', ['action' => 'quiz_attempt.submitted', 'entity_id' => $attempt['id']]);
    }

    public function test_unrelated_teacher_target_and_non_recipient_student_are_rejected(): void
    {
        [$teacher,$assignment] = $this->fixture();
        $payload = $this->quizPayload($assignment);
        $payload['class_ids'] = [SchoolClass::query()->where('name', 'MC1')->value('id')];
        $this->actingAs($teacher)->postJson('/api/v1/quizzes', $payload)->assertForbidden();
        $quizId = $this->actingAs($teacher)->postJson('/api/v1/quizzes', $this->quizPayload($assignment))->json('data.id');
        $target = Student::query()->where('user_id', User::query()->where('username', 'alyssa.tan')->value('id'))->firstOrFail();
        $assignmentId = $this->actingAs($teacher)->postJson("/api/v1/quizzes/{$quizId}/assignments", ['academic_year_id' => $assignment->academic_year_id, 'student_ids' => [$target->id], 'attempt_limit' => 1])->json('data.id');
        $this->actingAs($teacher)->postJson("/api/v1/quizzes/assignments/{$assignmentId}/publish")->assertOk();
        $otherStudent = Student::query()->where('student_no', 'MIS-2026-002')->firstOrFail();
        $other = User::query()->create(['school_id' => $teacher->school_id, 'name' => 'Other Student', 'username' => 'other.student', 'password' => Hash::make('password'), 'status' => 'active']);
        $other->roles()->attach(Role::query()->where('slug', 'student')->value('id'));
        $otherStudent->update(['user_id' => $other->id]);
        $this->actingAs($other)->postJson("/api/v1/portal/student/quizzes/assignments/{$assignmentId}/attempts")->assertForbidden();
    }

    public function test_invalid_true_false_options_are_rejected(): void
    {
        [$teacher,$assignment] = $this->fixture();
        $payload = $this->quizPayload($assignment);
        $payload['questions'][1]['options'][1]['option_text'] = 'Maybe';
        $this->actingAs($teacher)->postJson('/api/v1/quizzes', $payload)->assertUnprocessable()->assertJsonValidationErrors('questions.1.options');
    }

    public function test_quiz_creation_rolls_back_when_audit_fails(): void
    {
        [$teacher,$assignment] = $this->fixture();
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });
        try {
            app(QuizService::class)->create($teacher->school_id, $this->quizPayload($assignment), $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Expected audit failure.');
        } catch (RuntimeException $e) {
            $this->assertSame('Forced audit failure.', $e->getMessage());
        }$this->assertDatabaseCount('quizzes', 0);
        $this->assertDatabaseCount('quiz_questions', 0);
    }

    private function fixture(): array
    {
        $student = Student::query()->where('user_id', User::query()->where('username', 'alyssa.tan')->value('id'))->firstOrFail();
        $enrolment = ClassEnrolment::query()->where('student_id', $student->id)->where('current_slot', 1)->firstOrFail();
        $assignment = TeachingAssignment::query()->where('class_id', $enrolment->class_id)->where('academic_year_id', $enrolment->academic_year_id)->where('current_slot', 1)->firstOrFail();
        $students = ClassEnrolment::query()->with('student')->where('class_id', $assignment->class_id)->where('current_slot', 1)->get()->pluck('student');

        return [$assignment->teacher, $assignment, $students];
    }

    private function quizPayload(TeachingAssignment $assignment): array
    {
        return ['academic_year_id' => $assignment->academic_year_id, 'subject_id' => $assignment->subject_id, 'class_ids' => [$assignment->class_id], 'title' => 'Fractions', 'instructions' => 'Choose one answer.', 'questions' => [['question_type' => 'multiple_choice', 'prompt' => 'Half of 4?', 'points' => 2, 'options' => [['option_text' => '2', 'is_correct' => true], ['option_text' => '3', 'is_correct' => false]]], ['question_type' => 'true_false', 'prompt' => 'One half equals 0.5.', 'points' => 1, 'options' => [['option_text' => 'True', 'is_correct' => true], ['option_text' => 'False', 'is_correct' => false]]]]];
    }
}
