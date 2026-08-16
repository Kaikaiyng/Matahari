<?php

namespace Tests\Feature;

use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\SchoolClass;
use App\Models\StudentCommunityAuthorization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CommunityPolicyGateApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1']);
    }

    public function test_contribution_requires_current_terms_and_community_standards_acceptance(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();

        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Class update',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertUnprocessable()->assertJsonValidationErrors('community_policy');

        $this->assertDatabaseCount('community_posts', 0);
    }

    public function test_non_moderator_text_and_media_remain_pending_and_quarantined(): void
    {
        Storage::fake('local');
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $this->acceptRequiredPolicies($teacher);

        $response = $this->actingAs($teacher)->withHeader('Accept', 'application/json')->post('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Class update',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'media' => [UploadedFile::fake()->create('class.pdf', 20, 'application/pdf')],
        ])->assertCreated()->assertJsonPath('data.status', 'pending_review');

        $postId = $response->json('data.id');
        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => 'pending_review', 'published_at' => null]);
        $this->assertDatabaseHas('community_post_media', ['community_post_id' => $postId, 'status' => 'quarantined']);
    }

    public function test_moderator_with_current_acceptance_can_publish_directly(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->acceptRequiredPolicies($admin);

        $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'School notice',
            'audiences' => [['type' => 'school']],
        ])->assertCreated()->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('community_posts', ['status' => 'published']);
    }

    public function test_student_freeform_comment_requires_active_adult_authorization(): void
    {
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $this->acceptRequiredPolicies($student);
        $postId = $this->publishedSchoolPost();

        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/comments", [
            'body' => 'Thank you',
        ])->assertUnprocessable()->assertJsonValidationErrors('community_policy');

        $this->assertDatabaseCount('community_comments', 0);
    }

    public function test_reviewed_guardian_authorization_allows_student_pending_comment_and_revocation_denies_it(): void
    {
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $guardian = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $this->acceptRequiredPolicies($student);
        $postId = $this->publishedSchoolPost();
        $authorization = StudentCommunityAuthorization::query()->create([
            'tenant_id' => $student->school->tenant_id,
            'school_id' => $student->school_id,
            'student_user_id' => $student->id,
            'authorized_by_user_id' => $guardian->id,
            'capability' => StudentCommunityAuthorization::CAPABILITY_FREEFORM_INTERACTION,
            'effective_at' => now(),
        ]);

        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/comments", [
            'body' => 'Thank you',
        ])->assertCreated()->assertJsonPath('data.status', 'pending_review');

        $authorization->update(['revoked_at' => now(), 'revoked_by_user_id' => $guardian->id]);

        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/comments", [
            'body' => 'Another comment',
        ])->assertUnprocessable()->assertJsonValidationErrors('community_policy');
    }

    public function test_prohibited_text_creates_no_content_or_media(): void
    {
        Storage::fake('local');
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $this->acceptRequiredPolicies($teacher);

        $this->actingAs($teacher)->withHeader('Accept', 'application/json')->post('http://127.0.0.1/api/v1/community/posts', [
            'body' => "b\u{200B}ully another student",
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'media' => [UploadedFile::fake()->create('unsafe.pdf', 20, 'application/pdf')],
        ])->assertUnprocessable()->assertJsonValidationErrors('body');

        $this->assertDatabaseCount('community_posts', 0);
        $this->assertDatabaseCount('community_post_media', 0);
        Storage::disk('local')->assertMissing('community');
    }

    private function acceptRequiredPolicies(User $user): void
    {
        foreach (CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get() as $policy) {
            CommunityPolicyAcceptance::query()->create([
                'tenant_id' => $user->school->tenant_id,
                'school_id' => $user->school_id,
                'user_id' => $user->id,
                'community_policy_version_id' => $policy->id,
                'accepted_at' => now(),
            ]);
        }
    }

    private function publishedSchoolPost(): int
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->acceptRequiredPolicies($admin);

        return (int) $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'School notice',
            'audiences' => [['type' => 'school']],
        ])->assertCreated()->json('data.id');
    }
}
