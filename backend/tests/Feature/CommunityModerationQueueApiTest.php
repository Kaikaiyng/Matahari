<?php

namespace Tests\Feature;

use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityPostMedia;
use App\Models\CommunityReport;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityModerationQueueApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_school_queue_approves_pending_submission_and_releases_media(): void
    {
        $submission = $this->pendingSubmission();
        $teacher = $submission['teacher'];
        $postId = $submission['post']->id;

        $queue = $this->actingAs($this->user('admin'))->getJson('http://localhost/api/v1/admin/community-moderation/reports')
            ->assertOk()->assertJsonPath('data.0.source', 'submission');
        $reportId = $queue->json('data.0.id');

        $this->actingAs($this->user('admin'))->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$reportId}/decision", [
            'decision' => 'approve', 'reason_code' => 'no_violation', 'reason' => 'Safe school update.',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => 'published']);
        $this->assertDatabaseHas('community_post_media', ['community_post_id' => $postId, 'status' => 'ready']);
        $this->assertDatabaseHas('portal_notifications', ['recipient_user_id' => $teacher->id, 'type' => 'community_moderation']);
    }

    public function test_decision_requires_reason_and_school_admin_cannot_open_other_school_case(): void
    {
        $reportId = $this->pendingSubmissionReportId();
        $admin = $this->user('admin');

        $this->actingAs($admin)->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$reportId}/decision", [
            'decision' => 'reject',
        ])->assertUnprocessable()->assertJsonValidationErrors(['reason_code', 'reason']);
        $this->actingAs($admin)->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$reportId}/decision", [
            'decision' => 'warn', 'reason_code' => 'other', 'reason' => 'A warning alone cannot resolve pending content.',
        ])->assertUnprocessable()->assertJsonValidationErrors('decision');

        $this->assertDatabaseHas('community_reports', ['id' => $reportId, 'status' => 'submitted']);
    }

    public function test_community_restriction_blocks_only_selected_community_scope(): void
    {
        $parent = $this->user('rachel.wong');
        $post = $this->publishedPost();
        $restriction = $this->actingAs($this->user('admin'))->postJson("http://localhost/api/v1/admin/community-moderation/users/{$parent->id}/restrictions", [
            'scope' => 'comment', 'reason_code' => 'bullying_harassment', 'reason' => 'Cooling-off period.',
            'ends_at' => now()->addDay()->toIso8601String(),
        ])->assertCreated()->json('data');

        $this->acceptPolicies($parent);
        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/posts/{$post->id}/comments", ['body' => 'Comment'])
            ->assertUnprocessable()->assertJsonValidationErrors('community_restriction');
        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/portal/parent/me')->assertOk();

        $this->actingAs($this->user('admin'))->deleteJson("http://localhost/api/v1/admin/community-moderation/restrictions/{$restriction['id']}")
            ->assertOk();
        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/posts/{$post->id}/comments", ['body' => 'Comment'])
            ->assertCreated();
    }

    public function test_school_admin_cannot_restrict_user_scoped_only_to_another_school_in_same_tenant(): void
    {
        $admin = $this->user('admin');
        $otherSchool = School::query()->create([
            'tenant_id' => $admin->school->tenant_id, 'code' => 'MIS2', 'name' => 'Second Campus',
            'receipt_prefix' => 'M2', 'status' => 'active',
        ]);
        $otherUser = User::factory()->create(['school_id' => $otherSchool->id, 'status' => 'active']);
        $membership = TenantUserMembership::query()->create([
            'tenant_id' => $otherSchool->tenant_id, 'user_id' => $otherUser->id,
            'default_school_id' => $otherSchool->id, 'access_all_schools' => false, 'status' => 'active',
        ]);
        $membership->schools()->attach($otherSchool->id, ['tenant_id' => $otherSchool->tenant_id]);

        $this->actingAs($admin)->postJson("http://localhost/api/v1/admin/community-moderation/users/{$otherUser->id}/restrictions", [
            'scope' => 'comment', 'reason_code' => 'spam', 'reason' => 'Must not cross school scope.',
        ])->assertForbidden();

        $this->assertDatabaseCount('community_user_restrictions', 0);
    }

    public function test_platform_summary_and_severe_detail_require_platform_permission_and_log_access(): void
    {
        $post = $this->publishedPost();
        $this->actingAs($this->user('rachel.wong'))->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'child_safety',
        ])->assertCreated();
        $reportId = (int) $this->app['db']->table('community_reports')->value('id');

        $super = $this->user('superadmin');
        $this->actingAs($super)->getJson('http://localhost/api/v1/platform/community-moderation/summary')
            ->assertOk()->assertJsonPath('data.severe_open', 1)
            ->assertJsonPath('data.severe_cases.0.id', $reportId)
            ->assertJsonPath('data.severe_cases.0.tenant_id', $post->tenant_id);
        $this->actingAs($super)->getJson("http://localhost/api/v1/platform/community-moderation/reports/{$reportId}")
            ->assertOk()->assertJsonPath('data.id', $reportId);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.platform_case_viewed', 'entity_id' => $reportId]);
        $this->actingAs($super)->postJson("http://localhost/api/v1/platform/community-moderation/reports/{$reportId}/decision", [
            'decision' => 'no_violation', 'reason_code' => 'no_violation', 'reason' => 'Platform review found no violation.',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');

        $this->actingAs($this->user('admin'))->getJson('http://localhost/api/v1/platform/community-moderation/summary')->assertForbidden();
    }

    private function pendingSubmissionReportId(): int
    {
        return $this->pendingSubmission()['report']->id;
    }

    private function publishedPost(): CommunityPost
    {
        $admin = $this->user('admin');
        $post = CommunityPost::query()->create([
            'tenant_id' => $admin->school->tenant_id,
            'school_id' => $admin->school_id,
            'author_user_id' => $admin->id,
            'post_type' => 'post',
            'body' => 'Historical school discussion',
            'comments_enabled' => true,
            'status' => CommunityPost::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $admin->school_id,
            'community_post_id' => $post->id,
            'audience_type' => 'school',
            'audience_key' => 'school',
        ]);

        return $post;
    }

    /** @return array{teacher: User, post: CommunityPost, report: CommunityReport} */
    private function pendingSubmission(): array
    {
        $teacher = $this->user('teacher.lim');
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $post = CommunityPost::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'author_user_id' => $teacher->id,
            'post_type' => 'post',
            'body' => 'Historical pending submission',
            'comments_enabled' => true,
            'status' => CommunityPost::STATUS_PENDING_REVIEW,
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $teacher->school_id,
            'community_post_id' => $post->id,
            'audience_type' => 'class',
            'class_id' => $class->id,
            'audience_key' => "class:{$class->id}",
        ]);
        CommunityPostMedia::query()->create([
            'school_id' => $teacher->school_id,
            'community_post_id' => $post->id,
            'media_type' => 'image',
            'storage_disk' => 'local',
            'storage_path' => 'community/historical-pending.png',
            'mime_type' => 'image/png',
            'status' => 'quarantined',
        ]);
        $report = CommunityReport::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'reporter_user_id' => $teacher->id,
            'source' => 'submission',
            'target_type' => 'post',
            'community_post_id' => $post->id,
            'reported_user_id' => $teacher->id,
            'reason_code' => 'other',
            'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => [],
            'due_at' => now()->addDay(),
        ]);

        return compact('teacher', 'post', 'report');
    }

    private function acceptPolicies(User $user): void
    {
        foreach (CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get() as $policy) {
            CommunityPolicyAcceptance::query()->firstOrCreate([
                'tenant_id' => $user->school->tenant_id, 'school_id' => $user->school_id,
                'user_id' => $user->id, 'community_policy_version_id' => $policy->id,
            ], ['accepted_at' => now()]);
        }
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }
}
