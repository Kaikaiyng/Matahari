<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassEnrolment;
use App\Models\CommunityComment;
use App\Models\CommunityPolicyAcceptance;
use App\Models\CommunityPolicyVersion;
use App\Models\CommunityPost;
use App\Models\CommunityPostAudience;
use App\Models\CommunityReport;
use App\Models\CommunityUserRestriction;
use App\Models\Guardian;
use App\Models\Permission;
use App\Models\PortalNotification;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentCommunityAuthorization;
use App\Models\StudentParentLink;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\TenantUserMembership;
use App\Models\User;
use App\Models\UserPermissionOverride;
use App\Services\Community\CommunityService;
use App\Services\Community\SchoolUpdateAudienceResolver;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Events\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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

    public function test_teacher_publishes_an_immediate_class_update_without_comments_and_notifies_each_recipient_once(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $created = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Today we measured shadows.', 'comments_enabled' => true,
            'notify_audience' => true,
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.comments_enabled', false)
            ->assertJsonPath('data.can_withdraw', true);

        $postId = $created->json('data.id');
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_published', 'entity_id' => $postId]);
        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'comments_enabled' => false]);
        $notifications = PortalNotification::query()->where('type', 'school_update')->where('context_json->post_id', $postId)->get();
        $this->assertNotEmpty($notifications);
        $this->assertSame($notifications->count(), $notifications->pluck('recipient_user_id')->unique()->count());
        $this->assertFalse($notifications->contains('recipient_user_id', $teacher->id));
        $audit = AuditLog::query()->where('action', 'community.post_published')->where('entity_id', $postId)->sole();
        $this->assertSame($notifications->count(), $audit->new_values['recipient_count']);
        $this->assertSame(["class:{$class->id}"], $audit->new_values['audiences']);

        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $adminPostId = $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Today we measured shadows.', 'comments_enabled' => true,
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');

        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->getJson('http://127.0.0.1/api/v1/community/posts')->assertOk()->assertJsonFragment(['id' => $adminPostId]);
        }

        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.comments', [])
            ->assertJsonPath('data.0.can_report_content', false)
            ->assertJsonPath('data.0.can_report_user', false);

        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $student->roles()->firstOrFail()->permissions()->detach(
            Permission::query()->where('slug', 'community.interact')->valueOrFail('id'),
        );
        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$adminPostId}/reaction")->assertOk()->assertJsonPath('data.reacted', true);
        $this->actingAs($student)->postJson("http://127.0.0.1/api/v1/community/posts/{$adminPostId}/comments", ['body' => 'That was fun.'])->assertNotFound();
    }

    public function test_teacher_with_publish_ability_can_publish_to_any_active_same_school_class_and_the_whole_school(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $unrelated = SchoolClass::query()->where('name', 'MC1')->firstOrFail();
        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'All-class notice',
            'audiences' => [['type' => 'class', 'class_id' => $unrelated->id]],
        ])->assertCreated();
        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Whole-school notice',
            'audiences' => [['type' => 'school']],
        ])->assertCreated();
        $this->assertDatabaseCount('community_posts', 2);
    }

    public function test_teacher_without_publish_ability_cannot_publish(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        UserPermissionOverride::query()->create([
            'school_id' => $teacher->school_id,
            'user_id' => $teacher->id,
            'permission_id' => Permission::query()->where('slug', 'community.publish')->valueOrFail('id'),
            'allowed' => false,
            'reason' => 'Publishing duty was removed.',
            'updated_by' => User::query()->where('username', 'admin')->valueOrFail('id'),
        ]);

        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Not authorized',
            'audiences' => [['type' => 'school']],
        ])->assertForbidden();
        $this->assertDatabaseCount('community_posts', 0);
    }

    public function test_parent_and_student_cannot_publish(): void
    {
        foreach (['rachel.wong', 'alyssa.tan'] as $username) {
            $user = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($user)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'No', 'audiences' => [['type' => 'school']]])->assertForbidden();
        }
    }

    public function test_school_admin_and_finance_can_publish_school_wide(): void
    {
        foreach (['admin', 'finance'] as $username) {
            $publisher = User::query()->where('username', $username)->firstOrFail();
            $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => "School notice from {$username}", 'audiences' => [['type' => 'school']]])
                ->assertCreated()->assertJsonPath('data.status', CommunityPost::STATUS_PUBLISHED);
        }

        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())->getJson('http://127.0.0.1/api/v1/community/posts')->assertJsonFragment(['body' => 'School notice from finance']);
    }

    public function test_school_admin_and_finance_publish_overrides_allow_school_updates_without_moderation(): void
    {
        $moderatePermission = Permission::query()->where('slug', 'community.moderate')->firstOrFail();

        foreach (['admin', 'finance'] as $username) {
            $publisher = User::query()->where('username', $username)->firstOrFail();
            UserPermissionOverride::query()->create([
                'school_id' => $publisher->school_id,
                'user_id' => $publisher->id,
                'permission_id' => $moderatePermission->id,
                'allowed' => false,
                'reason' => 'Publishing does not require moderation.',
                'updated_by' => $publisher->id,
            ]);

            $this->assertTrue($publisher->hasPermissionTo('community.publish'));
            $this->assertFalse($publisher->hasPermissionTo('community.moderate'));
            $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/posts', [
                'body' => "Publish-only {$username} update",
                'audiences' => [['type' => 'school']],
            ])->assertCreated()->assertJsonPath('data.status', CommunityPost::STATUS_PUBLISHED);
        }
    }

    public function test_selected_school_publish_denial_cannot_be_bypassed_by_the_default_school_permission(): void
    {
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $otherSchool = School::query()->create([
            'tenant_id' => $publisher->school->tenant_id,
            'code' => 'MIS2',
            'name' => 'Second Campus',
            'receipt_prefix' => 'MIS2',
            'invoice_prefix' => 'MIS2-INV',
            'email' => 'second-campus@example.test',
            'phone' => '+60 3-0000 0002',
            'address' => 'Second campus',
            'status' => 'active',
        ]);
        $publisher->tenantMembership($publisher->school->tenant_id)->schools()->attach($otherSchool->id, ['tenant_id' => $otherSchool->tenant_id]);
        foreach (CommunityPolicyVersion::query()->whereIn('policy_type', ['terms', 'community_standards'])->get() as $policy) {
            CommunityPolicyAcceptance::query()->create([
                'tenant_id' => $otherSchool->tenant_id,
                'school_id' => $otherSchool->id,
                'user_id' => $publisher->id,
                'community_policy_version_id' => $policy->id,
                'accepted_at' => now(),
            ]);
        }
        UserPermissionOverride::query()->create([
            'school_id' => $otherSchool->id,
            'user_id' => $publisher->id,
            'permission_id' => Permission::query()->where('slug', 'community.publish')->valueOrFail('id'),
            'allowed' => false,
            'reason' => 'Publishing is not authorized at the selected campus.',
            'updated_by' => $publisher->id,
        ]);

        $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'school_id' => $otherSchool->id,
            'body' => 'Selected-school denial.',
            'audiences' => [['type' => 'school']],
        ])->assertForbidden();

        $this->assertDatabaseMissing('community_posts', ['school_id' => $otherSchool->id]);
    }

    public function test_historical_direct_student_posts_remain_visible_after_class_visibility_delegation(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $student = User::query()->where('username', 'alyssa.tan')->firstOrFail();

        $post = CommunityPost::query()->create([
            'tenant_id' => $admin->school->tenant_id,
            'school_id' => $admin->school_id,
            'author_user_id' => $admin->id,
            'post_type' => 'post',
            'body' => 'Historical direct student notice',
            'comments_enabled' => false,
            'status' => CommunityPost::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $admin->school_id,
            'community_post_id' => $post->id,
            'audience_type' => 'student',
            'student_id' => $student->studentProfile->id,
            'audience_key' => "student:{$student->studentProfile->id}",
        ]);

        $this->actingAs($student)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Historical direct student notice');
    }

    public function test_historical_direct_student_content_remains_private_and_managers_preserve_it_when_closing_cases(): void
    {
        $manager = User::query()->where('username', 'admin')->firstOrFail();
        $targetStudent = User::query()->where('username', 'alyssa.tan')->firstOrFail();
        $unrelatedStudent = $this->createAudienceMember($manager->school, 'student', 'historical.unrelated.student');
        Student::query()->where('school_id', $manager->school_id)->where('student_no', 'MIS-2026-002')->firstOrFail()
            ->update(['user_id' => $unrelatedStudent->id]);

        $directStudentPost = CommunityPost::query()->create([
            'tenant_id' => $manager->school->tenant_id,
            'school_id' => $manager->school_id,
            'author_user_id' => $manager->id,
            'post_type' => 'post',
            'body' => 'Historical direct student notice',
            'comments_enabled' => true,
            'status' => CommunityPost::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $manager->school_id,
            'community_post_id' => $directStudentPost->id,
            'audience_type' => 'student',
            'student_id' => $targetStudent->studentProfile->id,
            'audience_key' => "student:{$targetStudent->studentProfile->id}",
        ]);
        $comment = CommunityComment::query()->create([
            'tenant_id' => $manager->school->tenant_id,
            'school_id' => $manager->school_id,
            'community_post_id' => $directStudentPost->id,
            'user_id' => $manager->id,
            'body' => 'Historical visible comment',
            'status' => CommunityComment::STATUS_VISIBLE,
        ]);
        $report = CommunityReport::query()->create([
            'tenant_id' => $manager->school->tenant_id,
            'school_id' => $manager->school_id,
            'reporter_user_id' => $targetStudent->id,
            'source' => 'user_report',
            'target_type' => 'post',
            'community_post_id' => $directStudentPost->id,
            'reported_user_id' => $manager->id,
            'reason_code' => 'outdated',
            'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => ['post' => ['id' => $directStudentPost->id]],
            'due_at' => now()->addDay(),
        ]);
        $pendingPost = CommunityPost::query()->create([
            'tenant_id' => $manager->school->tenant_id,
            'school_id' => $manager->school_id,
            'author_user_id' => $manager->id,
            'post_type' => 'post',
            'body' => 'Historical pending-review post',
            'comments_enabled' => true,
            'status' => CommunityPost::STATUS_PENDING_REVIEW,
        ]);
        CommunityPostAudience::query()->create([
            'school_id' => $manager->school_id,
            'community_post_id' => $pendingPost->id,
            'audience_type' => 'student',
            'student_id' => $targetStudent->studentProfile->id,
            'audience_key' => "student:{$targetStudent->studentProfile->id}",
        ]);

        $this->actingAs($targetStudent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.comments', [])
            ->assertJsonMissing(['body' => 'Historical pending-review post']);

        $this->actingAs($unrelatedStudent)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonMissing(['id' => $directStudentPost->id]);

        $this->actingAs($manager)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$pendingPost->id}", [
            'reason' => 'Historical pending post is no longer appropriate.',
        ])->assertOk();
        $this->actingAs($manager)->postJson("http://localhost/api/v1/admin/community-moderation/reports/{$report->id}/decision", [
            'decision' => 'no_action',
            'reason_code' => 'outdated',
            'reason' => 'Resolved while retaining the historical record.',
        ])->assertOk()->assertJsonPath('data.status', CommunityReport::STATUS_RESOLVED);

        $this->assertDatabaseHas('community_comments', ['id' => $comment->id, 'status' => CommunityComment::STATUS_VISIBLE]);
        $this->assertDatabaseHas('community_reports', ['id' => $report->id, 'status' => CommunityReport::STATUS_RESOLVED]);
        $this->assertDatabaseHas('community_posts', ['id' => $pendingPost->id, 'status' => CommunityPost::STATUS_DELETED]);
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

        $inactiveDomainStudentUser = $this->createAudienceMember($school, 'student', 'audience.inactive-domain.student');
        $inactiveDomainStudent = Student::query()->create([
            'school_id' => $school->id,
            'user_id' => $inactiveDomainStudentUser->id,
            'student_no' => 'MIS-AUDIENCE-INACTIVE-DOMAIN',
            'full_name' => 'Inactive Domain Student',
            'status' => 'inactive',
        ]);
        ClassEnrolment::query()->create([
            'school_id' => $school->id,
            'academic_year_id' => $year->id,
            'class_id' => $classA->id,
            'student_id' => $inactiveDomainStudent->id,
            'status' => 'active',
            'current_slot' => 1,
        ]);
        $inactiveDomainParentUser = $this->createAudienceMember($school, 'parent', 'audience.inactive-domain.parent');
        $inactiveDomainGuardian = Guardian::query()->create([
            'school_id' => $school->id,
            'user_id' => $inactiveDomainParentUser->id,
            'full_name' => 'Inactive Domain Parent',
            'phone' => '+60 12-999 0001',
        ]);
        StudentParentLink::query()->create([
            'school_id' => $school->id,
            'student_id' => $inactiveDomainStudent->id,
            'parent_id' => $inactiveDomainGuardian->id,
            'relationship' => 'guardian',
            'status' => 'active',
            'current_slot' => 1,
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

    public function test_manager_sees_all_same_school_class_updates_but_is_not_notified_without_a_recipient_relationship(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $manager = $this->createAudienceMember($school, 'teacher', 'audience.manager-only');
        UserPermissionOverride::query()->create([
            'school_id' => $school->id,
            'user_id' => $manager->id,
            'permission_id' => Permission::query()->where('slug', 'community.moderate')->valueOrFail('id'),
            'allowed' => true,
            'reason' => 'Post management duty.',
            'updated_by' => $publisher->id,
        ]);
        $class = SchoolClass::query()->where('school_id', $school->id)->where('name', 'MC1')->firstOrFail();

        $postId = $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Class update for manager visibility.',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'notify_audience' => true,
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseMissing('portal_notifications', [
            'recipient_user_id' => $manager->id,
            'type' => 'school_update',
            'context_json->post_id' => $postId,
        ]);
        $this->actingAs($manager)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonFragment(['id' => $postId]);
    }

    public function test_whole_school_preview_excludes_non_app_admin_and_platform_only_identities_with_bounded_queries(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        foreach (range(1, 30) as $index) {
            $this->createAudienceMember($school, 'school-admin', "audience.non-app-admin.{$index}");
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        $preview = app(SchoolUpdateAudienceResolver::class)->preview($school->id, [['type' => 'school']], $publisher->id);
        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame(3, $preview['recipient_count']);
        $this->assertLessThanOrEqual(12, $queryCount, "Audience preview executed {$queryCount} queries.");
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
            'media' => [UploadedFile::fake()->create('lesson.png', 1, 'image/png')],
        ])->assertCreated();
        $media = $created->json('data.media.0');
        $this->assertNotNull($media);
        $this->assertDatabaseHas('community_post_media', ['community_post_id' => $created->json('data.id'), 'media_type' => 'image', 'status' => 'ready']);
        $this->actingAs(User::query()->where('username', 'rachel.wong')->firstOrFail())
            ->get($media['url'])->assertOk();
    }

    public function test_publication_rejects_non_image_media_and_can_skip_audience_notifications(): void
    {
        $publisher = User::query()->where('username', 'admin')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();

        $this->actingAs($publisher)->post('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Unsupported attachment',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'media' => [UploadedFile::fake()->create('lesson.pdf', 10, 'application/pdf')],
        ])->assertUnprocessable();

        $created = $this->actingAs($publisher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'No notification needed.',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'notify_audience' => false,
        ])->assertCreated();

        $this->assertDatabaseMissing('portal_notifications', [
            'type' => 'school_update',
            'context_json->post_id' => $created->json('data.id'),
        ]);
    }

    public function test_school_admin_can_hide_a_school_update_with_a_reason(): void
    {
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $postId = $this->actingAs($admin)->postJson('http://127.0.0.1/api/v1/community/posts', ['body' => 'Notice', 'audiences' => [['type' => 'school']]])->json('data.id');

        $this->actingAs($admin)->postJson("http://127.0.0.1/api/v1/community/posts/{$postId}/hide", ['reason' => 'Posted in error.'])->assertOk();
        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => 'hidden', 'moderation_reason' => 'Posted in error.']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'community.post_hidden', 'entity_id' => $postId]);
    }

    public function test_post_persistence_rolls_back_when_audit_fails(): void
    {
        Storage::fake('local');
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
            app(CommunityService::class)->publish($teacher->school_id, [
                'body' => 'Rollback',
                'audiences' => [['type' => 'class', 'class_id' => $class->id]],
                'media' => [UploadedFile::fake()->create('rollback.png', 1, 'image/png')],
            ], $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Audit failure should escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced audit failure.', $exception->getMessage());
        }

        $this->assertDatabaseCount('community_posts', 0);
        $this->assertDatabaseCount('community_post_audiences', 0);
        $this->assertDatabaseCount('community_post_media', 0);
        $this->assertDatabaseCount('portal_notifications', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_post_persistence_rolls_back_when_notification_persistence_fails(): void
    {
        Storage::fake('local');
        $connection = DB::connection();
        $dispatcher = new Dispatcher($this->app);
        $dispatcher->listen(QueryExecuted::class, function (QueryExecuted $query): void {
            if (str_contains($query->sql, 'portal_notifications')) {
                throw new RuntimeException('Forced notification failure.');
            }
        });
        $connection->setEventDispatcher($dispatcher);
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();

        try {
            app(CommunityService::class)->publish($teacher->school_id, [
                'body' => 'Notification rollback',
                'audiences' => [['type' => 'class', 'class_id' => $class->id]],
                'media' => [UploadedFile::fake()->create('notification-rollback.png', 1, 'image/png')],
            ], $teacher, app(AuditContextFactory::class)->system());
            $this->fail('Notification failure should escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Forced notification failure.', $exception->getMessage());
        } finally {
            $connection->setEventDispatcher($this->app['events']);
        }

        $this->assertDatabaseCount('community_posts', 0);
        $this->assertDatabaseCount('community_post_audiences', 0);
        $this->assertDatabaseCount('community_post_media', 0);
        $this->assertDatabaseCount('portal_notifications', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
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
        $notificationCount = PortalNotification::query()->where('type', 'school_update')->where('context_json->post_id', $postId)->count();

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
            'status' => CommunityPost::STATUS_PUBLISHED,
        ]);
        $this->assertSame($notificationCount, PortalNotification::query()->where('type', 'school_update')->where('context_json->post_id', $postId)->count());
    }

    public function test_publish_denied_author_is_not_offered_editing(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Former publisher update.',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        UserPermissionOverride::query()->create([
            'school_id' => $teacher->school_id,
            'user_id' => $teacher->id,
            'permission_id' => Permission::query()->where('slug', 'community.publish')->valueOrFail('id'),
            'allowed' => false,
            'reason' => 'Publishing duty has ended.',
            'updated_by' => User::query()->where('username', 'admin')->valueOrFail('id'),
        ]);

        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/posts')
            ->assertOk()
            ->assertJsonPath('data.0.id', $postId)
            ->assertJsonPath('data.0.can_edit', false);
    }

    public function test_author_edit_of_published_post_remains_published_without_a_new_submission_report(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Approved original',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');

        $this->actingAs($teacher)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'body' => 'Materially changed text',
        ])->assertOk()->assertJsonPath('data.status', CommunityPost::STATUS_PUBLISHED);

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => CommunityPost::STATUS_PUBLISHED, 'comments_enabled' => false]);
        $this->assertDatabaseMissing('community_reports', ['community_post_id' => $postId, 'source' => 'submission']);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $postId, 'action' => 'community.post_updated']);
    }

    public function test_historical_pending_and_rejected_posts_require_an_explicit_manager_transition(): void
    {
        $author = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $manager = User::query()->where('username', 'admin')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $posts = collect([CommunityPost::STATUS_PENDING_REVIEW, CommunityPost::STATUS_REJECTED])->map(function (string $status) use ($author, $class): CommunityPost {
            $post = CommunityPost::query()->create([
                'tenant_id' => $author->school->tenant_id,
                'school_id' => $author->school_id,
                'author_user_id' => $author->id,
                'post_type' => 'post',
                'body' => "Historical {$status} update",
                'comments_enabled' => true,
                'status' => $status,
            ]);
            CommunityPostAudience::query()->create([
                'school_id' => $author->school_id,
                'community_post_id' => $post->id,
                'audience_type' => 'class',
                'class_id' => $class->id,
                'audience_key' => "class:{$class->id}",
            ]);

            return $post;
        });
        $pending = $posts->firstWhere('status', CommunityPost::STATUS_PENDING_REVIEW);

        $authorPosts = collect($this->actingAs($author)->getJson('http://127.0.0.1/api/v1/community/posts')->assertOk()->json('data'));
        $this->assertFalse($authorPosts->firstWhere('id', $pending->id)['can_edit']);
        $this->assertSame(CommunityPost::STATUS_REJECTED, $authorPosts->firstWhere('status', CommunityPost::STATUS_REJECTED)['status']);
        $this->actingAs($author)->putJson("http://127.0.0.1/api/v1/community/posts/{$pending->id}", [
            'body' => 'Author cannot republish this.',
        ])->assertConflict();

        $managerPosts = collect($this->actingAs($manager)->getJson('http://127.0.0.1/api/v1/community/posts')->assertOk()->json('data'));
        $this->assertTrue($managerPosts->firstWhere('id', $pending->id)['can_edit']);
        $this->assertNotNull($managerPosts->firstWhere('status', CommunityPost::STATUS_REJECTED));
        $this->actingAs($manager)->putJson("http://127.0.0.1/api/v1/community/posts/{$pending->id}", [
            'body' => 'Manager reviewed and published this update.',
        ])->assertOk()->assertJsonPath('data.status', CommunityPost::STATUS_PUBLISHED);
        $audit = AuditLog::query()->where('entity_id', $pending->id)->where('action', 'community.post_updated')->sole();
        $this->assertSame(CommunityPost::STATUS_PENDING_REVIEW, $audit->old_values['status']);
        $this->assertSame(CommunityPost::STATUS_PUBLISHED, $audit->new_values['status']);
    }

    public function test_historical_community_restriction_does_not_block_school_update_publication_or_media(): void
    {
        Storage::fake('local');
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        CommunityUserRestriction::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'user_id' => $teacher->id,
            'scope' => 'all',
            'reason_code' => 'other',
            'reason' => 'Historical social-workflow restriction.',
            'starts_at' => now()->subDay(),
            'applied_by_user_id' => User::query()->where('username', 'admin')->valueOrFail('id'),
            'status' => 'active',
        ]);

        $this->actingAs($teacher)->post('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Official update unaffected by historical restrictions.',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
            'media' => [UploadedFile::fake()->create('official.png', 1, 'image/png')],
        ])->assertCreated()->assertJsonPath('data.media.0.name', 'official.png');
    }

    public function test_author_withdrawal_is_logical_and_preserves_moderation_history(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Withdraw this submission',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        UserPermissionOverride::query()->create([
            'school_id' => $teacher->school_id,
            'user_id' => $teacher->id,
            'permission_id' => Permission::query()->where('slug', 'community.moderate')->valueOrFail('id'),
            'allowed' => true,
            'reason' => 'Author also manages posts.',
            'updated_by' => User::query()->where('username', 'admin')->valueOrFail('id'),
        ]);
        $report = CommunityReport::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'reporter_user_id' => User::query()->where('username', 'rachel.wong')->valueOrFail('id'),
            'source' => 'user_report',
            'target_type' => 'post',
            'community_post_id' => $postId,
            'reported_user_id' => $teacher->id,
            'reason_code' => 'outdated',
            'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => ['post' => ['id' => $postId]],
            'due_at' => now()->addDay(),
        ]);
        $this->actingAs($teacher)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$postId}")->assertOk();

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => CommunityPost::STATUS_DELETED]);
        $this->assertDatabaseHas('audit_logs', ['entity_id' => $postId, 'action' => 'community.post_withdrawn']);
        $this->assertDatabaseHas('community_reports', ['id' => $report->id, 'resolution_code' => 'author_withdrawn']);
        $this->assertDatabaseHas('community_report_actions', ['community_report_id' => $report->id, 'action' => 'author_withdrawn']);
        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/posts')->assertJsonMissing(['id' => $postId]);
        $this->actingAs($teacher)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", ['body' => 'Restore it'])->assertConflict();
    }

    public function test_manager_withdrawal_requires_a_reason(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Withdraw me',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        $report = CommunityReport::query()->create([
            'tenant_id' => $teacher->school->tenant_id,
            'school_id' => $teacher->school_id,
            'reporter_user_id' => User::query()->where('username', 'rachel.wong')->valueOrFail('id'),
            'source' => 'user_report',
            'target_type' => 'post',
            'community_post_id' => $postId,
            'reported_user_id' => $teacher->id,
            'reason_code' => 'outdated',
            'priority' => 'normal',
            'status' => CommunityReport::STATUS_SUBMITTED,
            'target_snapshot' => ['post' => ['id' => $postId]],
            'due_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$postId}")->assertUnprocessable();
        $this->actingAs($admin)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$postId}", ['reason' => 'Superseded by corrected notice.'])->assertOk();

        $this->assertDatabaseHas('community_posts', [
            'id' => $postId,
            'status' => CommunityPost::STATUS_DELETED,
            'moderation_reason' => 'Superseded by corrected notice.',
        ]);
        $this->assertDatabaseHas('community_reports', ['id' => $report->id, 'resolution_code' => 'manager_withdrawn']);
        $this->assertDatabaseHas('community_report_actions', ['community_report_id' => $report->id, 'action' => 'manager_withdrawn']);
    }

    public function test_moderate_only_manager_can_edit_and_withdraw_another_authors_update(): void
    {
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $school = $teacher->school;
        $class = SchoolClass::query()->where('name', 'MB1')->firstOrFail();
        $postId = $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/posts', [
            'body' => 'Manager will correct this.',
            'audiences' => [['type' => 'class', 'class_id' => $class->id]],
        ])->assertCreated()->json('data.id');
        $manager = $this->createAudienceMember($school, 'teacher', 'community.manager');
        $permissions = Permission::query()->whereIn('slug', ['community.publish', 'community.moderate'])->pluck('id', 'slug');
        UserPermissionOverride::query()->insert([
            ['school_id' => $school->id, 'user_id' => $manager->id, 'permission_id' => $permissions['community.publish'], 'allowed' => false, 'reason' => 'Manager access only.', 'updated_by' => $teacher->id, 'created_at' => now(), 'updated_at' => now()],
            ['school_id' => $school->id, 'user_id' => $manager->id, 'permission_id' => $permissions['community.moderate'], 'allowed' => true, 'reason' => 'Manager access only.', 'updated_by' => $teacher->id, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->assertFalse($manager->hasPermissionTo('community.publish'));
        $this->assertTrue($manager->hasPermissionTo('community.moderate'));
        $this->actingAs($manager)->putJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'body' => 'Manager-corrected update.',
        ])->assertOk()->assertJsonPath('data.can_withdraw', true);
        $this->actingAs($manager)->deleteJson("http://127.0.0.1/api/v1/community/posts/{$postId}", [
            'reason' => 'Withdrawn by manager after correction.',
        ])->assertOk();

        $this->assertDatabaseHas('community_posts', ['id' => $postId, 'status' => CommunityPost::STATUS_DELETED]);
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
