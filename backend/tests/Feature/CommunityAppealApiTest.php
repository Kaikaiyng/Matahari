<?php

namespace Tests\Feature;

use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityReport;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityAppealApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_one_appeal_is_allowed_and_a_different_moderator_must_decide_it(): void
    {
        $teacher = $this->user('teacher.lim');
        $this->acceptPolicies($teacher);
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $post = CommunityPost::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'author_user_id' => $teacher->id,
            'post_type' => 'post',
            'body' => 'Historical pending update',
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
        $reportId = $report->id;

        $originalModerator = $this->user('admin');
        $this->actingAs($originalModerator)->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$reportId}/decision", [
            'decision' => 'reject', 'reason_code' => 'other', 'reason' => 'Not suitable for the Community feed.',
        ])->assertOk();

        $appeal = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/appeals', [
            'report_id' => $reportId, 'statement' => 'Please reconsider this school update.',
        ])->assertCreated()->json('data');
        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/appeals', [
            'report_id' => $reportId, 'statement' => 'Second appeal.',
        ])->assertUnprocessable()->assertJsonValidationErrors('appeal');

        $this->actingAs($originalModerator)->getJson("http://localhost/api/v1/admin/community-moderation/reports/{$reportId}")
            ->assertOk()->assertJsonPath('data.appeals.0.id', $appeal['id'])
            ->assertJsonPath('data.appeals.0.source_moderator_user_id', $originalModerator->id);
        $this->actingAs($originalModerator)->getJson('http://localhost/api/v1/admin/community-moderation/reports')
            ->assertOk()->assertJsonPath('data.0.id', $reportId)
            ->assertJsonPath('data.0.has_pending_appeal', true);

        $this->actingAs($originalModerator)->postJson("http://localhost/api/v1/admin/community-moderation/appeals/{$appeal['id']}/decision", [
            'decision' => 'upheld', 'reason' => 'Reviewed evidence.',
        ])->assertUnprocessable()->assertJsonValidationErrors('reviewer');

        $this->actingAs($this->user('superadmin'))->postJson("http://localhost/api/v1/admin/community-moderation/appeals/{$appeal['id']}/decision", [
            'decision' => 'overturned', 'reason' => 'The content is suitable.',
        ])->assertOk()->assertJsonPath('data.status', 'decided');
        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/appeals/mine')
            ->assertOk()->assertJsonPath('data.0.decision', 'overturned');
    }

    private function acceptPolicies(User $user): void
    {
        foreach (CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get() as $policy) {
            CommunityPolicyAcceptance::query()->create([
                'tenant_id' => $user->school->tenant_id, 'school_id' => $user->school_id,
                'user_id' => $user->id, 'community_policy_version_id' => $policy->id, 'accepted_at' => now(),
            ]);
        }
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }
}
