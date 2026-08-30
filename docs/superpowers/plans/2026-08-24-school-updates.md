# School Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Community module into a controlled School Updates feed where authorized employees immediately publish text/images to the whole school or multiple classes and all visible recipients may Like but not comment.

**Architecture:** Reuse `community_posts`, audiences, media, reactions, reports, notifications, and audit storage. Add a focused audience resolver for feed visibility, recipient preview, and notification materialization; simplify Community mutation and moderation services instead of creating a second announcement domain. Admin remains the employee ability/Post Reports surface, while the App becomes the Updates composer and reader.

**Tech Stack:** Laravel 13/PHP, Eloquent, SQLite/MariaDB-compatible queries, React 19, TypeScript, Vitest, PHPUnit, Oxlint, Vite.

## Global Constraints

- App personas remain exactly Teacher, Parent, and Student; there is no Staff persona.
- Only an active employee with effective `community.publish` may publish.
- `community.moderate` is presented as **Manage posts** and manages same-school posts/reports.
- Whole school and selected classes are mutually exclusive; class audience supports multiple same-school classes.
- Selected classes include current Students, active linked Parents, assigned Teachers, and same-school post managers.
- Every visible recipient may Like/unlike once; nobody may comment.
- New posts accept text and up to six JPEG, PNG, or WebP images; no video, PDF, document, or link preview.
- Authorized posts publish immediately; no new submission review, appeal, restriction, user-report, or block workflow.
- Publish, edit, withdraw, report decisions, and User Ability changes preserve transactional Audit Trail behavior.
- Existing posts, direct-Student audiences, comments, reports, media, and audit history are never physically deleted.
- Notifications are optional per post, default on, deduplicated, exclude the author, and commit with publication.
- Do not add packages, trust client tenant/school IDs, or weaken tenant, school, authorization, audit, CSRF, or session enforcement.
- Do not push intermediate commits. Keep `.idea/`, databases, media/runtime state, and build artifacts out of Git.

---

### Task 1: Align Community Permissions and Employee Ability Labels

**Files:**
- Modify: `backend/app/Services/Authorization/EmployeeAccessCatalog.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/tests/Feature/EmployeeAccessTest.php`
- Modify: `backend/tests/Feature/Audit/AuditPermissionSeedTest.php`
- Modify: `frontend/src/components/StaffPage.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces the active ability contract: `community.view`, `community.publish`, and `community.moderate`.
- Retains the historical `community.interact` permission row and its temporary seeded role assignments until Task 4 retires the dependent routes; removes it now from active Employee ability templates, dependencies, and UI.
- Later tasks rely on `community.view` for Likes, `community.publish` for creation/author changes, and `community.moderate` for Post Reports/all-post management.

- [ ] **Step 1: Add failing backend catalog/seed tests**

Assert that Community ability labels and active role defaults match the approved product:

```php
$community = collect(app(EmployeeAccessCatalog::class)->groups()['Community'])->keyBy('slug');

$this->assertSame('View posts', $community['community.view']['label']);
$this->assertSame('Publish posts', $community['community.publish']['label']);
$this->assertSame('Manage posts', $community['community.moderate']['label']);
$this->assertArrayNotHasKey('community.interact', $community->all());
$this->assertSame('community.view', app(EmployeeAccessCatalog::class)->dependencies()['community.publish']);
$this->assertSame('community.view', app(EmployeeAccessCatalog::class)->dependencies()['community.moderate']);
```

Also assert Parent/Student roles retain `community.view` and the existing seeded `community.interact` compatibility assignments remain until Task 4 retires the routes that still require them.

- [ ] **Step 2: Run the focused backend tests and confirm failure**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\EmployeeAccessTest.php tests\Feature\Audit\AuditPermissionSeedTest.php
```

Expected: failure showing the old Community labels and active `community.interact` catalog entry.

- [ ] **Step 3: Update the catalog and seed templates**

Use this active catalog shape:

```php
'Community' => $this->items([
    'community.view' => 'View posts',
    'community.publish' => 'Publish posts',
    'community.moderate' => 'Manage posts',
]),
```

