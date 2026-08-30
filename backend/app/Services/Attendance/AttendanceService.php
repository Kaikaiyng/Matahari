<?php

namespace App\Services\Attendance;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function saveDaily(int $schoolId, array $data, User $actor, AuditContext $context): AttendanceSession
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): AttendanceSession {
            $year = AcademicYear::query()->whereKey($data['academic_year_id'])->firstOrFail();
            $class = SchoolClass::query()->whereKey($data['class_id'])->lockForUpdate()->firstOrFail();

            if ((int) $year->school_id !== $schoolId || (int) $class->school_id !== $schoolId) {
                abort(403, 'Academic record belongs to a different school.');
            }

            $this->assertTeacherScope($schoolId, $year->id, $class->id, $actor);
            $studentIds = collect($data['records'])->pluck('student_id')->map(fn ($id) => (int) $id)->all();
            $enrolledIds = ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('academic_year_id', $year->id)
                ->where('class_id', $class->id)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->whereIn('student_id', $studentIds)
                ->pluck('student_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $invalidIds = array_values(array_diff($studentIds, $enrolledIds));
            if ($invalidIds !== []) {
                throw ValidationException::withMessages([
                    'records' => 'Every student must have a current enrolment in the selected class and academic year.',
                ]);
            }

            $sessionKey = "daily:{$data['attendance_date']}:class:{$class->id}";
            $session = AttendanceSession::query()
                ->where('school_id', $schoolId)
                ->where('session_key', $sessionKey)
                ->lockForUpdate()
                ->first();

            if (! $session) {
                $session = AttendanceSession::query()->create([
                    'school_id' => $schoolId,
                    'academic_year_id' => $year->id,
                    'class_id' => $class->id,
                    'session_type' => 'daily',
                    'attendance_date' => $data['attendance_date'],
                    'session_key' => $sessionKey,
                    'status' => 'submitted',
                    'created_by' => $actor->id,
                    'submitted_by' => $actor->id,
                    'submitted_at' => now(),
                ]);
            }

            if ((int) $session->academic_year_id !== (int) $year->id || (int) $session->class_id !== (int) $class->id) {
                throw ValidationException::withMessages(['attendance_date' => 'The daily attendance session conflicts with an existing academic record.']);
            }

            $existing = AttendanceRecord::query()
                ->where('attendance_session_id', $session->id)
                ->whereIn('student_id', $studentIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('student_id');
            $changed = [];

            foreach ($data['records'] as $recordData) {
                $record = $existing->get($recordData['student_id']);
                if ($record && $recordData['status'] === 'unmarked') {
                    throw ValidationException::withMessages([
                        'records' => 'Unmarked is a display state and cannot replace recorded attendance.',
                    ]);
                }
                if (! $record) {
                    continue;
                }

                $nextNote = $recordData['public_note'] ?? null;
                if ($record->status !== $recordData['status'] || $record->public_note !== $nextNote) {
                    $changed[] = [
                        'student_id' => (int) $record->student_id,
                        'old_status' => $record->status,
                        'new_status' => $recordData['status'],
                    ];
                }
            }

            if ($changed !== [] && blank($data['correction_reason'] ?? null)) {
                throw ValidationException::withMessages([
                    'correction_reason' => 'A correction reason is required when changing submitted attendance.',
                ]);
            }

            foreach ($data['records'] as $recordData) {
                $record = $existing->get($recordData['student_id']);
                if (! $record && $recordData['status'] === 'unmarked') {
                    continue;
                }
                $attributes = [
                    'status' => $recordData['status'],
                    'public_note' => $recordData['public_note'] ?? null,
                ];

                if (! $record) {
                    AttendanceRecord::query()->create([
                        ...$attributes,
                        'school_id' => $schoolId,
                        'attendance_session_id' => $session->id,
                        'student_id' => $recordData['student_id'],
                        'marked_by' => $actor->id,
                    ]);

                    continue;
                }

                if ($record->status !== $attributes['status'] || $record->public_note !== $attributes['public_note']) {
                    $record->update([
                        ...$attributes,
                        'corrected_by' => $actor->id,
                        'correction_reason' => $data['correction_reason'],
                        'corrected_at' => now(),
                    ]);
                }
            }

            $session->update([
                'status' => 'submitted',
                'submitted_by' => $actor->id,
                'submitted_at' => now(),
            ]);
            $counts = AttendanceRecord::query()
                ->where('attendance_session_id', $session->id)
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status')
                ->map(fn ($count) => (int) $count)
                ->all();

            $this->auditLogger->record(new AuditEvent(
                action: $changed === [] ? AuditAction::AttendanceRecorded : AuditAction::AttendanceCorrected,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::AttendanceSession,
                subjectId: $session->id,
                oldValues: $changed === [] ? [] : ['changed_records' => $changed],
                newValues: ['attendance_date' => $data['attendance_date'], 'class_id' => $class->id, 'counts' => $counts],
                reason: $changed === [] ? null : $data['correction_reason'],
            ), $context);

            return $session->fresh(['schoolClass', 'records.student']);
        });
    }

    /**
     * Record a single gate check-in event (RFID / Barcode / Face Scanner / Gate integration).
     */
    public function recordGateCheckIn(int $schoolId, array $event, User $actor, AuditContext $context): array
    {
        return DB::transaction(function () use ($schoolId, $event, $actor, $context): array {
            if (($event['direction'] ?? 'entry') !== 'entry') {
                throw ValidationException::withMessages(['direction' => 'Only gate entry events are supported.']);
            }
            $studentQuery = Student::query()->where('school_id', $schoolId);
            if (! empty($event['student_no'])) {
                $student = $studentQuery->where('student_no', $event['student_no'])->first();
            } elseif (! empty($event['student_id'])) {
                $student = $studentQuery->where('id', $event['student_id'])->first();
            } else {
                throw ValidationException::withMessages([
                    'student_no' => 'Either student_no or student_id must be provided.',
                ]);
            }

            if (! $student) {
                throw ValidationException::withMessages([
                    'student_no' => 'No student found matching the identification provided.',
                ]);
            }

            $scannedAt = ! empty($event['scanned_at']) ? Carbon::parse($event['scanned_at']) : now();
            $attendanceDate = $scannedAt->toDateString();
            $scannedTime = $scannedAt->toTimeString();

            // Resolve active academic year
            $academicYear = AcademicYear::query()
                ->where('school_id', $schoolId)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->first();

            if (! $academicYear) {
                $academicYear = AcademicYear::query()
                    ->where('school_id', $schoolId)
                    ->where('starts_on', '<=', $attendanceDate)
                    ->where('ends_on', '>=', $attendanceDate)
                    ->first() ?? AcademicYear::query()->where('school_id', $schoolId)->latest('id')->firstOrFail();
            }

            // Resolve student class enrolment
            $enrolment = ClassEnrolment::query()
                ->where('school_id', $schoolId)
                ->where('student_id', $student->id)
                ->where('academic_year_id', $academicYear->id)
                ->where('status', 'active')
                ->where('current_slot', 1)
                ->first();

            if (! $enrolment) {
                throw ValidationException::withMessages([
                    'student_no' => "Student {$student->full_name} ({$student->student_no}) is not enrolled in an active class.",
                ]);
            }

            // Serialize daily-session creation for this class on databases with row locking.
            $schoolClass = SchoolClass::query()->where('school_id', $schoolId)->whereKey($enrolment->class_id)->lockForUpdate()->firstOrFail();

            // Determine status (cutoff time default 08:00:00)
            $cutoffTime = $event['cutoff_time'] ?? '08:00:00';
            $status = $scannedTime > $cutoffTime ? 'late' : 'present';
            $deviceId = $event['device_id'] ?? 'GATE-SCANNER';
            $direction = $event['direction'] ?? 'entry';
            $customNote = $event['note'] ?? null;
            $publicNote = $customNote ?? "Gate check-in via {$deviceId} ({$direction}) at {$scannedTime}";

            // Find or create daily attendance session for the class
            $sessionKey = "daily:{$attendanceDate}:class:{$schoolClass->id}";
            $session = AttendanceSession::query()
                ->where('school_id', $schoolId)
                ->where('session_key', $sessionKey)
                ->lockForUpdate()
                ->first();

            if (! $session) {
                $session = AttendanceSession::query()->create([
                    'school_id' => $schoolId,
                    'academic_year_id' => $academicYear->id,
                    'class_id' => $schoolClass->id,
                    'session_type' => 'daily',
                    'attendance_date' => $attendanceDate,
                    'session_key' => $sessionKey,
                    'status' => 'in_progress',
                    'created_by' => $actor->id,
                ]);
            }

            $record = AttendanceRecord::query()
                ->where('attendance_session_id', $session->id)
                ->where('student_id', $student->id)
                ->lockForUpdate()
                ->first();

            if (! $record) {
                $record = AttendanceRecord::query()->create([
                    'school_id' => $schoolId,
                    'attendance_session_id' => $session->id,
                    'student_id' => $student->id,
                    'status' => $status,
                    'public_note' => $publicNote,
                    'marked_by' => $actor->id,
                ]);
                $this->auditLogger->record(new AuditEvent(
                    action: AuditAction::AttendanceRecorded,
                    module: AuditModule::Academics,
                    schoolId: $schoolId,
                    subjectType: AuditSubject::AttendanceSession,
                    subjectId: $session->id,
                    newValues: [
                        'student_id' => $student->id,
                        'student_no' => $student->student_no,
                        'status' => $status,
                        'device_id' => $deviceId,
                        'scanned_at' => $scannedAt->toIso8601String(),
                    ],
                    reason: "Gate check-in event: {$deviceId}",
                ), $context);
            }

            $duplicate = $record->wasRecentlyCreated === false;
            $status = $record->status;

            return [
                'success' => true,
                'status' => $status,
                'is_late' => $status === 'late',
                'duplicate' => $duplicate,
                'scanned_at' => $scannedAt->toIso8601String(),
                'student' => [
                    'id' => $student->id,
                    'student_no' => $student->student_no,
                    'full_name' => $student->full_name,
                    'class_id' => $schoolClass->id,
                    'class_name' => $schoolClass->name,
                ],
                'session' => [
                    'id' => $session->id,
                    'attendance_date' => $session->attendance_date,
                    'session_key' => $session->session_key,
                ],
                'record' => [
                    'id' => $record->id,
                    'status' => $record->status,
                    'public_note' => $record->public_note,
                ],
            ];
        });
    }

    /**
     * Batch record multiple gate check-in events.
     */
    public function recordBatchGateCheckIn(int $schoolId, array $events, User $actor, AuditContext $context): array
    {
        $results = [];
        $errors = [];

        foreach ($events as $index => $event) {
            try {
                $results[] = $this->recordGateCheckIn($schoolId, $event, $actor, $context);
            } catch (ValidationException $e) {
                $errors[] = [
                    'index' => $index,
                    'identifier' => $event['student_no'] ?? $event['student_id'] ?? 'unknown',
                    'message' => $e->getMessage(),
                ];
            }
        }

        return [
            'total_processed' => count($results),
            'total_failed' => count($errors),
            'results' => $results,
            'errors' => $errors,
        ];
    }

    private function assertTeacherScope(int $schoolId, int $academicYearId, int $classId, User $actor): void
    {
        if ($actor->is_platform_owner || $actor->hasPermissionTo('students.view') || $actor->hasPermissionTo('students.update')) {
            return;
        }

        $authorized = TeachingAssignment::query()
            ->where('school_id', $schoolId)
            ->where('teacher_user_id', $actor->id)
            ->where('academic_year_id', $academicYearId)
            ->where('class_id', $classId)
            ->where('status', 'active')
            ->where('current_slot', 1)
            ->exists();

        if (! $authorized) {
            abort(403, 'This class is outside the teacher assignment scope.');
        }
    }
}
