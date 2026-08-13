<?php

namespace App\Services\Quiz;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\ClassEnrolment;
use App\Models\Quiz;
use App\Models\QuizAssignment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuizAssignmentService
{
    public function __construct(private readonly QuizAccessService $access, private readonly AuditLoggerContract $audit) {}

    public function create(int $schoolId, Quiz $quiz, array $data, User $actor, AuditContext $context): QuizAssignment
    {
        $this->access->assertOwns($actor, $schoolId, $quiz);
        $classIds = collect($data['class_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values()->all();
        $studentIds = collect($data['student_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values()->all();
        abort_if($classIds === [] && $studentIds === [], 422, 'At least one class or student target is required.');
        abort_if(SchoolClass::query()->whereIn('id', $classIds)->where('school_id', $schoolId)->count() !== count($classIds), 403, 'Every class target must belong to this school.');
        $this->access->assertCanAuthor($actor, $schoolId, $quiz->subject_id, $classIds ?: $this->studentClassIds($schoolId, $studentIds, $data['academic_year_id']), $data['academic_year_id']);
        if (Student::query()->whereIn('id', $studentIds)->where('school_id', '!=', $schoolId)->exists() || Student::query()->whereIn('id', $studentIds)->count() !== count($studentIds)) {
            throw ValidationException::withMessages(['student_ids' => 'Every direct student target must belong to this school.']);
        }

        return DB::transaction(function () use ($schoolId, $quiz, $data, $actor, $context, $classIds, $studentIds) {
            $assignment = QuizAssignment::query()->create(['school_id' => $schoolId, 'academic_year_id' => $data['academic_year_id'], 'quiz_id' => $quiz->id, 'assigned_by_user_id' => $actor->id, 'available_from' => $data['available_from'] ?? null, 'due_at' => $data['due_at'] ?? null, 'attempt_limit' => $data['attempt_limit'], 'status' => 'draft']);
            foreach ($classIds as $id) {
                $assignment->classTargets()->create(['school_id' => $schoolId, 'class_id' => $id]);
            }foreach ($studentIds as $id) {
                $assignment->studentTargets()->create(['school_id' => $schoolId, 'student_id' => $id]);
            }$this->audit->record(new AuditEvent(action: AuditAction::QuizAssignmentCreated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::QuizAssignment, subjectId: $assignment->id, newValues: ['class_ids' => $classIds, 'student_ids' => $studentIds]), $context);

            return $assignment;
        });
    }

    public function publish(int $schoolId, QuizAssignment $assignment, User $actor, AuditContext $context): QuizAssignment
    {
        $quiz = $assignment->quiz()->firstOrFail();
        $this->access->assertOwns($actor, $schoolId, $quiz);

        return DB::transaction(function () use ($schoolId, $assignment, $quiz, $context) {
            $locked = QuizAssignment::query()->whereKey($assignment->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->status === 'published', 409, 'Assignment is already published.');
            $classIds = $locked->classTargets()->pluck('class_id');
            abort_unless($locked->academic_year_id, 409, 'Legacy assignment requires an explicit academic year before publication.');
            $classStudents = ClassEnrolment::query()->where('school_id', $schoolId)->where('academic_year_id', $locked->academic_year_id)->whereIn('class_id', $classIds)->where('status', 'active')->where('current_slot', 1)->pluck('student_id');
            $direct = $locked->studentTargets()->pluck('student_id');
            $sources = [];
            foreach ($classStudents as $id) {
                $sources[(int) $id] = 'class';
            }foreach ($direct as $id) {
                $sources[(int) $id] = isset($sources[(int) $id]) ? 'class_and_direct' : 'direct';
            }if ($sources === []) {
                throw ValidationException::withMessages(['targets' => 'Assignment has no eligible recipients.']);
            }foreach ($sources as $id => $source) {
                $locked->recipients()->updateOrCreate(['student_id' => $id], ['school_id' => $schoolId, 'eligibility_source' => $source, 'resolved_at' => now()]);
            }$now = now();
            $locked->update(['status' => 'published', 'published_at' => $now]);
            $quiz->update(['status' => 'published', 'published_at' => $quiz->published_at ?? $now]);
            $this->audit->record(new AuditEvent(action: AuditAction::QuizAssignmentPublished, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::QuizAssignment, subjectId: $locked->id, newValues: ['recipient_count' => count($sources)]), $context);

            return $locked;
        });
    }

    private function studentClassIds(int $schoolId, array $studentIds, int $academicYearId): array
    {
        return ClassEnrolment::query()->where('school_id', $schoolId)->where('academic_year_id', $academicYearId)->whereIn('student_id', $studentIds)->where('status', 'active')->where('current_slot', 1)->pluck('class_id')->map(fn ($id) => (int) $id)->unique()->all();
    }
}