Keep `community.publish => community.view` and `community.moderate => community.view` dependencies. Keep the historical permission definition and seeded compatibility assignments temporarily; Task 4 removes those assignments atomically with the routes that still require them.

- [ ] **Step 4: Update Admin ability copy and tests**

Ensure the Employees editor renders the backend-provided labels and describes this group as official School Updates. Add an Admin assertion:

```tsx
expect(screen.getByText('Publish posts')).toBeInTheDocument()
expect(screen.getByText('Manage posts')).toBeInTheDocument()
expect(screen.queryByText('Interact with posts')).not.toBeInTheDocument()
```

- [ ] **Step 5: Run focused backend/Admin tests**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\EmployeeAccessTest.php tests\Feature\Audit\AuditPermissionSeedTest.php
cd ..\frontend
npm.cmd test -- --run src/App.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit the permission contract**

```powershell
git add backend/app/Services/Authorization/EmployeeAccessCatalog.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/EmployeeAccessTest.php backend/tests/Feature/Audit/AuditPermissionSeedTest.php frontend/src/components/StaffPage.tsx frontend/src/App.test.tsx
git commit -m "refactor: align school updates abilities"
```

### Task 2: Build the Audience Resolver and Publishing Context API

**Files:**
- Create: `backend/app/Services/Community/SchoolUpdateAudienceResolver.php`
- Modify: `backend/app/Services/Community/CommunityAccessService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/CommunityApiTest.php`

**Interfaces:**
- Produces `visibleClassIds(User $user, int $schoolId): array`.
- Produces `recipientUserIds(int $schoolId, array $audiences, ?int $excludeUserId = null): array`.
- Produces `preview(int $schoolId, array $audiences, ?int $excludeUserId = null): array{recipient_count:int,class_ids:list<int>,audience_label:string}`.
- Adds `GET /api/v1/community/publishing-context` and `POST /api/v1/community/audience-preview`, both requiring `community.publish`.
- `CommunityAccessService::visiblePosts()` consumes `visibleClassIds()` while preserving historical direct-Student visibility.

- [ ] **Step 1: Add failing audience tests**

Create same-school fixtures covering two classes, Students, duplicate linked Parents, assigned Teachers, a manager, an unrelated family, inactive membership, and another school. Assert:

```php
$preview = $this->actingAs($publisher)->postJson('/api/v1/community/audience-preview', [
    'audiences' => [
        ['type' => 'class', 'class_id' => $classA->id],
        ['type' => 'class', 'class_id' => $classB->id],
    ],
])->assertOk()->json('data');

$this->assertSame([$classA->id, $classB->id], $preview['class_ids']);
$this->assertSame($expectedUniqueRecipients, $preview['recipient_count']);
```

Also assert Whole school and class audiences cannot be mixed, duplicate class IDs are rejected or normalized, inactive/cross-school classes return 422/404, a user without `community.publish` receives 403, and a valid empty class returns count zero.

- [ ] **Step 2: Run the audience tests and confirm failure**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter="publishing context|audience preview" tests\Feature\CommunityApiTest.php
```

Expected: 404 for the new endpoints.

- [ ] **Step 3: Implement `SchoolUpdateAudienceResolver`**

Use a stable input type:

```php
/** @param list<array{type:'school'|'class',class_id?:int}> $audiences */
public function recipientUserIds(int $schoolId, array $audiences, ?int $excludeUserId = null): array;

