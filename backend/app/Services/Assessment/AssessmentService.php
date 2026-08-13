<?php

namespace App\Services\Assessment;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicTerm;
use App\Models\AcademicYear;
use App\Models\Assessment;
use App\Models\AssessmentResult;
use App\Models\ClassEnrolment;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssessmentService
{
    public function __construct(private readonly AssessmentAccessService $access, private readonly AuditLoggerContract $audit) {}

    public function create(int $schoolId, array $data, User $actor, AuditContext $context): Assessment
    {
        $classIds = collect($data['class_ids'])->map(fn ($id) => (int) $id)->unique()->values()->all();
        AcademicYear::query()->where('school_id', $schoolId)->findOrFail($data['academic_year_id']);
        Subject::query()->where('school_id', $schoolId)->findOrFail($data['subject_id']);
        $foundClassIds = SchoolClass::query()->where('school_id', $schoolId)->whereIn('id', $classIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (array_diff($classIds, $foundClassIds) !== []) {
            abort(403, 'A target class belongs to a different school.');
        }
        if ($data['academic_term_id'] ?? null) {
            $term = AcademicTerm::query()->where('school_id', $schoolId)->findOrFail($data['academic_term_id']);
            if ((int) $term->academic_year_id !== (int) $data['academic_year_id']) {
                throw ValidationException::withMessages(['academic_term_id' => 'The term must belong to the selected academic year.']);
            }
        }
        $this->access->assertCanManageTargets($actor, $schoolId, $data['academic_year_id'], $data['subject_id'], $classIds);

        return DB::transaction(function () use ($schoolId, $data, $actor, $context, $classIds): Assessment {
            unset($data['class_ids']);
            $assessment = Assessment::query()->create([...$data, 'school_id' => $schoolId, 'created_by_user_id' => $actor->id, 'status' => 'draft']);
            foreach ($classIds as $classId) {
                $assessment->classTargets()->create(['school_id' => $schoolId, 'class_id' => $classId]);
            }
            $this->audit->record(new AuditEvent(action: AuditAction::AssessmentCreated, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::Assessment, subjectId: $assessment->id, newValues: ['class_ids' => $classIds, 'type' => $assessment->assessment_type, 'max_score' => $assessment->max_score]), $context);

            return $assessment;
        });
    }

    public function saveResults(int $schoolId, Assessment $assessment, array $rows, User $actor, AuditContext $context): Assessment
    {
        $this->access->assertCanManage($actor, $schoolId, $assessment);
        abort_if($assessment->status === 'published', 409, 'Published assessment results cannot be silently rewritten.');
        $studentIds = collect($rows)->pluck('student_id')->map(fn ($id) => (int) $id)->all();
        $eligible = $this->eligibleStudentIds($assessment, $studentIds);
        if (array_diff($studentIds, $eligible) !== []) {
            throw ValidationException::withMessages(['results' => 'Every student must have a current enrolment in a target class and academic year.']);
        }
        foreach ($rows as $row) {
            if ((float) $row['score'] > (float) $assessment->max_score) {
                throw ValidationException::withMessages(['results' => 'A score cannot exceed the assessment maximum.']);
            }
        }

        return DB::transaction(function () use ($schoolId, $assessment, $rows, $actor, $context): Assessment {
            foreach ($rows as $row) {
                AssessmentResult::query()->updateOrCreate(
                    ['assessment_id' => $assessment->id, 'student_id' => $row['student_id']],
                    ['school_id' => $schoolId, 'score' => $row['score'], 'grade_label' => $row['grade_label'] ?? null, 'teacher_comment' => $row['teacher_comment'] ?? null, 'status' => 'draft', 'assessed_by_user_id' => $actor->id, 'published_at' => null],
                );
            }
            $this->audit->record(new AuditEvent(action: AuditAction::AssessmentResultsSaved, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::Assessment, subjectId: $assessment->id, newValues: ['student_ids' => collect($rows)->pluck('student_id')->all()]), $context);

            return $assessment;
        });
    }

    public function publish(int $schoolId, Assessment $assessment, User $actor, AuditContext $context): Assessment
    {
        $this->access->assertCanManage($actor, $schoolId, $assessment);

        return DB::transaction(function () use ($schoolId, $assessment, $context): Assessment {
            $locked = Assessment::query()->whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            abort_if($locked->status === 'published', 409, 'Assessment is already published.');
            $required = $this->eligibleStudentIds($locked);
            $ready = $locked->results()->whereNotNull('score')->pluck('student_id')->map(fn ($id) => (int) $id)->all();
            if ($required === [] || array_diff($required, $ready) !== []) {
                throw ValidationException::withMessages(['results' => 'Every currently enrolled target student requires a score before publication.']);
            }
            $now = now();
            $locked->results()->whereIn('student_id', $required)->update(['status' => 'published', 'published_at' => $now]);
            $locked->update(['status' => 'published', 'published_at' => $now]);
            $this->audit->record(new AuditEvent(action: AuditAction::AssessmentPublished, module: AuditModule::Academics, schoolId: $schoolId, subjectType: AuditSubject::Assessment, subjectId: $locked->id, newValues: ['student_count' => count($required)]), $context);

            return $locked;
        });
    }

    private function eligibleStudentIds(Assessment $assessment, ?array $restrict = null): array
    {
        return ClassEnrolment::query()->where('school_id', $assessment->school_id)->where('academic_year_id', $assessment->academic_year_id)
            ->whereIn('class_id', $assessment->classTargets()->pluck('class_id'))->where('status', 'active')->where('current_slot', 1)
            ->when($restrict !== null, fn ($q) => $q->whereIn('student_id', $restrict))->pluck('student_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}
