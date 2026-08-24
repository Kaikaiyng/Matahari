<?php

namespace Tests\Feature;

use App\Contracts\AuditLoggerContract;
use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityPostMedia;
use App\Models\CommunityReport;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
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

    public function test_user_can_accept_current_policies_and_only_their_acceptance_is_returned(): void
    {
        $parent = $this->user('rachel.wong');
        $terms = CommunityPolicyVersion::query()->where('policy_type', 'terms')->firstOrFail();

        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/policies/current')
            ->assertOk()->assertJsonPath('data.terms.accepted', false);
        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/policies/{$terms->id}/accept")
            ->assertCreated()->assertJsonPath('data.accepted', true);
        $this->actingAs($this->user('alyssa.tan'))->getJson('http://127.0.0.1/api/v1/community/policies/current')
            ->assertOk()->assertJsonPath('data.terms.accepted', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'community.policy_accepted']);
    }

    public function test_severe_post_report_is_transactionally_quarantined_with_evidence_hold(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');

        $response = $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post',
            'target_id' => $post->id,
            'reason_code' => 'child_safety',
            'details' => 'Please review urgently.',
        ])->assertCreated()->assertJsonPath('data.status', 'submitted');

        $reportId = $response->json('data.id');
        $this->assertSame(CommunityPost::STATUS_HIDDEN, $post->fresh()->status);
        $this->assertDatabaseHas('community_reports', ['id' => $reportId, 'priority' => 'severe']);
        $this->assertNotNull($response->json('data.due_at'));
        $this->assertNotNull($post->fresh()->hidden_at);
        $this->assertDatabaseHas('community_report_actions', ['community_report_id' => $reportId, 'action' => 'auto_quarantined']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.report_submitted', 'entity_id' => $reportId]);
    }

    public function test_severe_report_and_quarantine_roll_back_when_audit_persistence_fails(): void
    {
        $post = $this->publishedPost();
        $this->mock(AuditLoggerContract::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));

        $this->actingAs($this->user('rachel.wong'))->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'child_safety',
        ])->assertServerError();

        $this->assertDatabaseCount('community_reports', 0);
        $this->assertDatabaseCount('community_report_actions', 0);
        $this->assertSame(CommunityPost::STATUS_PUBLISHED, $post->fresh()->status);
        $this->assertNull($post->fresh()->hidden_at);
    }

    public function test_ordinary_report_stays_visible_and_duplicate_active_report_is_rejected(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');
        $payload = ['target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'spam'];

        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', $payload)->assertCreated();
        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('report');

        $this->assertSame(CommunityPost::STATUS_PUBLISHED, $post->fresh()->status);
    }

    public function test_visible_comment_and_user_can_be_reported_without_exposing_other_audiences(): void
    {
        $post = $this->publishedPost();
        $admin = $this->user('admin');
        $commentId = $this->actingAs($admin)->postJson("http://127.0.0.1/api/v1/community/posts/{$post->id}/comments", [
            'body' => 'Visible moderator comment',
        ])->assertCreated()->json('data.id');
        $parent = $this->user('rachel.wong');

        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'comment', 'target_id' => $commentId, 'reason_code' => 'spam',
        ])->assertCreated()->assertJsonPath('data.target_type', 'comment');
        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'user', 'target_id' => $admin->id, 'reason_code' => 'impersonation',
        ])->assertCreated()->assertJsonPath('data.target_type', 'user');

        $this->assertDatabaseCount('community_reports', 2);
    }

    public function test_feed_exposes_only_safe_report_and_block_capabilities(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');
        $admin = $this->user('admin');
        $commentId = $this->actingAs($admin)->postJson("http://127.0.0.1/api/v1/community/posts/{$post->id}/comments", [
            'body' => 'Visible moderator comment',
        ])->assertCreated()->json('data.id');

        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.can_report_content', true)
            ->assertJsonPath('data.0.can_report_user', true)
            ->assertJsonPath('data.0.comments.0.id', $commentId)
            ->assertJsonPath('data.0.comments.0.author_user_id', $admin->id)
            ->assertJsonPath('data.0.comments.0.can_report_content', true)
            ->assertJsonPath('data.0.comments.0.can_report_user', true);

        $this->actingAs($admin)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.can_report_content', false)
            ->assertJsonPath('data.0.can_report_user', false)
            ->assertJsonPath('data.0.comments.0.can_report_content', false)
            ->assertJsonPath('data.0.comments.0.can_report_user', false);
    }

    public function test_report_targets_require_current_audience_visibility_and_never_accept_client_scope(): void
    {
        $foreignPost = $this->foreignTenantPost();
        $parent = $this->user('rachel.wong');

        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post',
            'target_id' => $foreignPost->id,
            'reason_code' => 'spam',
            'tenant_id' => $foreignPost->tenant_id,
            'school_id' => $foreignPost->school_id,
        ])->assertForbidden();

        $this->assertDatabaseCount('community_reports', 0);
    }

    public function test_reporter_sees_only_safe_case_status_fields(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');
        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'spam',
        ])->assertCreated();

        $response = $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/reports/mine')
            ->assertOk()->assertJsonCount(1, 'data');

        $case = $response->json('data.0');
        $this->assertSame(['created_at', 'due_at', 'id', 'priority', 'reason_code', 'resolved_at', 'status', 'target_type'], array_keys($case));
        $this->actingAs($this->user('alyssa.tan'))->getJson('http://127.0.0.1/api/v1/community/reports/mine')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_report_rate_limit_is_enforced_per_reporter_and_school(): void
    {
        config()->set('community_safety.maximum_reports_per_hour', 1);
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');

        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'spam',
        ])->assertCreated();
        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/reports', [
            'target_type' => 'user', 'target_id' => $post->author_user_id, 'reason_code' => 'impersonation',
        ])->assertStatus(429);
    }

    public function test_block_hides_both_directions_of_community_content_and_unblock_restores_it(): void
    {
        $post = $this->publishedPost();
        $parent = $this->user('rachel.wong');
        $author = $post->author;
        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/posts/{$post->id}/reaction")
            ->assertOk()->assertJsonPath('data.reaction_count', 1);

        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/users/{$author->id}/block")
            ->assertCreated();
        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($author)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()->assertJsonPath('data.0.id', $post->id)->assertJsonPath('data.0.reaction_count', 0);
        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/blocked-users')
            ->assertOk()->assertJsonPath('data.0.user.id', $author->id);

        $this->actingAs($parent)->deleteJson("http://127.0.0.1/api/v1/community/users/{$author->id}/block")
            ->assertOk();
        $this->actingAs($parent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()->assertJsonPath('data.0.id', $post->id);
    }

    public function test_self_block_and_invisible_user_block_are_denied(): void
    {
        $parent = $this->user('rachel.wong');
        $foreign = $this->foreignTenantPost()->author;

        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/users/{$parent->id}/block")
            ->assertUnprocessable()->assertJsonValidationErrors('user');
        $this->actingAs($parent)->postJson("http://127.0.0.1/api/v1/community/users/{$foreign->id}/block")
            ->assertForbidden();
    }

    public function test_author_can_list_pending_content_but_quarantined_media_cannot_be_downloaded(): void
    {
        Storage::fake('local');
        $teacher = $this->user('teacher.lim');
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $post = CommunityPost::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'author_user_id' => $teacher->id,
            'post_type' => 'post',
            'body' => 'Historical pending class note',
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
        $media = CommunityPostMedia::query()->create([
            'school_id' => $teacher->school_id,
            'community_post_id' => $post->id,
            'media_type' => 'image',
            'storage_disk' => 'local',
            'storage_path' => 'community/pending-image.png',
            'mime_type' => 'image/png',
            'status' => 'quarantined',
        ]);
        CommunityReport::query()->create([
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
        $postId = $post->id;
        $mediaUrl = "/api/v1/community/media/{$media->id}";

        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/content/mine')
            ->assertOk()->assertJsonPath('data.0.id', $postId)->assertJsonPath('data.0.status', 'pending_review')
            ->assertJsonPath('data.0.report_id', fn ($value) => is_int($value));
        $this->actingAs($this->user('rachel.wong'))->getJson('http://127.0.0.1/api/v1/community/content/mine')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($teacher)->get($mediaUrl)->assertForbidden();
    }

    public function test_reviewed_guardian_can_authorize_and_revoke_linked_student_but_student_cannot_self_authorize(): void
    {
        $guardian = $this->user('rachel.wong');
        $studentUser = $this->user('alyssa.tan');
        $student = $studentUser->studentProfile;

        $this->actingAs($guardian)->postJson("http://127.0.0.1/api/v1/community/students/{$student->id}/authorization")
            ->assertCreated()->assertJsonPath('data.active', true);
        $this->actingAs($studentUser)->postJson("http://127.0.0.1/api/v1/community/students/{$student->id}/authorization")
            ->assertForbidden();
        $this->actingAs($guardian)->deleteJson("http://127.0.0.1/api/v1/community/students/{$student->id}/authorization")
            ->assertOk()->assertJsonPath('data.active', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'community.student_authorization_revoked']);
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }

    private function acceptRequiredPolicies(User $user): void
    {
        foreach (CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get() as $policy) {
            CommunityPolicyAcceptance::query()->firstOrCreate([
                'tenant_id' => $user->school->tenant_id,
                'school_id' => $user->school_id,
                'user_id' => $user->id,
                'community_policy_version_id' => $policy->id,
            ], ['accepted_at' => now()]);
        }
    }

    private function publishedPost(): CommunityPost
    {
        $admin = $this->user('admin');
        $this->acceptRequiredPolicies($admin);
        $post = CommunityPost::query()->create([
            'tenant_id' => $admin->school->tenant_id,
            'school_id' => $admin->school_id,
            'author_user_id' => $admin->id,
            'post_type' => 'post',
            'body' => 'Historical visible discussion post',
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

        return $post->load('author');
    }

    private function foreignTenantPost(): CommunityPost
    {
        $school = $this->createTenantSchool(['code' => 'OTHER', 'name' => 'Other School', 'receipt_prefix' => 'OTH', 'status' => 'active']);
        TenantDomain::query()->create([
            'tenant_id' => $school->tenant_id, 'hostname' => 'other.app.example.test', 'surface' => 'app',
            'is_primary' => true, 'status' => 'active', 'verified_at' => now(),
        ]);
        TenantFeature::query()->create(['tenant_id' => $school->tenant_id, 'feature_key' => 'community', 'enabled' => true]);
        $author = User::factory()->create(['school_id' => $school->id, 'status' => 'active']);
        $role = Role::query()->where('slug', 'school-admin')->firstOrFail();
        $author->roles()->attach($role);
        $membership = TenantUserMembership::query()->create([
            'tenant_id' => $school->tenant_id, 'user_id' => $author->id, 'default_school_id' => $school->id,
            'access_all_schools' => false, 'status' => 'active',
        ]);
        $membership->schools()->attach($school->id, ['tenant_id' => $school->tenant_id]);
        $membership->roles()->attach($role);
        $post = CommunityPost::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'author_user_id' => $author->id,
            'post_type' => 'post', 'body' => 'Foreign post', 'status' => 'published', 'published_at' => now(),
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $school->id, 'community_post_id' => $post->id, 'audience_type' => 'school', 'audience_key' => 'school',
        ]);

        return $post->load('author');
    }
}