/** @return array{recipient_count:int,class_ids:list<int>,audience_label:string} */
public function preview(int $schoolId, array $audiences, ?int $excludeUserId = null): array;
```

Resolve active same-tenant memberships permitted for the school, then include users with effective `community.view`. For class audiences, union current `ClassEnrolment` Student portal users, active `StudentParentLink` Guardian portal users, active `TeachingAssignment` Teachers, and users with effective `community.moderate`. Deduplicate integer user IDs and exclude the publisher when requested.

- [ ] **Step 4: Add request validation and publishing endpoints**

Centralize audience validation in a private controller method or Form Request using:

```php
'audiences' => ['required', 'array', 'min:1', 'max:20'],
'audiences.*.type' => ['required', Rule::in(['school', 'class'])],
'audiences.*.class_id' => ['nullable', 'integer', 'required_if:audiences.*.type,class'],
```

Reject a payload containing `school` plus any other audience. Return active same-school classes from publishing context:

```json
{
  "data": {
    "classes": [{ "id": 4, "name": "MA1" }],
    "max_images": 6,
    "notify_default": true
  }
}
```

- [ ] **Step 5: Delegate feed class visibility and run tests**

Move current Teacher/Student/Parent class lookup from `CommunityAccessService` to the new resolver. Keep the historical `student` audience branch in `visiblePosts()` but do not return `student` as a publishing option.

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\TenantIsolationApiTest.php
```

Expected: audience, feed, and tenant isolation tests pass.

- [ ] **Step 6: Commit the audience boundary**

```powershell
git add backend/app/Services/Community/SchoolUpdateAudienceResolver.php backend/app/Services/Community/CommunityAccessService.php backend/app/Http/Controllers/Api/V1/CommunityController.php backend/routes/api.php backend/tests/Feature/CommunityApiTest.php
git commit -m "feat: resolve school update audiences"
```

### Task 3: Publish Immediately With Images, Notifications, and Audit

**Files:**
- Modify: `backend/app/Services/Community/CommunityService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityController.php`
- Modify: `backend/app/Models/CommunityPost.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Test: `backend/tests/Feature/CommunityApiTest.php`
- Test: `backend/tests/Feature/DemoPortalApiTest.php`

**Interfaces:**
- Changes `CommunityService::publish()` data to include `notify_audience: bool` and only `school|class` audiences/image media.
- Consumes `SchoolUpdateAudienceResolver::recipientUserIds()`.
- Creates `PortalNotification` rows with type `school_update` and context `{post_id, audience_type, class_ids}`.
- Keeps `CommunityPost::STATUS_PUBLISHED`; logical withdrawal continues to use preserved status/hidden fields.

- [ ] **Step 1: Add failing publication/notification tests**

Test authorized Teacher, School Admin, and Finance overrides; unauthorized Parent/Student publishing; immediate `published` status; `comments_enabled=false`; `media.status=ready`; and image-only validation.

Assert notification deduplication and author exclusion:

```php
$response = $this->actingAs($publisher)->postJson('/api/v1/community/posts', [
    'body' => 'Sports day starts at 8:00 am.',
    'audiences' => [['type' => 'class', 'class_id' => $class->id]],
    'notify_audience' => true,
]);

$response->assertCreated()->assertJsonPath('data.status', 'published');
$this->assertDatabaseHas('community_posts', ['id' => $response->json('data.id'), 'comments_enabled' => false]);
$this->assertDatabaseMissing('portal_notifications', ['recipient_user_id' => $publisher->id, 'type' => 'school_update']);
```

Add tests for `notify_audience=false`, edit without notification resend, audit rollback, notification persistence rollback, and stored files removed when the transaction fails.

- [ ] **Step 2: Run focused publication tests and confirm failure**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter="school update|notifies|publishes immediately|image only" tests\Feature\CommunityApiTest.php
```

Expected: old pending-review behavior, comment defaults, and missing notifications fail.

- [ ] **Step 3: Simplify request validation**

Use:

```php
'body' => ['required', 'string', 'max:5000'],
'notify_audience' => ['sometimes', 'boolean'],
'media' => ['sometimes', 'array', 'max:6'],
'media.*' => ['file', 'max:10240', 'mimetypes:image/jpeg,image/png,image/webp'],
```

Remove `comments_enabled`, video, QuickTime, and PDF acceptance.

- [ ] **Step 4: Make publication immediate and notification-transactional**

Inside the existing `DB::transaction()`:

