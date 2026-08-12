<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Services\Foundation\SubjectService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $subjects = Subject::query()->where('school_id', SchoolContext::fromRequest($request)->schoolId)->orderBy('name')->get();

        return response()->json(['data' => $subjects->map(fn (Subject $subject) => $this->response($subject))]);
    }

    public function store(Request $request, SubjectService $service, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('subjects')->where('school_id', $schoolId)],
            'name' => ['required', 'string', 'max:150', Rule::unique('subjects')->where('school_id', $schoolId)],
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive'])],
        ]);
        $subject = $service->create($schoolId, $data, $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($subject)], 201);
    }

    public function update(Request $request, Subject $subject, SubjectService $service, AuditContextFactory $contexts): JsonResponse
    {
        if ((int) $subject->school_id !== SchoolContext::fromRequest($request)->schoolId) {
            abort(403, 'Subject belongs to a different school.');
        }
        $this->authorize('update', $subject);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('subjects')->where('school_id', $subject->school_id)->ignore($subject)],
            'name' => ['sometimes', 'required', 'string', 'max:150', Rule::unique('subjects')->where('school_id', $subject->school_id)->ignore($subject)],
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive'])],
        ]);

        return response()->json(['data' => $this->response($service->update($subject, $data, $contexts->fromRequest($request)))]);
    }

    private function response(Subject $subject): array
    {
        return ['id' => $subject->id, 'school_id' => $subject->school_id, 'code' => $subject->code, 'name' => $subject->name, 'status' => $subject->status];
    }
}
