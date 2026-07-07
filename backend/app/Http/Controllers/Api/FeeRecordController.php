<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Services\Billing\FeeRecordChargeGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeeRecordController extends Controller
{
    public function preview(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json($service->preview($student, $data['academic_year']));
    }

    public function activate(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json($service->activate($student, $data['academic_year']), 201);
    }

    public function outstanding(
        Request $request,
        Student $student,
        FeeRecordChargeGenerationService $service,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);
        $data = $request->validate($this->academicYearRules());

        return response()->json(['data' => $service->outstanding($student, $data['academic_year'])]);
    }

    private function assertSchoolScope(Request $request, Student $student): void
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function academicYearRules(): array
    {
        return [
            'academic_year' => ['required', 'string', 'regex:/^\d{4}$/'],
        ];
    }
}