```php
$post = CommunityPost::query()->create([
    'tenant_id' => $tenantId,
    'school_id' => $schoolId,
    'author_user_id' => $actor->id,
    'post_type' => 'update',
    'body' => $inspection->normalized,
    'comments_enabled' => false,
    'status' => CommunityPost::STATUS_PUBLISHED,
    'published_at' => now(),
    'reviewed_at' => now(),
    'reviewed_by_user_id' => $actor->id,
]);
```

Store each accepted image as `media_type=image`, `status=ready`. Do not create a submission report. When notifications are enabled, bulk-create one `PortalNotification` per resolved recipient with `type=school_update`; record recipient count and audience keys in the publication audit event.

- [ ] **Step 5: Keep edits published and withdrawals logical**

An author with current `community.publish` or manager may edit. Update body only, retain `status=published`, do not resend notifications, and force `comments_enabled=false`. Rename UI/API semantics from delete to withdraw while preserving the existing logical status/hidden columns and report closure behavior. Require a withdrawal reason for managers; use a fixed author-withdrawn reason for the author if the API does not expose free text.

- [ ] **Step 6: Run publication and portal tests**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\DemoPortalApiTest.php
```

Expected: immediate publication, images, notifications, author/manager scope, rollback, and legacy read tests pass.

- [ ] **Step 7: Commit publication behavior**

```powershell
git add backend/app/Services/Community/CommunityService.php backend/app/Http/Controllers/Api/V1/CommunityController.php backend/app/Models/CommunityPost.php backend/app/Audit/AuditAction.php backend/tests/Feature/CommunityApiTest.php backend/tests/Feature/DemoPortalApiTest.php
git commit -m "feat: publish official school updates"
```

### Task 4: Retire Comments and Reduce Moderation to Post Reports

**Files:**
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityModerationController.php`
- Modify: `backend/app/Services/Community/CommunityModerationService.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/tests/Feature/CommunityApiTest.php`
- Modify: `backend/tests/Feature/Audit/AuditPermissionSeedTest.php`
- Modify: `backend/tests/Feature/CommunityReportAndBlockApiTest.php`
- Modify: `backend/tests/Feature/CommunityModerationQueueApiTest.php`

**Interfaces:**
- Reaction route requires `community.view`, not retired `community.interact`.
- Active report creation accepts only `target_type=post` and a visible post ID.
- Active Admin queue returns user-reported post cases only; historical comment/user/submission cases remain stored and may be read only where compatibility requires it.
- Comment, user-block, Student authorization, restriction, and appeal mutation routes are removed from the active route set.
- Active seeded roles no longer receive `community.interact`; the permission row remains for historical data compatibility.

- [ ] **Step 1: Replace social workflow tests with retired-route and post-report tests**

Assert:

```php
$this->actingAs($parent)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Reply'])
    ->assertNotFound();

$this->actingAs($student)->postJson('/api/v1/community/reports', [
    'target_type' => 'post',
    'target_id' => $post->id,
    'reason_code' => 'incorrect',
    'details' => 'The event date is outdated.',
])->assertCreated();
```

Also assert user/comment report, block/unblock, authorization, restriction, and appeal mutation routes are unavailable; hidden/invisible/cross-school posts cannot be reported; and Likes work with `community.view` only.

Assert reseeding removes `community.interact` from active role assignments while retaining the permission definition for historical records.

- [ ] **Step 2: Run the focused safety/moderation tests and confirm failure**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityReportAndBlockApiTest.php tests\Feature\CommunityModerationQueueApiTest.php
```

Expected: old comment/user/block/appeal workflows are still active.

- [ ] **Step 3: Remove retired active routes and controller actions**

Keep policy acceptance/current policy, post feeds/media/reactions, post reports, `reports/mine`, and school Post Reports management. Remove active routes for comments, comment removal, blocked users, user blocking, Student Community authorization, content/mine, appeals, user restrictions, and appeal decisions.

At the same time, remove `community.interact` from the seeded role-permission arrays. Do not delete the permission definition or historical database rows.

Do not drop models or tables; historical records remain queryable for audit/recovery.

- [ ] **Step 4: Narrow report validation and manager queue**

Use:

```php
'target_type' => ['required', Rule::in(['post'])],
'target_id' => ['required', 'integer'],
'reason_code' => ['required', Rule::in(['incorrect', 'outdated', 'inappropriate', 'other'])],
'details' => ['nullable', 'string', 'max:1000'],
```

Queue queries must require `source=user_report`, `target_type=post`, same tenant/school, and active statuses. Decisions preserve evidence/action rows and may keep existing `no_action|remove_content` storage codes while presenting user-friendly Post Report copy.

- [ ] **Step 5: Run Community safety regression**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\CommunityReportAndBlockApiTest.php tests\Feature\CommunityModerationQueueApiTest.php tests\Feature\CommunityPolicyGateApiTest.php
```

