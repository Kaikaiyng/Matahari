<?php

namespace Tests\Feature;

use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityReport;
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

    public function test_school_post_reports_queue_contains_only_active_user_reported_posts_and_removes_content(): void
    {
        $post = $this->publishedPost();
        $case = CommunityReport::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id, 'reporter_user_id' => $this->user('rachel.wong')->id,
            'source' => 'user_report', 'target_type' => 'post', 'community_post_id' => $post->id,
            'reported_user_id' => $post->author_user_id, 'reason_code' => 'inappropriate', 'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED, 'target_snapshot' => ['post' => ['id' => $post->id]], 'due_at' => now()->addDay(),
        ]);
        $historical = CommunityReport::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id, 'reporter_user_id' => $post->author_user_id,
            'source' => 'submission', 'target_type' => 'post', 'community_post_id' => $post->id,
            'reported_user_id' => $post->author_user_id, 'reason_code' => 'other', 'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED, 'target_snapshot' => [], 'due_at' => now()->addDay(),
        ]);

        $this->actingAs($this->user('admin'))->getJson('http://localhost/api/v1/admin/community-moderation/reports')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $case->id);
        $this->actingAs($this->user('admin'))->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$case->id}/decision", [
            'decision' => 'remove_content', 'reason_code' => 'inappropriate', 'reason' => 'Removed after report review.',
        ])->assertOk()->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('community_posts', ['id' => $post->id, 'status' => CommunityPost::STATUS_HIDDEN]);
        $this->assertDatabaseHas('community_reports', ['id' => $case->id, 'resolution_code' => 'remove_content']);
        $this->assertDatabaseHas('community_reports', ['id' => $historical->id, 'source' => 'submission']);
    }

    public function test_retired_restriction_and_appeal_routes_are_not_found(): void
    {
        $admin = $this->user('admin');
        $parent = $this->user('rachel.wong');
        $historical = CommunityReport::query()->create([
            'tenant_id' => $admin->school->tenant_id, 'school_id' => $admin->school_id, 'reporter_user_id' => $admin->id,
            'source' => 'submission', 'target_type' => 'post', 'reported_user_id' => $admin->id, 'reason_code' => 'other',
            'priority' => 'normal', 'status' => CommunityReport::STATUS_SUBMITTED, 'target_snapshot' => [], 'due_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)->postJson("http://localhost/api/v1/admin/community-moderation/users/{$parent->id}/restrictions", [])->assertNotFound();
        $this->actingAs($admin)->deleteJson('/api/v1/admin/community-moderation/restrictions/1')->assertNotFound();
        $this->actingAs($admin)->postJson('/api/v1/admin/community-moderation/appeals/1/decision', [])->assertNotFound();
        $this->actingAs($admin)->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$historical->id}/decision", [])->assertNotFound();
        $this->assertDatabaseHas('community_reports', ['id' => $historical->id, 'source' => 'submission']);
    }

    public function test_no_action_records_the_decision_without_restoring_hidden_content(): void
    {
        $post = $this->publishedPost();
        $case = CommunityReport::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id, 'reporter_user_id' => $this->user('rachel.wong')->id,
            'source' => 'user_report', 'target_type' => 'post', 'community_post_id' => $post->id,
            'reported_user_id' => $post->author_user_id, 'reason_code' => 'outdated', 'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED, 'target_snapshot' => [], 'due_at' => now()->addDay(),
        ]);
        $post->update(['status' => CommunityPost::STATUS_HIDDEN, 'hidden_at' => now(), 'hidden_by_user_id' => $this->user('admin')->id]);

        $this->actingAs($this->user('admin'))->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$case->id}/decision", [
            'decision' => 'no_action', 'reason_code' => 'outdated', 'reason' => 'No further action on this report.',
        ])->assertOk()->assertJsonPath('data.resolution_code', 'no_action');

        $this->assertDatabaseHas('community_posts', ['id' => $post->id, 'status' => CommunityPost::STATUS_HIDDEN]);
    }

    private function publishedPost(): CommunityPost
    {
        $admin = $this->user('admin');
        $post = CommunityPost::query()->create([
            'tenant_id' => $admin->school->tenant_id, 'school_id' => $admin->school_id, 'author_user_id' => $admin->id,
            'post_type' => 'update', 'body' => 'Reported update', 'comments_enabled' => false,
            'status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => now(),
        ]);
        CommunityPostAudience::query()->create(['school_id' => $admin->school_id, 'community_post_id' => $post->id, 'audience_type' => 'school', 'audience_key' => 'school']);

        return $post;
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }
}
