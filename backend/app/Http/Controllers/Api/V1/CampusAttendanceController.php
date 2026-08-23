<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditAction;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Http\Controllers\Controller;
use App\Models\AttendanceDevice;
use App\Models\AttendanceSetting;
use App\Models\CampusAttendanceEvent;
use App\Models\TeachingAssignment;
use App\Services\Attendance\CampusAttendanceService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CampusAttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data = $request->validate(['date' => ['nullable', 'date_format:Y-m-d'], 'student_id' => ['nullable', 'integer']]);
        $date = $data['date'] ?? now()->toDateString();
        $allowedClassIds = $request->attributes->get('attendance_class_ids');
        $events = CampusAttendanceEvent::query()->with(['student:id,student_no,full_name,class_id', 'student.class:id,name', 'device:id,name,external_device_id'])
            ->where('school_id', $schoolId)->whereDate('event_date', $date)
            ->when(is_array($allowedClassIds), fn ($query) => $query->whereHas('student', fn ($student) => $student->whereIn('class_id', $allowedClassIds)))
            ->when($data['student_id'] ?? null, fn ($query, $id) => $query->where('student_id', $id))
            ->orderByDesc('occurred_at')->get();
        $settings = $this->attendanceSettings($schoolId);

        $students = $events->groupBy('student_id')->map(function ($timeline) use ($settings): array {
            $ordered = $timeline->sortBy('occurred_at')->values();
            $firstEntry = $ordered->firstWhere('direction', 'entry');
            $lastExit = $ordered->where('direction', 'exit')->last();
            $latest = $ordered->last();

            return [
                'student_id' => $latest->student_id,
                'student_no' => $latest->student->student_no,
                'student_name' => $latest->student->full_name,
                'class_name' => $latest->student->class?->name,
                'current_status' => $latest->direction === 'entry' ? 'on_campus' : 'off_campus',
                'first_entry' => $firstEntry?->occurred_at?->toIso8601String(),
                'last_exit' => $lastExit?->occurred_at?->toIso8601String(),
                'is_late' => $firstEntry ? $firstEntry->event_time > $settings->arrival_time : false,
                'is_early_leave' => $lastExit ? $lastExit->event_time < $settings->dismissal_time : false,
                'movement_count' => $ordered->count(),
            ];
        })->values();

        return response()->json(['data' => [
            'date' => $date,
            'summary' => ['recorded_students' => $students->count(), 'on_campus' => $students->where('current_status', 'on_campus')->count(), 'off_campus' => $students->where('current_status', 'off_campus')->count(), 'late' => $students->where('is_late', true)->count(), 'early_leave' => $students->where('is_early_leave', true)->count()],
            'students' => $students,
            'events' => $events->map(fn ($event) => $this->eventResponse($event)),
        ]]);
    }

    public function teacherIndex(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermissionTo('attendance.view_school')) {
            $classIds = TeachingAssignment::query()->where('school_id', SchoolContext::fromRequest($request)->schoolId)
                ->where('teacher_user_id', $request->user()->id)->where('status', 'active')->where('current_slot', 1)
                ->pluck('class_id')->unique()->values()->all();
            $request->attributes->set('attendance_class_ids', $classIds);
        }

        return $this->index($request);
    }

    public function store(Request $request, CampusAttendanceService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $this->eventData($request);

        return response()->json(['data' => $service->record(SchoolContext::fromRequest($request)->schoolId, $data, $request->user(), $contexts->fromRequest($request))]);
    }

    public function storeBatch(Request $request, CampusAttendanceService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['events' => ['required', 'array', 'min:1', 'max:500']]);
        $events = collect($data['events'])->map(function ($event): array {
            $child = Request::create('/', 'POST', $event);

            return $this->eventData($child);
        })->all();

        return response()->json(['data' => $service->recordBatch(SchoolContext::fromRequest($request)->schoolId, $events, $request->user(), $contexts->fromRequest($request))]);
    }

    public function devices(Request $request): JsonResponse
    {
        return response()->json(['data' => AttendanceDevice::query()->where('school_id', SchoolContext::fromRequest($request)->schoolId)->orderBy('name')->get()->map(fn ($device) => $this->deviceResponse($device))]);
    }

    public function storeDevice(Request $request, AuditLoggerContract $audit, AuditContextFactory $contexts): JsonResponse
    {
        $data = $this->deviceData($request);
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $device = DB::transaction(function () use ($schoolId, $data, $request, $audit, $contexts) {
            $device = AttendanceDevice::query()->create(['school_id' => $schoolId, ...$data]);
            $audit->record(new AuditEvent(AuditAction::AttendanceDeviceConfigured, AuditModule::Academics, $schoolId, AuditSubject::AttendanceDevice, $device->id, [], $this->deviceResponse($device), reason: 'Attendance device added.'), $contexts->fromRequest($request));

            return $device;
        });

        return response()->json(['data' => $this->deviceResponse($device)], 201);
    }

    public function updateDevice(Request $request, AttendanceDevice $attendanceDevice, AuditLoggerContract $audit, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        if ((int) $attendanceDevice->school_id !== $schoolId) {
            abort(403);
        }
        $data = $this->deviceData($request, $attendanceDevice->id);
        $device = DB::transaction(function () use ($attendanceDevice, $data, $request, $audit, $contexts, $schoolId) {
            $before = $this->deviceResponse($attendanceDevice);
            $attendanceDevice->update($data);
            $audit->record(new AuditEvent(AuditAction::AttendanceDeviceConfigured, AuditModule::Academics, $schoolId, AuditSubject::AttendanceDevice, $attendanceDevice->id, $before, $this->deviceResponse($attendanceDevice->fresh()), reason: 'Attendance device updated.'), $contexts->fromRequest($request));

            return $attendanceDevice->fresh();
        });

        return response()->json(['data' => $this->deviceResponse($device)]);
    }

    public function settings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->attendanceSettings(SchoolContext::fromRequest($request)->schoolId)]);
    }

    public function updateSettings(Request $request, AuditLoggerContract $audit, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['arrival_time' => ['required', 'date_format:H:i'], 'dismissal_time' => ['required', 'date_format:H:i'], 'notify_guardians_on_entry' => ['required', 'boolean'], 'notify_guardians_on_exit' => ['required', 'boolean']]);
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $settings = DB::transaction(function () use ($data, $schoolId, $request, $audit, $contexts) {
            $settings = $this->attendanceSettings($schoolId);
            $before = $settings->only(array_keys($data));
            $settings->update([...$data, 'updated_by' => $request->user()->id]);
            $audit->record(new AuditEvent(AuditAction::AttendanceSettingsUpdated, AuditModule::Academics, $schoolId, AuditSubject::AttendanceSetting, $settings->id, $before, $settings->fresh()->only(array_keys($data)), reason: 'School Attendance settings updated.'), $contexts->fromRequest($request));

            return $settings->fresh();
        });

        return response()->json(['data' => $settings]);
    }

    private function eventData(Request $request): array
    {
        $data = $request->validate(['student_no' => ['required_without:student_id', 'string', 'max:64'], 'student_id' => ['required_without:student_no', 'integer'], 'direction' => ['nullable', Rule::in(['entry', 'exit'])], 'method' => ['nullable', Rule::in(['face', 'card', 'manual', 'unknown'])], 'occurred_at' => ['nullable', 'date'], 'scanned_at' => ['nullable', 'date'], 'device_id' => ['nullable', 'string', 'max:100'], 'source' => ['nullable', 'string', 'max:50'], 'external_event_id' => ['nullable', 'string', 'max:150'], 'note' => ['nullable', 'string', 'max:500']]);

        return ['direction' => 'entry', ...$data];
    }

    private function deviceData(Request $request, ?int $ignoreId = null): array
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return $request->validate(['name' => ['required', 'string', 'max:255'], 'vendor' => ['required', Rule::in(['hikvision', 'generic'])], 'external_device_id' => ['required', 'string', 'max:100', Rule::unique('attendance_devices')->where('school_id', $schoolId)->ignore($ignoreId)], 'direction_mode' => ['required', Rule::in(['entry', 'exit', 'bidirectional'])], 'status' => ['required', Rule::in(['active', 'inactive'])], 'location' => ['nullable', 'string', 'max:255'], 'credential_secret' => ['nullable', 'string', 'max:2000']]);
    }

    private function deviceResponse(AttendanceDevice $device): array
    {
        return ['id' => $device->id, 'name' => $device->name, 'vendor' => $device->vendor, 'external_device_id' => $device->external_device_id, 'direction_mode' => $device->direction_mode, 'status' => $device->status, 'location' => $device->location, 'has_credential' => filled($device->credential_secret), 'last_seen_at' => $device->last_seen_at?->toIso8601String()];
    }

    private function eventResponse(CampusAttendanceEvent $event): array
    {
        return ['id' => $event->id, 'student_id' => $event->student_id, 'student_no' => $event->student->student_no, 'student_name' => $event->student->full_name, 'class_name' => $event->student->class?->name, 'direction' => $event->direction, 'method' => $event->method, 'occurred_at' => $event->occurred_at->toIso8601String(), 'device_name' => $event->device?->name, 'note' => $event->note];
    }

    private function attendanceSettings(int $schoolId): AttendanceSetting
    {
        return AttendanceSetting::query()->firstOrCreate(
            ['school_id' => $schoolId],
            ['arrival_time' => '08:00:00', 'dismissal_time' => '15:00:00', 'notify_guardians_on_entry' => true, 'notify_guardians_on_exit' => true],
        );
    }
}
