<?php

namespace App\Services\Schedule;

use App\Models\Assessment;
use App\Models\ClassEnrolment;
use App\Models\ClassScheduleEntry;
use App\Models\Student;

class ScheduleReadService
{
    public function forStudent(Student $student): array
    {
        $enrolment = ClassEnrolment::query()->where('school_id', $student->school_id)->where('student_id', $student->id)->where('status', 'active')->where('current_slot', 1)->first();
        if (! $enrolment) {
            return ['entries' => [], 'due_dates' => []];
        }

        $entries = ClassScheduleEntry::query()->with(['subject', 'teachingAssignment.teacher'])->where('school_id', $student->school_id)
            ->where('academic_year_id', $enrolment->academic_year_id)->where('class_id', $enrolment->class_id)->where('status', 'published')
            ->orderBy('day_of_week')->orderBy('starts_at')->get()->map(fn (ClassScheduleEntry $entry) => [
                'id' => $entry->id, 'title' => $entry->title, 'day_of_week' => $entry->day_of_week, 'starts_at' => substr($entry->starts_at, 0, 5), 'ends_at' => substr($entry->ends_at, 0, 5),
                'location' => $entry->location, 'subject' => $entry->subject?->name, 'teacher' => $entry->teachingAssignment?->teacher?->name,
                'effective_from' => $entry->effective_from?->toDateString(), 'effective_to' => $entry->effective_to?->toDateString(),
            ])->values()->all();

        $dueDates = Assessment::query()->with('subject')->where('school_id', $student->school_id)->where('academic_year_id', $enrolment->academic_year_id)
            ->where('status', 'published')->whereNotNull('due_at')->whereHas('classTargets', fn ($query) => $query->where('class_id', $enrolment->class_id))
            ->orderBy('due_at')->get()->map(fn (Assessment $assessment) => ['assessment_id' => $assessment->id, 'title' => $assessment->title, 'subject' => $assessment->subject->name, 'due_at' => $assessment->due_at?->toIso8601String()])->values()->all();

        return ['entries' => $entries, 'due_dates' => $dueDates];
    }
}
