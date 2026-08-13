<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizAssignment;
use App\Models\QuizAttempt;
use App\Models\Student;
use App\Services\Quiz\QuizAssignmentService;
use App\Services\Quiz\QuizAttemptService;
use App\Services\Quiz\QuizService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuizController extends Controller
{
    public function store(Request $request, QuizService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'integer'], 'subject_id' => ['required', 'integer'], 'class_ids' => ['required', 'array', 'min:1'], 'class_ids.*' => ['integer', 'distinct'], 'title' => ['required', 'string', 'max:200'], 'instructions' => ['nullable', 'string', 'max:5000'], 'questions' => ['required', 'array', 'min:1'], 'questions.*.question_type' => ['required', Rule::in(['multiple_choice', 'true_false'])], 'questions.*.prompt' => ['required', 'string', 'max:5000'], 'questions.*.explanation' => ['nullable', 'string', 'max:5000'], 'questions.*.points' => ['required', 'numeric', 'gt:0', 'max:999999.99'], 'questions.*.options' => ['required', 'array', 'min:2'], 'questions.*.options.*.option_text' => ['required', 'string', 'max:2000'], 'questions.*.options.*.is_correct' => ['required', 'boolean']]);
        $quiz = $service->create(SchoolContext::fromRequest($request)->schoolId, $data, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->authorResponse($quiz->load('questions.options'))], 201);
    }

    public function assign(Request $request, Quiz $quiz, QuizAssignmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'integer'], 'class_ids' => ['nullable', 'array'], 'class_ids.*' => ['integer', 'distinct'], 'student_ids' => ['nullable', 'array'], 'student_ids.*' => ['integer', 'distinct'], 'available_from' => ['nullable', 'date'], 'due_at' => ['nullable', 'date', 'after:available_from'], 'attempt_limit' => ['required', 'integer', 'between:1,10']]);
        $assignment = $service->create(SchoolContext::fromRequest($request)->schoolId, $quiz, $data, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $assignment], 201);
    }

    public function publish(Request $request, QuizAssignment $quizAssignment, QuizAssignmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        return response()->json(['data' => $service->publish(SchoolContext::fromRequest($request)->schoolId, $quizAssignment, $request->user(), $contexts->fromRequest($request))]);
    }

    public function studentIndex(Request $request): JsonResponse
    {
        $student = $this->student($request);
        if (! $student) {
            return response()->json(['data' => []]);
        }$items = QuizAssignment::query()->with(['quiz.questions.options', 'recipients' => fn ($q) => $q->where('student_id', $student->id)])->where('school_id', $student->school_id)->where('status', 'published')->whereHas('recipients', fn ($q) => $q->where('student_id', $student->id))->latest('published_at')->get()->map(fn ($a) => $this->studentResponse($a, $student));

        return response()->json(['data' => $items]);
    }

    public function start(Request $request, QuizAssignment $quizAssignment, QuizAttemptService $service, AuditContextFactory $contexts): JsonResponse
    {
        $student = $this->student($request);
        abort_unless($student, 403, 'No student record linked.');
        $attempt = $service->start(SchoolContext::fromRequest($request)->schoolId, $quizAssignment, $student, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->attemptResponse($attempt->load('quiz.questions.options'))], 201);
    }

    public function submit(Request $request, QuizAttempt $quizAttempt, QuizAttemptService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['answers' => ['required', 'array', 'min:1'], 'answers.*.question_id' => ['required', 'integer', 'distinct'], 'answers.*.option_id' => ['required', 'integer']]);
        $student = $this->student($request);
        abort_unless($student, 403, 'No student record linked.');
        $attempt = $service->submit(SchoolContext::fromRequest($request)->schoolId, $quizAttempt, $student, $data['answers'], $contexts->fromRequest($request));

        return response()->json(['data' => ['id' => $attempt->id, 'status' => $attempt->status, 'score' => (float) $attempt->score, 'max_score' => (float) $attempt->max_score]]);
    }

    private function student(Request $request): ?Student
    {
        return Student::query()->where('school_id', $request->user()->school_id)->where('user_id', $request->user()->id)->first();
    }

    private function authorResponse(Quiz $quiz): array
    {
        return ['id' => $quiz->id, 'title' => $quiz->title, 'status' => $quiz->status, 'subject_id' => $quiz->subject_id, 'questions' => $quiz->questions->map(fn ($q) => ['id' => $q->id, 'question_type' => $q->question_type, 'prompt' => $q->prompt, 'points' => (float) $q->points, 'options' => $q->options->map(fn ($o) => ['id' => $o->id, 'option_text' => $o->option_text, 'is_correct' => $o->is_correct])])];
    }

    private function studentResponse(QuizAssignment $a, Student $student): array
    {
        $attempts = QuizAttempt::query()->where('quiz_assignment_id', $a->id)->where('student_id', $student->id)->get();

        return ['id' => $a->id, 'quiz_id' => $a->quiz_id, 'title' => $a->quiz->title, 'instructions' => $a->quiz->instructions, 'question_count' => $a->quiz->questions->count(), 'available_from' => $a->available_from?->toIso8601String(), 'due_at' => $a->due_at?->toIso8601String(), 'attempt_limit' => $a->attempt_limit, 'attempts_used' => $attempts->count(), 'latest_score' => $attempts->where('status', 'scored')->last()?->score];
    }

    private function attemptResponse(QuizAttempt $attempt): array
    {
        return ['id' => $attempt->id, 'title' => $attempt->quiz->title, 'questions' => $attempt->quiz->questions->map(fn ($q) => ['id' => $q->id, 'question_type' => $q->question_type, 'prompt' => $q->prompt, 'points' => (float) $q->points, 'options' => $q->options->map(fn ($o) => ['id' => $o->id, 'option_text' => $o->option_text])])];
    }
}
