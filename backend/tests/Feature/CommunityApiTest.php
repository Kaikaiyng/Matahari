<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityReport;
use App\Models\Guardian;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentCommunityAuthorization;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\TenantUserMembership;
use App\Models\User;
use App\Services\Community\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use RuntimeException;
use Tests\TestCase;

class CommunityApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1']);

        $policies = CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get();
        foreach (User::query()->get() as $user) {
            foreach ($policies as $policy) {
                CommunityPolicyAcceptance::query()->create([
                    'tenant_id' => $user->school->tenant_id,
                    'school_id' => $user->school_id,
                    'user_id' => $user->id,
                    'community_policy_version_id' => $policy->id,
                    'accepted_at' => now(),
                ]);
            }
        }

        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $guardian = User::query()->where('username', 'rachel.wong')->firstOrFail();
        StudentCommunityAuthorization::query()->create([
            'tenant_id' => $student->school->tenant_id,
            'school_id' => $student->school_id,
            'student_user_id' => $student->id,
            'authorized_by_user_id' => $guardian->id,
            'capability' => StudentCommunityAuthorization::CAPABILITY_FREEFORM_INTERACTION,
            'effective_at' => now(),
        ]);
    }

    public function test_teacher_publishes_only_to_an_assigned_class_and_linked_portal_users_can_interact(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $created = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Today we measured shadows.', 'comments_enabled' => true,
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->assertJsonPath('data.status', 'pending_review');

        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_submitted', 'entity_id' => $created->json('data.id')]);

        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $postId = $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Today we measured shadows.', 'comments_enabled' => true,
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');

        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->getJson('http://127.0.0.1/api/v1/community/posts')->assertOk()->assertJsonPath('data.0.id', $postId);
        }

        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/reaction")->assertOk()->assertJsonPath('data.reacted', true);
        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/comments", ['body' => 'That was fun.'])->assertCreated()->assertJsonPath('data.status', 'pending_review');
        $this->assertDatabaseHas('community_comments', ['community_post_id' => $postId, 'body' => 'That was fun.', 'status' => 'pending_review']);
    }

    public function test_teacher_cannot_publish_to_an_unrelated_class_or_the_whole_school(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $unrelated = SchoolClass::query()->where('name', 'MC1')->firstOrFail();
        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'class', 'class_id' => $unrelated->id]]])->assertForbidden();
        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'school']]])->assertForbidden();
        $this->assertDatabaseCount('community_posts', 0);
    }

    public function test_parent_and_student_cannot_publish(): void
    {
        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'school']]])->assertForbidden();
        }
    }

    public function test_school_admin_can_publish_school_wide(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'School notice', 'audiences' => [['type' => 'school']]])->assertCreated();
        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())->getJson('http://127.0.0.1/api/v1/community/posts')->assertJsonPath('data.0.body', 'School notice');
    }

    public function test_historical_direct_student_posts_remain_visible_after_class_visibility_delegation(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();

        app(CommunityService::class)->publish($admin->school_id, [
            'body' => 'Historical direct student notice',
            'audiences' => [['type' => 'student', 'student_id' => $student->studentProfile->id]],
        ], $admin, app(AuditContextFactory::class)->system());

        $this->actingAs($student)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Historical direct student notice');
    }

    #[TestDox('publishing context and audience preview resolve unique active class recipients')]
    public function test_publishing_context_and_audience_preview_resolve_unique_active_class_recipients(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $classA = SchoolClass::query()->where('school_id', $school->id)->where('name', 'MB1')->firstOrFail();
        $classB = SchoolClass::query()->where('school_id', $school->id)->where('name', 'MC1')->firstOrFail();
        $emptyClass = SchoolClass::query()->where('school_id', $school->id)->where('name', 'MA1')->firstOrFail();
        $year = AcademicYear::query()->where('school_id', $school->id)->where('current_slot', 1)->firstOrFail();
        $subject = Subject::query()->where('school_id', $school->id)->firstOrFail();

        TenantUserMembership::query()
            ->where('tenant_id', $school->tenant_id)
            ->whereIn('user_id', User::query()->whereIn('username', ['finance', 'superadmin'])->pluck('id'))
            ->update(['status' => 'inactive']);

        $classBStudentUser = $this->createAudienceMember($school, 'student', 'audience.class-b.student');
        $classBStudent = Student::query()->where('school_id', $school->id)->where('student_no', 'MIS-2026-002')->firstOrFail();
        $classBStudent->update(['user_id' => $classBStudentUser->id]);
        ClassEnrolment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $classB->id,
            'student_id' => $classBStudent->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        $classBTeacher = $this->createAudienceMember($school, 'teacher', 'audience.class-b.teacher');
        TeachingAssignment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $classB->id,
            'subject_id' => $subject->id,
            'teacher_user_id' => $classBTeacher->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        $inactiveStudentUser = $this->createAudienceMember($school, 'student', 'audience.inactive.student', 'inactive');
        $inactiveStudent = Student::query()->create([
            'school_id' => $school->id,
            'user_id' => $inactiveStudentUser->id,
            'student_no' => 'MIS-AUDIENCE-INACTIVE',
            'full_name' => 'Inactive Audience Student',
            'status' => 'active',
        ]);
        ClassEnrolment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $classA->id,
            'student_id' => $inactiveStudent->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);

        $unrelatedParent = $this->createAudienceMember($school, 'parent', 'audience.unrelated.parent');
        Guardian::query()->create([
            'school_id' => $school->id,
            'user_id' => $unrelatedParent->id,
            'full_name' => 'Unrelated Audience Parent',
            'phone' => '+60 12-999 0000',
        ]);

        $context = $this->actingAs($publisher)
            ->getJson('http://127.0.0.1/api/v1/community/publishing-context')
            ->assertOk()
            ->json('data');
        $this->assertSame(6, $context['max_images']);
        $this->assertTrue($context['notify_default']);
        $contextClassIds = collect($context['classes'])->pluck('id')->all();
        $this->assertContains($emptyClass->id, $contextClassIds);
        $this->assertContains($classA->id, $contextClassIds);
        $this->assertContains($classB->id, $contextClassIds);

        $preview = $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [
                ['type' => 'class', 'class_id' => $classA->id],
                ['type' => 'class', 'class_id' => $classB->id],
            ],
        ])->assertOk()->json('data');

        $this->assertSame([$classA->id, $classB->id], $preview['class_ids']);
        $this->assertSame(5, $preview['recipient_count']);
        $this->assertSame('2 classes', $preview['audience_label']);

        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'class', 'class_id' => $emptyClass->id]],
        ])->assertOk()->assertJsonPath('data.recipient_count', 0);
    }

    #[TestDox('audience preview rejects mixed duplicate inactive and cross school classes')]
    public function test_audience_preview_rejects_mixed_duplicate_inactive_and_cross_school_classes(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $class = SchoolClass::query()->where('school_id', $school->id)->where('name', 'MB1')->firstOrFail();
        $inactiveClass = SchoolClass::query()->create(['school_id' => $school->id, 'name' => 'Inactive audience class', 'status' => 'inactive']);
        $otherSchool = School::query()->create([
            'tenant_id' => $school->tenant_id,
            'code' => 'MIS-OTHER',
            'name' => 'Other MIS Campus',
            'receipt_prefix' => 'MIO',
            'invoice_prefix' => 'MIO-INV',
            'email' => 'other@example.test',
            'phone' => '+60 3-0000 0001',
            'address' => 'Other campus',
            'status' => 'active',
        ]);
        $crossSchoolClass = SchoolClass::query()->create(['school_id' => $otherSchool->id, 'name' => 'Other class', 'status' => 'active']);

        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'school'], ['type' => 'class', 'class_id' => $class->id]],
        ])->assertUnprocessable();
        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'class', 'class_id' => $class->id], ['type' => 'class', 'class_id' => $class->id]],
        ])->assertUnprocessable();
        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'class', 'class_id' => $inactiveClass->id]],
        ])->assertUnprocessable();
        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'class', 'class_id' => $crossSchoolClass->id]],
        ])->assertUnprocessable();
    }

    #[TestDox('audience preview requires community publish permission')]
    public function test_audience_preview_requires_community_publish_permission(): void
    {
        $parent = User::query()->where('username', 'rachel.wong')->firstOrFail();

        $this->actingAs($parent)->postJson('http://127.0.0.1/api/v1/community/audience-preview', [
            'audiences' => [['type' => 'school']],
        ])->assertForbidden();
    }

    #[DataProvider('publishingAudienceEndpointCases')]
    public function test_publishing_audience_endpoint_is_available(string $method, string $uri, array $payload): void
    {
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $response = $this->actingAs($publisher)->json($method, 'http://127.0.0.1'.$uri, $payload);

        $response->assertOk();
    }

    public static function publishingAudienceEndpointCases(): array
    {
        return [
            'publishing context' => ['GET', '/api/v1/community/publishing-context', []],
            'audience preview' => ['POST', '/api/v1/community/audience-preview', ['audiences' => [['type' => 'school']]]],
        ];
    }

    public function test_private_media_is_stored_and_downloaded_only_through_an_authorized_post(): void
    {
        Storage::fake('local');
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $created = $this->actingAs($publisher)->post('http://127.0.0.1/api/v1/community/posts', [
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
        $postId = $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'Notice', 'audiences' => [['type' => 'school']]])->json('data.id');
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $commentId = $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/comments", ['body' => 'Thanks'])->json('data.id');
        $this->actingAs($student)->deleteJson("http://127.0.0.1/api/v1/community/comments/{$commentId}")->assertOk();
        $this->assertDatabaseHas('community_comments', ['id' => $commentId, 'status' => 'removed']);

        $this->actingAs($admin)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/hide", ['reason' => 'Posted in error.'])->assertOk();
        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => 'hidden', 'moderation_reason' => 'Posted in error.']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_hidden', 'entity_id' => $postId]);
    }

    public function test_post_persistence_rolls_back_when_audit_fails(): void
    {
        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced audit failure.');
            }
        });
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();

        try {
            app(CommunityService::class)->publish($teacher->school_id, ['body' => 'Rollback', 'audiences' => [['type' => 'class', 'class_id' => $class->id]]], $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Audit failure should escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseCount('community_posts', 0);
        $this->assertDatabaseCount('community_post_audiences', 0);
    }

    public function test_author_can_update_own_post_and_non_author_is_forbidden(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $otherUser = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();

        $created = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Original text',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated();

        $postId = $created->json('data.id');

        $this->actingAs($otherUser)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'body' => 'Hacked text',
        ])->assertForbidden();

        $this->actingAs($teacher)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'body' => 'Updated teacher post text',
            'comments_enabled' => false,
        ])->assertOk()
            ->assertJsonPath('data.body', 'Updated teacher post text')
            ->assertJsonPath('data.comments_enabled', false);

        $this->assertDatabaseHas('community_posts', [
            'id' => $postId,
            'body' => 'Updated teacher post text',
            'comments_enabled' => false,
        ]);
    }

    public function test_non_moderator_edit_of_published_post_returns_to_review(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Approved original',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');

        CommunityPost::query()->whereKey($postId)->update(['status' => CommunityPost::STATUS_PUBLISHED, 'published_at' => now()]);
        CommunityReport::query()->where('community_post_id', $postId)->update(['status' => CommunityReport::STATUS_RESOLVED, 'resolved_at' => now(), 'resolution_code' => 'approved']);

        $this->actingAs($teacher)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'body' => 'Materially changed text',
        ])->assertOk()->assertJsonPath('data.status', CommunityPost::STATUS_PENDING_REVIEW);

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => CommunityPost::STATUS_PENDING_REVIEW]);
        $this->assertDatabaseHas('community_reports', ['community_post_id' => $postId, 'source' => 'submission', 'status' => CommunityReport::STATUS_SUBMITTED]);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $postId, 'action' => 'community.post_updated']);
    }

    public function test_author_delete_is_logical_and_preserves_moderation_history(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Withdraw this submission',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        $reportId = CommunityReport::query()->where('community_post_id', $postId)->value('id');

        $this->actingAs($teacher)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$postId}")->assertOk();

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => CommunityPost::STATUS_DELETED]);
        $this->assertDatabaseHas('community_reports', ['id' => $reportId, 'community_post_id' => $postId]);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $postId, 'action' => 'community.post_deleted']);
        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/posts')->assertJsonMissing(['id' => $postId]);
        $this->actingAs($teacher)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", ['body' => 'Restore it'])->assertConflict();
    }

    public function test_post_update_rolls_back_when_audit_fails(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Keep this original',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        $post = CommunityPost::query()->findOrFail($postId);

        $this->app->bind(AuditLoggerContract::class, fn () => new class implements AuditLoggerContract
        {
            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                throw new RuntimeException('Forced update audit failure.');
            }
        });

        try {
            app(CommunityService::class)->updatePost($teacher->school_id, $post, ['body' => 'Must roll back'], $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Audit failure should escape the update transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced update audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'body' => 'Keep this original']);
    }

    private function createAudienceMember(School $school, string $roleSlug, string $username, string $membershipStatus = 'active'): User
    {
        $user = User::query()->create([
            'school_id' => $school->id,
            'name' => str($username)->replace('.', ' ')->title(),
            'username' => $username,
            'password' => 'password',
            'status' => 'active',
        ]);
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user->roles()->sync([$role->id]);

        $membership = TenantUserMembership::query()->create([
            'tenant_id' => $school->tenant_id,
            'user_id' => $user->id,
            'default_school_id' => $school->id,
            'status' => $membershipStatus,
        ]);
        $membership->schools()->attach($school->id, ['tenant_id' => $school->tenant_id]);
        $membership->roles()->attach($role->id);

        return $user;
    }
}
