<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Services\Assessment\AssessmentAccessService;
use App\Services\Assessment\AssessmentService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AssessmentController extends Controller
{
    public function index(Request $request, AssessmentAccessService $access): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $items = Assessment::query()->where('school_id', $schoolId)->with(['academicYear', 'subject', 'classTargets.schoolClass', 'results.student'])->latest()->get()
            ->filter(function (Assessment $assessment) use ($request, $access, $schoolId): bool {
                try {
                    $access->assertCanManage($request->user(), $schoolId, $assessment);

                    return true;
                } catch (HttpException) {
                    return false;
                }
            })->values();

        return response()->json(['data' => $items->map(fn (Assessment $item) => $this->response($item))]);
    }

    public function store(Request $request, AssessmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer'], 'academic_term_id' => ['nullable', 'integer'], 'subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:200'], 'assessment_type' => ['required', Rule::in(['quiz', 'test', 'project', 'exam'])],
            'max_score' => ['required', 'numeric', 'gt:0', 'max:999999.99'], 'due_at' => ['nullable', 'date'],
            'class_ids' => ['required', 'array', 'min:1'], 'class_ids.*' => ['required', 'integer', 'distinct'],
        ]);
        $assessment = $service->create(SchoolContext::fromRequest($request)->schoolId, $data, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($assessment->load(['academicYear', 'subject', 'classTargets.schoolClass', 'results.student']))], 201);
    }

    public function saveResults(Request $request, Assessment $assessment, AssessmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['results' => ['required', 'array', 'min:1'], 'results.*.student_id' => ['required', 'integer', 'distinct'], 'results.*.score' => ['required', 'numeric', 'min:0'], 'results.*.grade_label' => ['nullable', 'string', 'max:50'], 'results.*.teacher_comment' => ['nullable', 'string', 'max:2000']]);
        $saved = $service->saveResults(SchoolContext::fromRequest($request)->schoolId, $assessment, $data['results'], $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($saved->load(['academicYear', 'subject', 'classTargets.schoolClass', 'results.student']))]);
    }

    public function publish(Request $request, Assessment $assessment, AssessmentService $service, AuditContextFactory $contexts): JsonResponse
    {
        $published = $service->publish(SchoolContext::fromRequest($request)->schoolId, $assessment, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($published->load(['academicYear', 'subject', 'classTargets.schoolClass', 'results.student']))]);
    }

    private function response(Assessment $item): array
    {
        return ['id' => $item->id, 'title' => $item->title, 'assessment_type' => $item->assessment_type, 'max_score' => (float) $item->max_score, 'status' => $item->status, 'due_at' => $item->due_at?->toIso8601String(), 'published_at' => $item->published_at?->toIso8601String(),
            'academic_year' => ['id' => $item->academicYear->id, 'code' => $item->academicYear->code], 'subject' => ['id' => $item->subject->id, 'code' => $item->subject->code, 'name' => $item->subject->name],
            'classes' => $item->classTargets->map(fn ($target) => ['id' => $target->schoolClass->id, 'name' => $target->schoolClass->name]),
            'results' => $item->results->map(fn ($result) => ['student_id' => $result->student_id, 'student_name' => $result->student->full_name, 'score' => $result->score === null ? null : (float) $result->score, 'grade_label' => $result->grade_label, 'teacher_comment' => $result->teacher_comment, 'status' => $result->status]),
        ];
    }
}
