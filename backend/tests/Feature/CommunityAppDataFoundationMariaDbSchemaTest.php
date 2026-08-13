<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('mariadb-app-foundation')]
class CommunityAppDataFoundationMariaDbSchemaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mariadb') {
            $this->markTestSkipped('This schema inspection requires a migrated disposable MariaDB database.');
        }

        $version = DB::selectOne('SELECT VERSION() AS server_version');
        $this->assertStringContainsString('MariaDB', (string) $version?->server_version);
    }

    public function test_foundation_tables_and_critical_foreign_keys_exist_on_mariadb(): void
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
            $this->assertTrue(Schema::hasTable($table), "Expected {$table} on MariaDB.");
        }

        $this->assertForeignKey('community_posts', 'school_id', 'schools', 'RESTRICT');
        $this->assertForeignKey('community_posts', 'calendar_event_id', 'calendar_events', 'RESTRICT');
        $this->assertForeignKey('community_post_media', 'community_post_id', 'community_posts', 'CASCADE');
        $this->assertForeignKey('assessment_results', 'assessment_id', 'assessments', 'RESTRICT');
        $this->assertForeignKey('assessment_results', 'student_id', 'students', 'RESTRICT');
        $this->assertForeignKey('quizzes', 'revision_of_id', 'quizzes', 'RESTRICT');
        $this->assertForeignKey('quiz_assignment_recipients', 'quiz_assignment_id', 'quiz_assignments', 'CASCADE');
        $this->assertForeignKey('quiz_assignment_recipients', 'student_id', 'students', 'RESTRICT');
        $this->assertForeignKey('quiz_attempt_answers', 'quiz_option_id', 'quiz_options', 'RESTRICT');
    }

    public function test_materialized_scope_and_history_indexes_are_exact_on_mariadb(): void
    {
        $this->assertIndex(
            'community_post_audiences',
            'community_post_audience_unique',
            ['community_post_id', 'audience_key'],
            true,
        );
        $this->assertIndex(
            'assessment_results',
            'assessment_student_result_unique',
            ['assessment_id', 'student_id'],
            true,
        );
        $this->assertIndex(
            'quiz_assignment_recipients',
            'quiz_assignment_recipient_unique',
            ['quiz_assignment_id', 'student_id'],
            true,
        );
        $this->assertIndex(
            'quiz_attempts',
            'quiz_attempt_context_unique',
            ['student_id', 'attempt_context_key', 'attempt_number'],
            true,
        );
    }

    private function assertForeignKey(
        string $table,
        string $column,
        string $referencedTable,
        string $deleteRule,
    ): void {
        $foreignKey = DB::selectOne(
            <<<'SQL'
                SELECT kcu.REFERENCED_TABLE_NAME AS referenced_table,
                       rc.DELETE_RULE AS delete_rule
                FROM information_schema.KEY_COLUMN_USAGE kcu
                INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
                    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
                    AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
                  AND kcu.TABLE_NAME = ?
                  AND kcu.COLUMN_NAME = ?
                  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
                SQL,
            [$table, $column],
        );

        $this->assertNotNull($foreignKey, "Missing {$table}.{$column} foreign key.");
        $this->assertSame($referencedTable, $foreignKey->referenced_table);
        $this->assertSame($deleteRule, $foreignKey->delete_rule);
    }

    /** @param list<string> $expectedColumns */
    private function assertIndex(string $table, string $name, array $expectedColumns, bool $unique): void
    {
        $rows = DB::select(
            <<<'SQL'
                SELECT NON_UNIQUE AS non_unique,
                       SEQ_IN_INDEX AS sequence_number,
                       COLUMN_NAME AS column_name
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND INDEX_NAME = ?
                ORDER BY SEQ_IN_INDEX
                SQL,
            [$table, $name],
        );

        $this->assertNotEmpty($rows, "Missing {$table}.{$name} index.");
        $this->assertSame($expectedColumns, array_map(
            static fn (object $row): string => $row->column_name,
            $rows,
        ));
        $this->assertSame($unique ? 0 : 1, (int) $rows[0]->non_unique);
    }
}
