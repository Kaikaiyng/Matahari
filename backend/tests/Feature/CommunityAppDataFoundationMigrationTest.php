<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CommunityAppDataFoundationMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_community_assessment_and_quiz_foundation_tables_exist(): void
    {
        foreach ([
            'community_posts',
            'community_post_audiences',
            'community_post_media',
            'community_post_reactions',
            'community_comments',
            'academic_terms',
            'assessments',
            'assessment_class_targets',
            'assessment_results',
            'quizzes',
            'quiz_questions',
            'quiz_options',
            'quiz_assignments',
            'quiz_assignment_class_targets',
            'quiz_assignment_student_targets',
            'quiz_assignment_recipients',
            'quiz_attempts',
            'quiz_attempt_answers',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected {$table} to exist.");
        }

        $this->assertTrue(Schema::hasColumns('community_post_media', [
            'storage_disk',
            'storage_path',
            'mime_type',
            'size_bytes',
        ]));
        $this->assertTrue(Schema::hasColumn('community_posts', 'calendar_event_id'));
        $this->assertTrue(Schema::hasColumns('assessment_results', [
            'status',
            'published_at',
            'teacher_comment',
        ]));
        $this->assertTrue(Schema::hasColumns('quizzes', [
            'quiz_kind',
            'revision_of_id',
            'version_number',
            'published_at',
        ]));
    }

    public function test_community_audience_uniqueness_is_database_enforced(): void
    {
        [$school, $class, , $user] = $this->schoolContext();
        $now = now();
        $postId = DB::table('community_posts')->insertGetId([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'author_user_id' => $user->id,
            'body' => 'School update',
            'status' => 'published',
            'published_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('community_post_audiences')->insert([
            'school_id' => $school->id,
            'community_post_id' => $postId,
            'audience_type' => 'class',
            'class_id' => $class->id,
            'audience_key' => "class:{$class->id}",
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->expectException(QueryException::class);
        DB::table('community_post_audiences')->insert([
            'school_id' => $school->id,
            'community_post_id' => $postId,
            'audience_type' => 'class',
            'class_id' => $class->id,
            'audience_key' => "class:{$class->id}",
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function test_assessment_results_and_materialized_quiz_recipients_are_deduplicated(): void
    {
        [$school, $class, $student, $user] = $this->schoolContext();
        $now = now();
        $yearId = DB::table('academic_years')->insertGetId([
            'school_id' => $school->id,
            'code' => '2026',
            'name' => '2026 Academic Year',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $subjectId = DB::table('subjects')->insertGetId([
            'school_id' => $school->id,
            'code' => 'ENG',
            'name' => 'English',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $assessmentId = DB::table('assessments')->insertGetId([
            'school_id' => $school->id,
            'academic_year_id' => $yearId,
            'subject_id' => $subjectId,
            'created_by_user_id' => $user->id,
            'title' => 'Reading Check',
            'assessment_type' => 'test',
            'max_score' => 20,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('assessment_class_targets')->insert([
            'school_id' => $school->id,
            'assessment_id' => $assessmentId,
            'class_id' => $class->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('assessment_results')->insert([
            'school_id' => $school->id,
            'assessment_id' => $assessmentId,
            'student_id' => $student->id,
            'status' => 'draft',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $quizId = DB::table('quizzes')->insertGetId([
            'school_id' => $school->id,
            'subject_id' => $subjectId,
            'owner_user_id' => $user->id,
            'quiz_kind' => 'formal',
            'title' => 'Reading Quiz',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $assignmentId = DB::table('quiz_assignments')->insertGetId([
            'school_id' => $school->id,
            'quiz_id' => $quizId,
            'assigned_by_user_id' => $user->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('quiz_assignment_class_targets')->insert([
            'school_id' => $school->id,
            'quiz_assignment_id' => $assignmentId,
            'class_id' => $class->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('quiz_assignment_student_targets')->insert([
            'school_id' => $school->id,
            'quiz_assignment_id' => $assignmentId,
            'student_id' => $student->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('quiz_assignment_recipients')->insert([
            'school_id' => $school->id,
            'quiz_assignment_id' => $assignmentId,
            'student_id' => $student->id,
            'eligibility_source' => 'both',
            'resolved_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        try {
            DB::table('assessment_results')->insert([
                'school_id' => $school->id,
                'assessment_id' => $assessmentId,
                'student_id' => $student->id,
                'status' => 'draft',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->fail('A duplicate assessment result was accepted.');
        } catch (QueryException) {
            $this->assertDatabaseCount('assessment_results', 1);
        }

        try {
            DB::table('quiz_assignment_recipients')->insert([
                'school_id' => $school->id,
                'quiz_assignment_id' => $assignmentId,
                'student_id' => $student->id,
                'eligibility_source' => 'direct',
                'resolved_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->fail('A duplicate materialized Quiz recipient was accepted.');
        } catch (QueryException) {
            $this->assertDatabaseCount('quiz_assignment_recipients', 1);
        }
    }

    /** @return array{School, SchoolClass, Student, User} */
    private function schoolContext(): array
    {
        $school = $this->createTenantSchool([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'status' => 'active',
        ]);
        $class = SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'MA1',
            'status' => 'active',
        ]);
        $student = Student::query()->create([
            'school_id' => $school->id,
            'class_id' => $class->id,
            'student_no' => 'MIS-001',
            'full_name' => 'Student One',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $user = User::factory()->create(['school_id' => $school->id]);

        return [$school, $class, $student, $user];
    }
}
