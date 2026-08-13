<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use App\Services\Assessment\AcademicTermService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AcademicTermController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'integer']]);
        $items = AcademicTerm::query()->where('school_id', SchoolContext::fromRequest($request)->schoolId)->where('academic_year_id', $data['academic_year_id'])->orderBy('starts_on')->orderBy('code')->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, AcademicTermService $service, AuditContextFactory $contexts): JsonResponse
    {
        $term = $service->create(SchoolContext::fromRequest($request)->schoolId, $this->validated($request), $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => $term], 201);
    }

    public function update(Request $request, AcademicTerm $academicTerm, AcademicTermService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:30', Rule::unique('academic_terms', 'code')->where(fn ($query) => $query->where('school_id', $academicTerm->school_id)->where('academic_year_id', $academicTerm->academic_year_id))->ignore($academicTerm->id)],
            'name' => ['sometimes', 'string', 'max:100'], 'starts_on' => ['nullable', 'date'], 'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'], 'status' => ['sometimes', Rule::in(['draft', 'active', 'closed'])],
        ]);

        return response()->json(['data' => $service->update(SchoolContext::fromRequest($request)->schoolId, $academicTerm, $data, $request->user(), $contexts->fromRequest($request))]);
    }

    private function validated(Request $request): array
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return $request->validate([
            'academic_year_id' => ['required', 'integer'],
            'code' => ['required', 'string', 'max:30', Rule::unique('academic_terms', 'code')->where(fn ($query) => $query->where('school_id', $schoolId)->where('academic_year_id', $request->integer('academic_year_id')))],
            'name' => ['required', 'string', 'max:100'], 'starts_on' => ['nullable', 'date'], 'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'], 'status' => ['sometimes', Rule::in(['draft', 'active', 'closed'])],
        ]);
    }
}
