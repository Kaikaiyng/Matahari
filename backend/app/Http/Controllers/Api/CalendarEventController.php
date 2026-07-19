<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCalendarEventRequest;
use App\Http\Requests\UpdateCalendarEventRequest;
use App\Models\CalendarEvent;
use App\Models\School;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class CalendarEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after_or_equal:start'],
        ]);
        $rangeStart = CarbonImmutable::parse($validated['start'])->startOfDay();
        $rangeEnd = CarbonImmutable::parse($validated['end'])->endOfDay();

        $events = CalendarEvent::query()
            ->with(['creator:id,name', 'updater:id,name'])
            ->where('school_id', $this->schoolId($request))
            ->where('starts_at', '<=', $rangeEnd)
            ->where(function (Builder $query) use ($rangeStart): void {
                $query->where('ends_at', '>=', $rangeStart)
                    ->orWhere(function (Builder $inner) use ($rangeStart): void {
                        $inner->whereNull('ends_at')->where('starts_at', '>=', $rangeStart);
                    });
            })
            ->orderBy('starts_at')
            ->orderBy('title')
            ->get()
            ->map(fn (CalendarEvent $event) => $this->serialize($event));

        return response()->json(['data' => $events]);
    }

    public function store(StoreCalendarEventRequest $request): JsonResponse
    {
        $event = CalendarEvent::query()->create([
            ...$request->validated(),
            'school_id' => $this->schoolId($request),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'calendar_event' => $this->serialize($event->load(['creator:id,name', 'updater:id,name'])),
        ], 201);
    }

    public function update(UpdateCalendarEventRequest $request, int $calendarEvent): JsonResponse
    {
        $event = $this->eventForSchool($request, $calendarEvent);
        $event->update([
            ...$request->validated(),
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'calendar_event' => $this->serialize($event->fresh(['creator:id,name', 'updater:id,name'])),
        ]);
    }

    public function destroy(Request $request, int $calendarEvent): Response
    {
        $this->eventForSchool($request, $calendarEvent)->delete();

        return response()->noContent();
    }

    private function schoolId(Request $request): int
    {
        $schoolId = $request->user()?->school_id ?: $request->integer('school_id');
        if (! $schoolId || ! School::query()->whereKey($schoolId)->where('status', 'active')->exists()) {
            throw ValidationException::withMessages(['school_id' => 'An active school is required.']);
        }

        return $schoolId;
    }

    private function eventForSchool(Request $request, int $eventId): CalendarEvent
    {
        return CalendarEvent::query()
            ->where('school_id', $this->schoolId($request))
            ->findOrFail($eventId);
    }

    /** @return array<string, mixed> */
    private function serialize(CalendarEvent $event): array
    {
        return [
            'id' => $event->id,
            'school_id' => $event->school_id,
            'title' => $event->title,
            'event_type' => $event->event_type,
            'is_all_day' => $event->is_all_day,
            'starts_at' => $event->starts_at?->toISOString(),
            'ends_at' => $event->ends_at?->toISOString(),
            'location' => $event->location,
            'participants' => $event->participants,
            'notes' => $event->notes,
            'created_by' => $event->creator ? [
                'id' => $event->creator->id,
                'name' => $event->creator->name,
            ] : null,
            'updated_by' => $event->updater ? [
                'id' => $event->updater->id,
                'name' => $event->updater->name,
            ] : null,
            'created_at' => $event->created_at?->toISOString(),
            'updated_at' => $event->updated_at?->toISOString(),
        ];
    }
}
