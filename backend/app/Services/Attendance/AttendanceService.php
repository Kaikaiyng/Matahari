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
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    public function saveDaily(int $schoolId, array $data, User $actor, AuditContext $context): AttendanceSession
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): AttendanceSession {
            $year = AcademicYear::query()->whereKey($data['academic_year_id'])->firstOrFail();
            $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();

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

    private function assertTeacherScope(int $schoolId, int $academicYearId, int $classId, User $actor): void
    {
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
