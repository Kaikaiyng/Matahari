<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CommunityModerationFoundationMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate:fresh', ['--force' => true])->assertExitCode(0);
    }

    public function test_moderation_schema_and_initial_policies_exist(): void
    {
        foreach ([
            'community_policy_versions',
            'community_policy_acceptances',
            'community_reports',
            'community_report_actions',
            'community_user_blocks',
            'community_user_restrictions',
            'community_appeals',
            'student_community_authorizations',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected {$table} to exist.");
        }

        $this->assertTrue(Schema::hasColumns('community_posts', [
            'tenant_id', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code',
        ]));
        $this->assertTrue(Schema::hasColumns('community_comments', [
            'tenant_id', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code',
        ]));
        $this->assertTrue(Schema::hasColumns('community_reports', [
            'source', 'target_snapshot', 'due_at', 'evidence_held_at', 'evidence_held_by_user_id',
        ]));

        $this->assertSame(
            ['child_safety', 'community_standards', 'privacy', 'terms'],
            DB::table('community_policy_versions')
                ->where('version', '2026-08-16')
                ->orderBy('policy_type')
                ->pluck('policy_type')
                ->all(),
        );
    }

    public function test_existing_content_is_backfilled_and_platform_permission_is_not_granted_to_school_admin(): void
    {
        $migration = require database_path('migrations/2026_08_16_000002_create_community_moderation_foundation.php');
        $migration->down();

        $superAdmin = Role::query()->create(['slug' => 'super-admin', 'name' => 'Super Admin']);
        $schoolAdmin = Role::query()->create(['slug' => 'school-admin', 'name' => 'School Admin']);
        $schoolAdmin->permissions()->attach(DB::table('permissions')->where('slug', 'community.moderate')->value('id'));
        $school = $this->createTenantSchool([
            'code' => 'LEGACY',
            'name' => 'Legacy School',
            'receipt_prefix' => 'LEG',
            'status' => 'active',
        ]);
        $author = User::factory()->create(['school_id' => $school->id]);
        $now = now();
        $postId = DB::table('community_posts')->insertGetId([
            'school_id' => $school->id,
            'author_user_id' => $author->id,
            'body' => 'Existing published post',
            'status' => 'published',
            'published_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $commentId = DB::table('community_comments')->insertGetId([
            'school_id' => $school->id,
            'community_post_id' => $postId,
            'user_id' => $author->id,
            'body' => 'Existing visible comment',
            'status' => 'visible',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $migration->up();

        $this->assertSame('published', DB::table('community_posts')->where('id', $postId)->value('status'));
        $this->assertSame($school->tenant_id, DB::table('community_posts')->where('id', $postId)->value('tenant_id'));
        $this->assertSame('visible', DB::table('community_comments')->where('id', $commentId)->value('status'));
        $this->assertSame($school->tenant_id, DB::table('community_comments')->where('id', $commentId)->value('tenant_id'));

        $this->assertTrue($superAdmin->fresh()->permissions()->where('slug', 'community.moderate_platform')->exists());
        $this->assertFalse($schoolAdmin->fresh()->permissions()->where('slug', 'community.moderate_platform')->exists());
        $this->assertTrue($schoolAdmin->fresh()->permissions()->where('slug', 'community.moderate')->exists());
    }

    public function test_moderation_migration_rolls_back_and_can_be_reapplied(): void
    {
        $migration = require database_path('migrations/2026_08_16_000002_create_community_moderation_foundation.php');

        $migration->down();

        $this->assertFalse(Schema::hasTable('community_reports'));
        $this->assertFalse(Schema::hasColumn('community_posts', 'tenant_id'));
        $this->assertFalse(DB::table('permissions')->where('slug', 'community.moderate_platform')->exists());

        $migration->up();

        $this->assertTrue(Schema::hasTable('community_reports'));
        $this->assertTrue(Schema::hasColumn('community_posts', 'tenant_id'));
        $this->assertTrue(DB::table('permissions')->where('slug', 'community.moderate_platform')->exists());
    }

    public function test_moderation_migration_can_be_retried_after_ddl_has_already_applied(): void
    {
        $migration = require database_path('migrations/2026_08_16_000002_create_community_moderation_foundation.php');

        $migration->up();

        $this->assertTrue(Schema::hasTable('community_reports'));
        $this->assertSame(4, DB::table('community_policy_versions')->where('version', '2026-08-16')->count());
        $this->assertSame(1, DB::table('permissions')->where('slug', 'community.moderate_platform')->count());
    }
}
