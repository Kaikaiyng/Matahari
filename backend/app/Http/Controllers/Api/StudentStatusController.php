<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStudentStatusRequest;
use App\Models\Student;
use App\Services\Students\StudentMutationService;
use Illuminate\Http\JsonResponse;

class StudentStatusController extends Controller
{
    public function update(
        UpdateStudentStatusRequest $request,
        Student $student,
        StudentMutationService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }

        $student = $service->changeStatus(
            $student,
            $request->validated('status'),
            $contextFactory->fromRequest($request),
        );

        return response()->json([
            'student' => [
                'id' => $student->id,
                'student_no' => $student->student_no,
                'full_name' => $student->full_name,
                'status' => $student->status,
            ],
        ]);
    }
}