Expected: Post Reports and policy acceptance pass; retired routes return 404; history-preservation tests pass.

- [ ] **Step 6: Commit the narrowed moderation workflow**

```powershell
git add backend/routes/api.php backend/app/Http/Controllers/Api/V1/CommunityController.php backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php backend/app/Http/Controllers/Api/V1/CommunityModerationController.php backend/app/Services/Community/CommunityModerationService.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/CommunityApiTest.php backend/tests/Feature/Audit/AuditPermissionSeedTest.php backend/tests/Feature/CommunityReportAndBlockApiTest.php backend/tests/Feature/CommunityModerationQueueApiTest.php
git commit -m "refactor: reduce community moderation to post reports"
```

### Task 5: Convert the App to Updates, Multi-Class Publishing, and Likes

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/api/portalApi.ts`
- Modify: `app/src/components/CommunityFeed.tsx`
- Modify: `app/src/components/ParentPortalView.tsx`
- Modify: `app/src/components/StudentPortalView.tsx`
- Modify: `app/src/components/TeacherPortalView.tsx`
- Modify: `app/src/components/NotificationCentre.tsx`
- Modify: `app/src/features/community-safety/CommunitySafetyMenu.tsx`
- Modify: `app/src/features/community-safety/CommunitySafetyCentre.tsx`
- Modify: `app/src/components/MobileShell.tsx`
- Modify: `app/src/App.test.tsx`
- Modify: `app/src/components/MobileShell.test.tsx`
- Modify: `app/src/features/community-safety/CommunitySafety.test.tsx`

**Interfaces:**
- `CommunityPost` becomes `SchoolUpdate` in active App types or retains the wire name behind a renamed UI type; it has no comments collection.
- `PublishingContext = {classes: Array<{id:number,name:string}>, max_images:6, notify_default:true}`.
- `AudiencePreview = {recipient_count:number,class_ids:number[],audience_label:string}`.
- `createSchoolUpdate(body, audiences, notifyAudience, files)` sends the approved payload.
- Notification type `school_update` maps to the Updates category and opens the referenced post/feed.
- `App.tsx` derives `canPublishUpdates = user.permissions.includes('community.publish')` and passes it through Teacher portal/navigation props; it never infers publishing from the Teacher persona or `staffMode`.

- [ ] **Step 1: Add failing App tests**

Cover Parent/Student read-and-Like only, authorized Teacher composer visibility, no composer without `community.publish`, Whole school versus multi-class selection, recipient preview, Notify audience default, image-only chooser, preserved form on error, author/manager actions, and no comments/video/PDF/block/appeal UI.

Example assertions:

```tsx
expect(screen.getByRole('heading', { name: 'School Updates' })).toBeInTheDocument()
expect(screen.queryByRole('button', { name: /Comment/ })).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument()
expect(screen.getByLabelText('Notify audience')).toBeChecked()
```

- [ ] **Step 2: Run focused App tests and confirm failure**

Run:

```powershell
cd app
npm.cmd test -- --run src/components/MobileShell.test.tsx src/features/community-safety/CommunitySafety.test.tsx src/App.test.tsx
```

Expected: old Community/comment/composer behavior fails the new expectations.

- [ ] **Step 3: Update API types and methods**

Replace active comment/block/appeal methods with:

```ts
getSchoolUpdates: () => apiRequest<{ data: SchoolUpdate[] }>('/v1/community/posts'),
getPublishingContext: () => apiRequest<{ data: PublishingContext }>('/v1/community/publishing-context'),
previewUpdateAudience: (audiences: UpdateAudience[]) =>
  apiRequest<{ data: AudiencePreview }>('/v1/community/audience-preview', { method: 'POST', body: { audiences } }),
