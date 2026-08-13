<?php

namespace App\Services\Quiz;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\QuizAssignment;
use App\Models\QuizAssignmentRecipient;
use App\Models\QuizAttempt;
use App\Models\QuizAttemptAnswer;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuizAttemptService
{
    public function __construct(private readonly AuditLoggerContract $audit) {}

    public function start(int $schoolId, QuizAssignment $assignment, Student $student, User $actor, AuditContext $context): QuizAttempt
    {
        $this->assertEligible($schoolId, $assignment, $student);

        return DB::transaction(function () use ($schoolId, $assignment, $student, $context) {
            $locked = QuizAssignment::query()->whereKey($assignment->id)->lockForUpdate()->firstOrFail();
            $count = QuizAttempt::query()->where('quiz_assignment_id', $locked->id)->where('student_id', $student->id)->count();
            abort_if($count >= $locked->attempt_limit, 409, 'Attempt limit reached.');
            $attempt = QuizAttempt::query()->create(['school_id' => $schoolId, 'quiz_id' => $locked->quiz_id, 'quiz_assignment_id' => $locked->id, 'student_id' => $student->id, 'attempt_context_key' => 'assignment:'.$locked->id, 'attempt_number' => $count + 1, 'status' => 'in_progress', 'started_at' => now()]);
            $this->audit->record(new AuditEvent(action: AuditAction::QuizAttemptStarted, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::QuizAttempt, subjectId: $attempt->id, newValues: ['quiz_assignment_id' => $assignment->id, 'attempt_number' => $count + 1]), $context);

            return $attempt;
        });
    }

    public function submit(int $schoolId, QuizAttempt $attempt, Student $student, array $answers, AuditContext $context): QuizAttempt
    {
        abort_unless((int) $attempt->school_id === $schoolId && (int) $attempt->student_id === (int) $student->id, 403, 'Attempt belongs to another student.');

        return DB::transaction(function () use ($schoolId, $attempt, $answers, $context) {
            $attempt = QuizAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            abort_if($attempt->status !== 'in_progress', 409, 'Attempt is already submitted.');
            $quiz = $attempt->quiz()->with('questions.options')->firstOrFail();
            $byQuestion = collect($answers)->keyBy(fn ($row) => (int) $row['question_id']);
            if ($byQuestion->count() !== $quiz->questions->count()) {
                throw ValidationException::withMessages(['answers' => 'Every quiz question requires one answer.']);
            }
            $score = 0;
            $max = 0;
            foreach ($quiz->questions as $question) {
                $row = $byQuestion->get($question->id);
                if (! $row) {
                    throw ValidationException::withMessages(['answers' => 'An answer does not match this quiz.']);
                }$option = $question->options->firstWhere('id', (int) $row['option_id']);
                if (! $option) {
                    throw ValidationException::withMessages(['answers' => 'An option does not belong to its question.']);
                }$correct = (bool) $option->is_correct;
                $points = (float) $question->points;
                $awarded = $correct ? $points : 0;
                $score += $awarded;
                $max += $points;
                QuizAttemptAnswer::query()->create(['quiz_attempt_id' => $attempt->id, 'quiz_question_id' => $question->id, 'quiz_option_id' => $option->id, 'is_correct' => $correct, 'awarded_points' => $awarded, 'answered_at' => now()]);
            }$now = now();
            $attempt->update(['status' => 'scored', 'submitted_at' => $now, 'scored_at' => $now, 'score' => $score, 'max_score' => $max]);
            $this->audit->record(new AuditEvent(action: AuditAction::QuizAttemptSubmitted, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::QuizAttempt, subjectId: $attempt->id, newValues: ['score' => $score, 'max_score' => $max]), $context);

            return $attempt;
        });
    }

    private function assertEligible(int $schoolId, QuizAssignment $assignment, Student $student): void
    {
        abort_unless((int) $assignment->school_id === $schoolId && (int) $student->school_id === $schoolId, 403, 'Quiz assignment belongs to a different school.');
        abort_unless($assignment->status === 'published', 404, 'Quiz assignment is not available.');
        abort_unless(QuizAssignmentRecipient::query()->where('quiz_assignment_id', $assignment->id)->where('student_id', $student->id)->exists(), 403, 'Student is not a quiz recipient.');
        abort_if($assignment->available_from && $assignment->available_from->isFuture(), 403, 'Quiz is not available yet.');
        abort_if($assignment->due_at && $assignment->due_at->isPast(), 403, 'Quiz due date has passed.');
    }
}
