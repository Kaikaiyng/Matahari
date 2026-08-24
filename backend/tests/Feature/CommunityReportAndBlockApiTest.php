<?php

namespace Tests\Feature;

use App\Contracts\AuditLoggerContract;
use App\Models\CommunityComment;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityReport;
use App\Models\CommunityUserBlock;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class CommunityReportAndBlockApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1']);
    }

    public function test_user_can_accept_current_policies(): void
    {
        $parent = $this->user('rachel.wong');
        $terms = CommunityPolicyVersion::query()->where('policy_type', 'terms')->firstOrFail();

        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/policies/{$terms->id}/accept")
            ->assertCreated()->assertJsonPath('data.accepted', true);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.policy_accepted']);
    }

    public function test_visible_post_can_be_reported_with_the_narrow_post_report_contract(): void
    {
        $post = $this->publishedPost();
        $student = $this->user('alyssa.tan');

        $this->actingAs($student)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'incorrect',
            'details' => 'The event date is outdated.',
        ])->assertCreated()->assertJsonPath('data.target_type', 'post')->assertJsonPath('data.reason_code', 'incorrect');

        foreach (['comment', 'user'] as $targetType) {
            $this->actingAs($student)->postJson('http://127.0.0.1/api/v1/community/reports', [
                'target_type' => $targetType, 'target_id' => $post->id, 'reason_code' => 'incorrect',
            ])->assertUnprocessable()->assertJsonValidationErrors('target_type');
        }
        $this->actingAs($student)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'spam',
        ])->assertUnprocessable()->assertJsonValidationErrors('reason_code');
    }

    public function test_hidden_invisible_and_cross_school_posts_cannot_be_reported(): void
    {
        $parent = $this->user('rachel.wong');
        $hidden = $this->publishedPost();
        $hidden->update(['status' => CommunityPost::STATUS_HIDDEN, 'hidden_at' => now()]);
        $invisible = $this->postForClass('MC1');
        $foreign = $this->foreignTenantPost();

        foreach ([$hidden, $invisible, $foreign] as $post) {
            $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
                'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'outdated',
            ])->assertForbidden();
        }
        $this->assertDatabaseCount('community_reports', 0);
    }

    public function test_report_creation_rolls_back_when_audit_persistence_fails(): void
    {
        $post = $this->publishedPost();
        $this->mock(AuditLoggerContract::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));

        $this->actingAs($this->user('rachel.wong'))->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'inappropriate',
        ])->assertServerError();

        $this->assertDatabaseCount('community_reports', 0);
        $this->assertDatabaseCount('community_report_actions', 0);
    }

    public function test_retired_social_safety_routes_are_not_found_and_history_is_preserved(): void
    {
        $parent = $this->user('rachel.wong');
        $student = $this->user('alyssa.tan');
        $post = $this->publishedPost();
        $comment = CommunityComment::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id, 'community_post_id' => $post->id,
            'user_id' => $post->author_user_id, 'body' => 'Historical comment', 'status' => 'visible',
        ]);
        $report = CommunityReport::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id, 'reporter_user_id' => $parent->id,
            'source' => 'user_report', 'target_type' => 'comment', 'community_post_id' => $post->id,
            'community_comment_id' => $comment->id, 'reported_user_id' => $post->author_user_id,
            'reason_code' => 'other', 'priority' => 'normal', 'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => ['comment' => ['id' => $comment->id]], 'due_at' => now()->addDay(),
        ]);

        $requests = [
            fn () => $this->actingAs($parent)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Reply']),
            fn () => $this->actingAs($parent)->deleteJson("/api/v1/community/comments/{$comment->id}"),
            fn () => $this->actingAs($parent)->postJson("/api/v1/community/users/{$post->author_user_id}/block"),
            fn () => $this->actingAs($parent)->deleteJson("/api/v1/community/users/{$post->author_user_id}/block"),
            fn () => $this->actingAs($parent)->getJson('/api/v1/community/blocked-users'),
            fn () => $this->actingAs($parent)->getJson('/api/v1/community/content/mine'),
            fn () => $this->actingAs($parent)->postJson('/api/v1/community/appeals', ['report_id' => $report->id, 'statement' => 'Historical appeal']),
            fn () => $this->actingAs($parent)->getJson('/api/v1/community/appeals/mine'),
            fn () => $this->actingAs($parent)->postJson("/api/v1/community/students/{$student->studentProfile->id}/authorization"),
            fn () => $this->actingAs($parent)->deleteJson("/api/v1/community/students/{$student->studentProfile->id}/authorization"),
        ];
        foreach ($requests as $request) {
            $request()->assertNotFound();
        }

        $this->assertDatabaseHas('community_comments', ['id' => $comment->id]);
        $this->assertDatabaseHas('community_reports', ['id' => $report->id, 'target_type' => 'comment']);
    }

    public function test_historical_blocks_are_audit_only_and_do_not_filter_active_school_updates(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');
        CommunityUserBlock::query()->create([
            'tenant_id' => $post->tenant_id, 'school_id' => $post->school_id,
            'blocker_user_id' => $parent->id, 'blocked_user_id' => $post->author_user_id, 'blocked_at' => now(),
        ]);

        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()->assertJsonPath('data.0.id', $post->id);
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }

    private function publishedPost(): CommunityPost
    {
        return $this->postForClass(null);
    }

    private function postForClass(?string $className): CommunityPost
    {
        $admin = $this->user('admin');
        $post = CommunityPost::query()->create([
            'tenant_id' => $admin->school->tenant_id, 'school_id' => $admin->school_id, 'author_user_id' => $admin->id,
            'post_type' => 'update', 'body' => 'Visible school update', 'comments_enabled' => false,
            'status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => now(),
        ]);
        $class = $className ? SchoolClass::query()->where('name', $className)->firstOrFail() : null;
        CommunityPostAudience::query()->create([
            'school_id' => $admin->school_id, 'community_post_id' => $post->id,
            'audience_type' => $class ? 'class' : 'school', 'class_id' => $class?->id,
            'audience_key' => $class ? "class:{$class->id}" : 'school',
        ]);

        return $post;
    }

    private function foreignTenantPost(): CommunityPost
    {
        $school = $this->createTenantSchool(['code' => 'OTHER', 'name' => 'Other School', 'receipt_prefix' => 'OTH', 'status' => 'active']);
        TenantDomain::query()->create(['tenant_id' => $school->tenant_id, 'hostname' => 'other.app.example.test', 'surface' => 'app', 'is_primary' => true, 'status' => 'active', 'verified_at' => now()]);
        TenantFeature::query()->create(['tenant_id' => $school->tenant_id, 'feature_key' => 'community', 'enabled' => true]);
        $author = User::factory()->create(['school_id' => $school->id, 'status' => 'active']);
        $role = Role::query()->where('slug', 'school-admin')->firstOrFail();
        $author->roles()->attach($role);
        $membership = TenantUserMembership::query()->create(['tenant_id' => $school->tenant_id, 'user_id' => $author->id, 'default_school_id' => $school->id, 'access_all_schools' => false, 'status' => 'active']);
        $membership->schools()->attach($school->id, ['tenant_id' => $school->tenant_id]);
        $membership->roles()->attach($role);
        $post = CommunityPost::query()->create(['tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'author_user_id' => $author->id, 'post_type' => 'update', 'body' => 'Foreign post', 'status' => 'published', 'published_at' => now()]);
        CommunityPostAudience::query()->create(['school_id' => $school->id, 'community_post_id' => $post->id, 'audience_type' => 'school', 'audience_key' => 'school']);

        return $post;
    }
}
