<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Services\Attendance\AttendanceService;
use App\Support\SchoolClassCatalog;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAttendanceController extends Controller
{
    /**
     * Get attendance overview across all classes for a specified date.
     */
    public function showOverview(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data = $request->validate(['attendance_date' => ['nullable', 'date_format:Y-m-d']]);
        $date = $data['attendance_date'] ?? now()->toDateString();

        $currentYear = AcademicYear::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->first();

        $classes = SchoolClass::query()
            ->where('school_id', $schoolId)
            ->orderBy('name')
            ->get();

        $classesSummary = [];
        $totalPresent = 0;
        $totalLate = 0;
        $totalAbsent = 0;
        $totalExcused = 0;
        $totalEnrolledAll = 0;

        foreach ($classes as $schoolClass) {
            $enrolledStudentIds = ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('class_id', $schoolClass->id)
                ->when(
                    $currentYear,
                    fn ($query) => $query->where('academic_year_id', $currentYear->id),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->pluck('student_id')
                ->all();

            $enrolledCount = count(array_unique($enrolledStudentIds));

            $totalEnrolledAll += $enrolledCount;

            $sessionKey = "daily:{$date}:class:{$schoolClass->id}";
            $session = AttendanceSession::query()
                ->where('school_id', $schoolId)
                ->where('session_key', $sessionKey)
                ->first();

            $counts = ['present' => 0, 'late' => 0, 'absent' => 0, 'excused' => 0];

            if ($session) {
                $dbCounts = AttendanceRecord::query()
                    ->where('attendance_session_id', $session->id)
                    ->selectRaw('status, COUNT(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status')
                    ->all();

                foreach ($dbCounts as $status => $count) {
                    $counts[$status] = (int) $count;
                }

                $totalPresent += $counts['present'];
                $totalLate += $counts['late'];
                $totalAbsent += $counts['absent'];
                $totalExcused += $counts['excused'];
            }

            $classesSummary[] = [
                'class_id' => $schoolClass->id,
                'class_name' => $schoolClass->name,
                'level_group' => SchoolClassCatalog::levelGroupFor($schoolClass->name) ?? 'other',
                'enrolled_count' => $enrolledCount,
                'is_submitted' => $session !== null && $session->status === 'submitted',
                'submitted_at' => $session?->submitted_at?->toISOString(),
                'counts' => $counts,
            ];
        }

        $recordedCount = $totalPresent + $totalLate + $totalAbsent + $totalExcused;
        $attendanceRate = $recordedCount > 0
            ? round((($totalPresent + $totalLate) / $recordedCount) * 100, 1)
            : 100.0;

        return response()->json([
            'data' => [
                'attendance_date' => $date,
                'academic_year' => $currentYear ? [
                    'id' => $currentYear->id,
                    'name' => $currentYear->name,
                ] : null,
                'totals' => [
                    'attendance_rate' => $attendanceRate,
                    'total_enrolled' => $totalEnrolledAll,
                    'recorded_count' => $recordedCount,
                    'present' => $totalPresent,
                    'late' => $totalLate,
                    'absent' => $totalAbsent,
                    'excused' => $totalExcused,
                ],
                'classes' => $classesSummary,
            ],
        ]);
    }

    /**
     * Get class daily attendance sheet with student rosters and recorded statuses.
     */
    public function showDaily(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'attendance_date' => ['required', 'date_format:Y-m-d'],
            'academic_year_id' => ['nullable', 'integer', 'exists:academic_years,id'],
        ]);

        $yearId = $data['academic_year_id'] ?? null;
        if (! $yearId) {
            $currentYear = AcademicYear::query()
                ->where('school_id', $schoolId)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->first();
            $yearId = $currentYear?->id;
        }

        $schoolClass = SchoolClass::query()
            ->where('school_id', $schoolId)
            ->whereKey($data['class_id'])
            ->firstOrFail();

        $enrolledStudentIds = ClassEnrolment::query()
            ->where('school_id', $schoolId)
            ->where('class_id', $schoolClass->id)
            ->when(
                $yearId,
                fn ($query) => $query->where('academic_year_id', $yearId),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->pluck('student_id')
            ->all();

        $enrolledStudents = Student::query()
            ->where('school_id', $schoolId)
            ->whereIn('id', $enrolledStudentIds)
            ->where('status', 'active')
            ->orderBy('full_name')
            ->get();

        $sessionKey = "daily:{$data['attendance_date']}:class:{$schoolClass->id}";
        $session = AttendanceSession::query()
            ->where('school_id', $schoolId)
            ->where('session_key', $sessionKey)
            ->first();

        $records = $session
            ? AttendanceRecord::query()
                ->where('attendance_session_id', $session->id)
                ->get()
                ->keyBy('student_id')
            : collect();

        $students = $enrolledStudents->map(function ($student) use ($records) {
            $record = $records->get($student->id);

            return [
                'student_id' => $student->id,
                'student_no' => $student->student_no,
                'full_name' => $student->full_name,
                'gender' => $student->gender,
                'status' => $record?->status ?? 'unmarked',
                'public_note' => $record?->public_note,
                'corrected_by' => $record?->corrected_by,
                'correction_reason' => $record?->correction_reason,
                'corrected_at' => $record?->corrected_at?->toISOString(),
            ];
        });

        return response()->json([
            'data' => [
                'class' => [
                    'id' => $schoolClass->id,
                    'name' => $schoolClass->name,
                    'level_group' => SchoolClassCatalog::levelGroupFor($schoolClass->name) ?? 'other',
                ],
                'academic_year_id' => $yearId,
                'attendance_date' => $data['attendance_date'],
                'is_submitted' => $session !== null && $session->status === 'submitted',
                'submitted_at' => $session?->submitted_at?->toISOString(),
                'students' => $students,
            ],
        ]);
    }

    /**
     * Record or correct daily attendance for a class.
     */
    public function storeDaily(
        Request $request,
        AttendanceService $service,
        AuditContextFactory $contexts,
    ): JsonResponse {
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

        return response()->json(['data' => $session]);
    }

    /**
     * Record a single gate check-in event (RFID / Barcode / Face Scanner / Gate integration).
     */
    public function recordGateEvent(
        Request $request,
        AttendanceService $service,
        AuditContextFactory $contexts,
    ): JsonResponse {
        $data = $request->validate([
            'student_no' => ['required_without:student_id', 'string', 'max:64'],
            'student_id' => ['required_without:student_no', 'integer'],
            'scanned_at' => ['nullable', 'date'],
            'cutoff_time' => ['nullable', 'date_format:H:i:s'],
            'device_id' => ['nullable', 'string', 'max:64'],
            'direction' => ['nullable', Rule::in(['entry'])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $service->recordGateCheckIn(
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $result]);
    }

    /**
     * Batch record multiple gate check-in events (e.g. offline gate sync).
     */
    public function recordBatchGateEvents(
        Request $request,
        AttendanceService $service,
        AuditContextFactory $contexts,
    ): JsonResponse {
        $data = $request->validate([
            'events' => ['required', 'array', 'min:1', 'max:500'],
            'events.*.student_no' => ['required_without:events.*.student_id', 'string', 'max:64'],
            'events.*.student_id' => ['required_without:events.*.student_no', 'integer'],
            'events.*.scanned_at' => ['nullable', 'date'],
            'events.*.cutoff_time' => ['nullable', 'date_format:H:i:s'],
            'events.*.device_id' => ['nullable', 'string', 'max:64'],
            'events.*.direction' => ['nullable', Rule::in(['entry'])],
            'events.*.note' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $service->recordBatchGateCheckIn(
            SchoolContext::fromRequest($request)->schoolId,
            $data['events'],
            $request->user(),
            $contexts->fromRequest($request),
        );

        return response()->json(['data' => $result]);
    }
}
