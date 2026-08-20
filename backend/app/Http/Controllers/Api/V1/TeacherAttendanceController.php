<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Models\TeachingAssignment;
use App\Services\Attendance\AttendanceService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeacherAttendanceController extends Controller
{
    public function showDaily(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'attendance_date' => ['required', 'date_format:Y-m-d'],
        ]);
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $this->assertTeacherScope($request, $schoolId, $data['academic_year_id'], $data['class_id']);
        $sessionKey = "daily:{$data['attendance_date']}:class:{$data['class_id']}";
        $session = AttendanceSession::query()
            ->with(['schoolClass', 'records.student'])
            ->where('school_id', $schoolId)
            ->where('session_key', $sessionKey)
            ->first();

        return response()->json(['data' => $session ? $this->response($session) : null]);
    }

    public function storeDaily(Request $request, AttendanceService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'attendance_date' => ['required', 'date_format:Y-m-d'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.student_id' => ['required', 'integer', 'distinct', 'exists:students,id'],
            'records.*.status' => ['required', Rule::in(['present', 'absent', 'late', 'excused', 'unmarked'])],
            'records.*.public_note' => ['nullable', 'string', 'max:500'],
            'correction_reason' => ['nullable', 'string', 'max:500'],
        ]);
        $session = $service->saveDaily(
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $this->response($session)]);
    }

    private function assertTeacherScope(Request $request, int $schoolId, int $academicYearId, int $classId): void
    {
        $authorized = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('teacher_user_id', $request->user()->id)
            ->where('academic_year_id', $academicYearId)
            ->where('class_id', $classId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->exists();

        if (! $authorized) {
            abort(403, 'This class is outside the teacher assignment scope.');
        }
    }

    private function response(AttendanceSession $session): array
    {
        return [
            'id' => $session->id,
            'session_type' => $session->session_type,
            'attendance_date' => $session->attendance_date->toDateString(),
            'status' => $session->status,
            'academic_year_id' => $session->academic_year_id,
            'class' => ['id' => $session->schoolClass->id, 'name' => $session->schoolClass->name],
            'records' => $session->records->map(fn ($record) => [
                'id' => $record->id,
                'student_id' => $record->student_id,
                'student_name' => $record->student->full_name,
                'status' => $record->status,
                'public_note' => $record->public_note,
                'corrected_at' => $record->corrected_at?->toIso8601String(),
            ])->values(),
        ];
    }
}
