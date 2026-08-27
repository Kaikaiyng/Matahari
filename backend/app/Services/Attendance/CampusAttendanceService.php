<?php

namespace App\Services\Attendance;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AttendanceDevice;
use App\Models\AttendanceSetting;
use App\Models\CampusAttendanceEvent;
use App\Models\Student;
use App\Models\StudentParentLink;
use App\Models\User;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Notifications\NotificationMessage;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CampusAttendanceService
{
    public function __construct(
        private readonly AuditLoggerContract $auditLogger,
        private readonly NotificationDispatcher $notifications,
    ) {}

    public function record(int $schoolId, array $data, ?User $actor, AuditContext $context): array
    {
        return DB::transaction(function () use ($schoolId, $data, $actor, $context): array {
            $student = Student::query()->with('school')->where('school_id', $schoolId)
                ->when($data['student_no'] ?? null, fn ($query, $value) => $query->where('student_no', $value))
                ->when(! isset($data['student_no']) && isset($data['student_id']), fn ($query) => $query->whereKey($data['student_id']))
                ->first();
            if (! $student) {
                throw ValidationException::withMessages(['student_no' => 'No student found matching the identification provided.']);
            }

            $device = null;
            if (! empty($data['device_id'])) {
                $device = AttendanceDevice::query()->where('school_id', $schoolId)->where('external_device_id', $data['device_id'])->first();
                if ($device && $device->status !== 'active') {
                    throw ValidationException::withMessages(['device_id' => 'The Attendance device is inactive.']);
                }
                if ($device && $device->direction_mode !== 'bidirectional' && $device->direction_mode !== $data['direction']) {
                    throw ValidationException::withMessages(['direction' => 'The device is not configured for this movement direction.']);
                }
            }

            $source = $data['source'] ?? ($device?->vendor ?? 'admin');
            if (! empty($data['external_event_id'])) {
                $existing = CampusAttendanceEvent::query()
                    ->where('school_id', $schoolId)->where('source', $source)
                    ->where('external_event_id', $data['external_event_id'])->first();
                if ($existing) {
                    return $this->result($existing->load(['student', 'device']), true);
                }
            }

            $occurredAt = Carbon::parse($data['occurred_at'] ?? $data['scanned_at'] ?? now());
            $event = CampusAttendanceEvent::query()->create([
                'school_id' => $schoolId,
                'student_id' => $student->id,
                'attendance_device_id' => $device?->id,
                'direction' => $data['direction'],
                'method' => $data['method'] ?? 'unknown',
                'event_date' => $occurredAt->toDateString(),
                'event_time' => $occurredAt->format('H:i:s'),
                'occurred_at' => $occurredAt,
                'source' => $source,
                'external_event_id' => $data['external_event_id'] ?? null,
                'note' => $data['note'] ?? null,
                'recorded_by' => $actor?->id,
            ]);

            $this->notifyGuardians($event, $student);
            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::CampusAttendanceRecorded,
                module: AuditModule::Academics,
                schoolId: $schoolId,
                subjectType: AuditSubject::CampusAttendanceEvent,
                subjectId: $event->id,
                newValues: [
                    'student_id' => $student->id,
                    'direction' => $event->direction,
                    'method' => $event->method,
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'device_id' => $device?->external_device_id,
                ],
                reason: $event->note ?? 'Campus movement recorded.',
            ), $context);

            return $this->result($event->load(['student', 'device']), false);
        });
    }

    public function recordBatch(int $schoolId, array $events, ?User $actor, AuditContext $context): array
    {
        $results = [];
        $errors = [];
        foreach ($events as $index => $event) {
            try {
                $results[] = $this->record($schoolId, $event, $actor, $context);
            } catch (ValidationException $exception) {
                $errors[] = ['index' => $index, 'identifier' => $event['student_no'] ?? $event['student_id'] ?? 'unknown', 'message' => $exception->getMessage()];
            }
        }

        return ['total_processed' => count($results), 'total_failed' => count($errors), 'results' => $results, 'errors' => $errors];
    }

    private function notifyGuardians(CampusAttendanceEvent $event, Student $student): void
    {
        $settings = $this->settings($event->school_id);
        $enabled = $event->direction === 'entry' ? $settings->notify_guardians_on_entry : $settings->notify_guardians_on_exit;
        if (! $enabled) {
            return;
        }

        $recipientIds = StudentParentLink::query()
            ->join('parents', 'parents.id', '=', 'student_parent_links.parent_id')
            ->where('student_parent_links.school_id', $event->school_id)
            ->where('student_parent_links.student_id', $student->id)
            ->where('student_parent_links.status', 'active')
            ->where('student_parent_links.current_slot', 1)
            ->whereNotNull('parents.user_id')
            ->pluck('parents.user_id')->unique();
        $verb = $event->direction === 'entry' ? 'entered school' : 'left school';
        $this->notifications->sendInApp(new NotificationMessage(
            tenantId: (int) $student->school->tenant_id,
            schoolId: (int) $event->school_id,
            type: 'attendance',
            title: $event->direction === 'entry' ? 'School Entry' : 'School Exit',
            body: "{$student->full_name} {$verb} at ".Carbon::parse($event->event_time)->format('g:i A').'.',
            context: ['student_id' => $student->id, 'campus_attendance_event_id' => $event->id, 'direction' => $event->direction],
        ), $recipientIds);
    }

    private function result(CampusAttendanceEvent $event, bool $duplicate): array
    {
        $settings = $this->settings($event->school_id);
        $time = $event->event_time;

        return [
            'id' => $event->id,
            'success' => true,
            'duplicate' => $duplicate,
            'direction' => $event->direction,
            'method' => $event->method,
            'occurred_at' => $event->occurred_at->toIso8601String(),
            'is_late' => $event->direction === 'entry' && $time > $settings->arrival_time,
            'is_early_leave' => $event->direction === 'exit' && $time < $settings->dismissal_time,
            'student' => ['id' => $event->student->id, 'student_no' => $event->student->student_no, 'full_name' => $event->student->full_name],
            'device' => $event->device ? ['id' => $event->device->id, 'name' => $event->device->name, 'external_device_id' => $event->device->external_device_id] : null,
        ];
    }

    private function settings(int $schoolId): AttendanceSetting
    {
        return AttendanceSetting::query()->firstOrCreate(
            ['school_id' => $schoolId],
            ['arrival_time' => '08:00:00', 'dismissal_time' => '15:00:00', 'notify_guardians_on_entry' => true, 'notify_guardians_on_exit' => true],
        );
    }
}