createSchoolUpdate: (body: string, audiences: UpdateAudience[], notifyAudience: boolean, files: File[]) => Promise<...>,
toggleSchoolUpdateLike: (postId: number) => apiRequest<...>(`/v1/community/posts/${postId}/reaction`, { method: 'POST' }),
reportSchoolUpdate: (postId: number, reasonCode: string, details: string) => apiRequest<...>(...),
```

Append only `image/jpeg`, `image/png`, or `image/webp` files and `notify_audience` to `FormData`.

- [ ] **Step 4: Rebuild the composer around Whole school or class multi-select**

Replace `staffMode` audience assumptions with the explicit `canPublishUpdates` prop derived from the authenticated permission payload. Hide the Teacher Create navigation item and all create strips when false. Load all allowed classes from publishing context. Store:

```ts
const [audienceMode, setAudienceMode] = useState<'school' | 'classes'>('school')
const [selectedClassIds, setSelectedClassIds] = useState<number[]>([])
const [notifyAudience, setNotifyAudience] = useState(true)
```

Use the existing system-styled custom controls; class pills/checkboxes support multiple selections. Debounce preview requests after selection changes, show `audience_label` and unique recipient count, and warn rather than block when count is zero.

- [ ] **Step 5: Simplify the feed card**

Rename visible copy to Updates/School Updates. Render author, time, audience label, body, images, Like count/state, Report, and author/manager edit/withdraw. Remove comment state, methods, icons, counts, forms, historical comment rendering, video/PDF branches, user-report/block controls, and permanent-delete wording.

Preserve existing swipe-back behavior for edit/report secondary pages.

- [ ] **Step 6: Update notifications and safety navigation**

Map `school_update` to an Updates filter/icon/destination. Reduce Safety Centre active options to policy/support/legal links plus My Post Reports where applicable. Do not remove public policy pages or the mandatory first-login Terms/Community Standards gate.

- [ ] **Step 7: Run App tests, lint, and build**

Run:

```powershell
cd app
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: all App tests pass; lint exits 0; TypeScript/Vite build exits 0.

- [ ] **Step 8: Commit the App conversion**

```powershell
git add app/src
git commit -m "feat: replace community feed with school updates"
```

