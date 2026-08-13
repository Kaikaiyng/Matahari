<?php

namespace App\Services\Quiz;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\Quiz;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuizService
{
    public function __construct(private readonly QuizAccessService $access, private readonly AuditLoggerContract $audit) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): Quiz
    {
        AcademicYear::query()->where('school_id', $schoolId)->findOrFail($data['academic_year_id']);
        Subject::query()->where('school_id', $schoolId)->findOrFail($data['subject_id']);
        $this->access->assertCanAuthor($actor, $schoolId, $data['subject_id'], $data['class_ids'], $data['academic_year_id']);
        $this->validateQuestions($data['questions']);

        return DB::transaction(function () use ($schoolId, $data, $actor, $context) {
            $quiz = Quiz::query()->create(['school_id' => $schoolId, 'subject_id' => $data['subject_id'], 'owner_user_id' => $actor->id, 'quiz_kind' => 'formal', 'title' => $data['title'], 'instructions' => $data['instructions'] ?? null, 'status' => 'draft']);
            foreach ($data['questions'] as $qi => $row) {
                $question = $quiz->questions()->create(['question_type' => $row['question_type'], 'prompt' => $row['prompt'], 'explanation' => $row['explanation'] ?? null, 'points' => $row['points'], 'position' => $qi + 1]);
                foreach ($row['options'] as $oi => $option) {
                    $question->options()->create(['option_text' => $option['option_text'], 'is_correct' => $option['is_correct'], 'position' => $oi + 1]);
                }
            }
            $this->audit->record(new AuditEvent(action: AuditAction::QuizCreated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::Quiz, subjectId: $quiz->id, newValues: ['question_count' => count($data['questions']), 'types' => collect($data['questions'])->pluck('question_type')->unique()->values()->all()]), $context);

            return $quiz;
        });
    }

    private function validateQuestions(array $questions): void
    {
        foreach ($questions as $index => $question) {
            $options = $question['options'];
            $correct = collect($options)->where('is_correct', true)->count();
            if ($correct !== 1) {
                throw ValidationException::withMessages(["questions.$index.options" => 'Each question must have exactly one correct option.']);
            }if ($question['question_type'] === 'true_false' && (count($options) !== 2 || collect($options)->pluck('option_text')->map(fn ($v) => strtolower(trim($v)))->sort()->values()->all() !== ['false', 'true'])) {
                throw ValidationException::withMessages(["questions.$index.options" => 'True/false questions require exactly True and False options.']);
            }if ($question['question_type'] === 'multiple_choice' && count($options) < 2) {
                throw ValidationException::withMessages(["questions.$index.options" => 'Multiple-choice questions require at least two options.']);
            }
        }
    }
}
