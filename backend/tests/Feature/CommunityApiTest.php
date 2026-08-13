<?php

namespace Tests\Feature;

use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CommunityApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_teacher_publishes_only_to_an_assigned_class_and_linked_portal_users_can_interact(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $created = $this->actingAs($teacher)->postJson('/api/v1/community/posts', [
            'body' => 'Today we measured shadows.', 'comments_enabled' => true,
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->assertJsonPath('data.body', 'Today we measured shadows.');
        $postId = $created->json('data.id');

        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_published', 'entity_id' => $postId]);

        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->getJson('/api/v1/community/posts')->assertOk()->assertJsonPath('data.0.id', $postId);
        }

        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $this->actingAs($student)->postJson("/api/v1/community/posts/{$postId}/reaction")->assertOk()->assertJsonPath('data.reacted', true);
        $this->actingAs($student)->postJson("/api/v1/community/posts/{$postId}/comments", ['body' => 'That was fun.'])->assertCreated();
        $this->assertDatabaseHas('community_comments', ['community_post_id' => $postId, 'body' => 'That was fun.']);
    }

    public function test_teacher_cannot_publish_to_an_unrelated_class_or_the_whole_school(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $unrelated = SchoolClass::query()->where('name', 'MC1')->firstOrFail();
        $this->actingAs($teacher)->postJson('/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'class', 'class_id' => $unrelated->id]]])->assertForbidden();
        $this->actingAs($teacher)->postJson('/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'school']]])->assertForbidden();
        $this->assertDatabaseCount('community_posts', 0);
    }

    public function test_parent_and_student_cannot_publish(): void
    {
        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->postJson('/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'school']]])->assertForbidden();
        }
    }

    public function test_school_admin_can_publish_school_wide(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->actingAs($admin)->postJson('/api/v1/community/posts', ['body' => 'School notice', 'audiences' => [['type' => 'school']]])->assertCreated();
        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())->getJson('/api/v1/community/posts')->assertJsonPath('data.0.body', 'School notice');
    }

    public function test_private_media_is_stored_and_downloaded_only_through_an_authorized_post(): void
    {
        Storage::fake('local');
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $created = $this->actingAs($teacher)->post('/api/v1/community/posts', [
            'body' => 'Class photo', 'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'media' => [UploadedFile::fake()->create('lesson.pdf', 10, 'application/pdf')],
        ])->assertCreated();
        $media = $created->json('data.media.0');
        $this->assertNotNull($media);
        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())
            ->get($media['url'])->assertOk();
    }

    public function test_comment_owner_can_remove_it_and_school_admin_can_hide_a_post_with_a_reason(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $postId = $this->actingAs($admin)->postJson('/api/v1/community/posts', ['body' => 'Notice', 'audiences' => [['type' => 'school']]])->json('data.id');
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $commentId = $this->actingAs($student)->postJson("/api/v1/community/posts/{$postId}/comments", ['body' => 'Thanks'])->json('data.id');
        $this->actingAs($student)->deleteJson("/api/v1/community/comments/{$commentId}")->assertOk();
        $this->assertDatabaseHas('community_comments', ['id' => $commentId, 'status' => 'removed']);

        $this->actingAs($admin)->postJson("/api/v1/community/posts/{$postId}/hide", ['reason' => 'Posted in error.'])->assertOk();
        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => 'hidden', 'moderation_reason' => 'Posted in error.']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_hidden', 'entity_id' => $postId]);
    }
}