### Task 6: Reduce Admin Community Safety to Post Reports

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AdminShell.tsx`
- Modify: `frontend/src/features/moderation/moderationApi.ts`
- Modify: `frontend/src/features/moderation/UgcModerationPage.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/features/moderation/UgcModerationPage.test.tsx` if present; otherwise create it.

**Interfaces:**
- Sidebar entry label becomes **Post Reports** and requires `community.moderate` (platform compatibility may remain read-only outside this school page).
- `moderationApi` retains school report list/detail/decision only.
- Admin page supports `no_action` and `remove_content` decisions with required reason; no restriction or appeal controls.

- [ ] **Step 1: Add failing Admin Post Reports tests**

Assert the navigation label, filtered post-only cases, preserved evidence, required reason, manager decision submission, and absence of user restriction/appeal/platform intervention controls.

```tsx
expect(screen.getByRole('button', { name: 'Post Reports' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Post Reports' })).toBeInTheDocument()
expect(screen.queryByText('Community restriction')).not.toBeInTheDocument()
expect(screen.queryByText(/Appeal #/)).not.toBeInTheDocument()
```

- [ ] **Step 2: Run focused Admin tests and confirm failure**

Run:

```powershell
cd frontend
npm.cmd test -- --run src/App.test.tsx src/features/moderation/UgcModerationPage.test.tsx
```

Expected: old Community Safety/moderation UI fails the new copy and reduced controls.

- [ ] **Step 3: Simplify Admin API and page**

Remove active platform summary, user restriction, and appeal methods from the page API. Keep report list/detail/decision. Present reporter, post author, audience, post snapshot/media, reason, details, status, timestamps, and action history. Require a non-empty decision reason before submission.

- [ ] **Step 4: Update navigation and authorization copy**

Rename Community Safety to Post Reports in Admin navigation and page headings. Do not change backend permission enforcement. Ensure users without `community.moderate` cannot see or open the page.

- [ ] **Step 5: Run Admin tests, lint, and build**

Run:

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: all Admin tests pass; lint has no errors; TypeScript/Vite build exits 0.

- [ ] **Step 6: Commit the Admin reduction**

```powershell
git add frontend/src
git commit -m "refactor: simplify admin post reports"
```

### Task 7: Compatibility Regression, Documentation, and Delivery Review

**Files:**
- Modify: `README.md`
- Modify: `docs/project-overview.md`
- Modify: `docs/current-status.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/permissions.md`
- Modify: `docs/saas-multitenancy.md` only if tenant-role wording changes.
- Modify: `docs/superpowers/specs/2026-08-24-school-updates-design.md` status only after implementation is verified.

**Interfaces:**
- Canonical documentation consistently calls the feature School Updates/Updates, records active permissions and audiences, and labels old social workflows as historical storage only.
- No schema migration is required unless implementation discovers a durable field that cannot be represented by existing posts, audiences, reports, notifications, or audit data. If that occurs, stop and amend the approved design before adding schema.

- [ ] **Step 1: Add explicit historical compatibility assertions**

Extend backend tests to seed an old published direct-Student post with visible comments and an old pending-review post. Assert:

```php
$this->actingAs($targetStudent)->getJson('/api/v1/community/posts')
    ->assertOk()
    ->assertJsonPath('data.0.comments', []);

$this->actingAs($unrelatedStudent)->getJson('/api/v1/community/posts')
    ->assertJsonMissing(['id' => $directStudentPost->id]);
```

Assert old comments/reports remain in the database, pending posts are not public, and managers can explicitly withdraw or resolve historical cases without data deletion.

- [ ] **Step 2: Run the full backend qualification**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Expected: PHPUnit/Pint/routes exit 0. Record exact tests, assertions, skips, and route count.

- [ ] **Step 3: Run both frontend qualifications**

Run separately:

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build

cd ..\app
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: all tests/builds pass; record any existing warnings without converting them to failures.

- [ ] **Step 4: Run database-sensitive checks when applicable**

Because the approved implementation reuses existing schema, do not create a migration solely to remove retired columns/tables. If a corrective migration becomes necessary after design amendment, run fresh/rollback/re-migrate on disposable SQLite and MariaDB. Otherwise record schema lifecycle as not applicable and retain the last verified migration evidence. MariaDB query behavior for new audience resolution must be tested on a disposable MariaDB database or marked **Not verified**.

- [ ] **Step 5: Update canonical documentation**

Document:

- official employee-only publishing;
- View/Publish/Manage abilities;
- whole-school and multi-class recipient rules;
- Parent/Student read-and-Like-only behavior;
- image-only media and optional notifications;
- no comments, direct Student targeting, user blocking, appeals, or routine approval;
- preserved historical Community storage;
- exact verification evidence and MariaDB/hardware limitations.

- [ ] **Step 6: Review the final diff and staged scope**

Run:

```powershell
git status --short
git diff --stat
git diff --check
git diff --name-only
```

Confirm `.idea/`, `.env`, databases, uploaded media, logs, `dist/`, and runtime files are unstaged. Review routes, permissions, audience queries, notification transaction boundaries, and the complete final diff.

- [ ] **Step 7: Commit documentation and any final test-only corrections**

```powershell
git add README.md docs backend/tests frontend/src app/src
git commit -m "docs: record school updates delivery"
```

- [ ] **Step 8: Present for final user confirmation before push**

Report the local commits, changed behavior, exact verification results, skipped/Not verified checks, and remaining `.idea/` status. Do not push until the user explicitly confirms the completed implementation.
