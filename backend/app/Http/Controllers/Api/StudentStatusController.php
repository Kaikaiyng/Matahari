<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStudentStatusRequest;
use App\Models\Student;
use Illuminate\Http\JsonResponse;

class StudentStatusController extends Controller
{
    public function update(UpdateStudentStatusRequest $request, Student $student): JsonResponse
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }

        $student->update(['status' => $request->validated('status')]);

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
