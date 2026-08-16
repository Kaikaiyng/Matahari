# RYLAY Strict UGC Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-safe, child-conscious UGC moderation system with preventive review, reporting, blocking, appeals, adult authorization, public policies, and Apple/Google submission evidence.

**Architecture:** Extend the existing Laravel Community domain with additive tenant-owned moderation storage and three focused services: policy/authorization gates, deterministic safety filtering, and moderation case handling. App users receive policy, report, block, appeal, and pending-content workflows; the Admin client receives a school queue while Super Admin receives an explicitly permissioned platform escalation view. Existing audience authorization remains mandatory and composes with moderation state and user blocks.

**Tech Stack:** Laravel 13/PHP 8.4, Eloquent, MariaDB/MySQL-compatible migrations with SQLite tests, React 19/TypeScript, Vitest, Oxlint, Vite.

## Global Constraints

- Resolve tenant from an active verified hostname before membership, permission, school, content, report, or moderation scope; never trust client tenant/school IDs.
- Every tenant uses the same moderation code and reason taxonomy; tenant differences remain limited to approved branding/features.
- Non-moderator text and all non-moderator media default to `pending_review`; pending media stays private.
- Never physically delete moderation evidence through ordinary workflows.
- Material moderation/enforcement changes and their audit/action history must commit in one transaction.
- Student freeform Community interaction defaults off until reviewed Guardian or School Admin adult authorization exists.
- No external AI moderation provider, automatic legal report, or invented support/child-safety contact in V1.
- Preserve existing published Community records during migration and provide tested `down()` behavior.
- Production direction is MariaDB/MySQL; SQLite-only evidence is insufficient.

---

## File Structure

Backend additions are split by responsibility:

- `backend/database/migrations/2026_08_16_000002_create_community_moderation_foundation.php`: additive schema, tenant backfill/preflight, indexes, permissions, rollback.
- `backend/app/Models/CommunityPolicyVersion.php`, `CommunityPolicyAcceptance.php`, `CommunityReport.php`, `CommunityReportAction.php`, `CommunityUserBlock.php`, `CommunityUserRestriction.php`, `CommunityAppeal.php`, `StudentCommunityAuthorization.php`: one model per persisted concept.
- `backend/app/Services/Community/CommunityPolicyService.php`: current-policy acceptance and student adult-authorization gate.
- `backend/app/Services/Community/CommunitySafetyFilter.php`: deterministic normalization and shared rule evaluation.
- `backend/app/Services/Community/SafetyInspection.php`: immutable safety-filter result value object.
- `backend/app/Services/Community/ReportTarget.php`: authorized resolved post/comment/user report target value object.
- `backend/app/Services/Community/CommunityModerationService.php`: report, block, review, restriction, escalation, and appeal state transitions.
- `backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php`: App-facing policy/report/block/appeal endpoints.
- `backend/app/Http/Controllers/Api/V1/CommunityModerationController.php`: active-school Admin queue/actions.
- `backend/app/Http/Controllers/Api/V1/PlatformCommunityModerationController.php`: Super Admin escalation summary/detail/actions.
- `backend/app/Http/Controllers/Api/V1/PublicCommunityPolicyController.php`: unauthenticated policy/support output for public pages.
- `backend/config/community_safety.php`: shared reason codes, SLA values, safety rules, public URLs, and non-secret contact environment keys.

Client additions stay outside large shell files:

- `app/src/features/community-safety/CommunitySafetyMenu.tsx`: report/block actions.
- `app/src/features/community-safety/CommunityPolicyGate.tsx`: Terms/Standards acceptance and student safety notice.
- `app/src/features/community-safety/CommunitySafetyCentre.tsx`: My Reports, Blocked Users, Appeals.
- `app/src/features/community-safety/PublicPolicyPage.tsx`: no-login public policy/support rendering.
- `frontend/src/features/moderation/UgcModerationPage.tsx`: school/platform moderation queue and decision UI.
- `frontend/src/features/moderation/moderationApi.ts`: typed Admin moderation API boundary.

### Task 1: Additive Moderation Schema, Models, and Permissions (complete: `feat: add UGC moderation foundation`)

**Files:**
- Create: `backend/database/migrations/2026_08_16_000002_create_community_moderation_foundation.php`
- Create: eight moderation model files listed under File Structure
- Modify: `backend/app/Models/CommunityPost.php`
- Modify: `backend/app/Models/CommunityComment.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Modify: `backend/app/Audit/AuditSubject.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Test: `backend/tests/Feature/CommunityModerationFoundationMigrationTest.php`

**Interfaces:**
- Produces model status constants and relations used by every later task.
- Produces permissions `community.moderate_platform` (Super Admin only) while retaining `community.moderate` for School/Super Admin.

- [x] **Step 1: Write migration tests before the migration**

Assert table/column/index presence, legacy published-row preservation, tenant backfill from `schools.tenant_id`, permission grants, reverse-FK rollback, and re-migration. Use a legacy Community post/comment fixture created before invoking the new migration `up()`.

```php
$this->assertSame('published', CommunityPost::query()->findOrFail($postId)->status);
$this->assertSame($school->tenant_id, CommunityPost::query()->findOrFail($postId)->tenant_id);
$this->assertTrue($superAdmin->fresh()->hasPermissionTo('community.moderate_platform'));
$this->assertFalse($schoolAdmin->fresh()->hasPermissionTo('community.moderate_platform'));
```

- [x] **Step 2: Run the focused migration test and confirm RED**

Run: `tools\php\php-local.cmd backend\vendor\bin\phpunit backend\tests\Feature\CommunityModerationFoundationMigrationTest.php`

Expected: FAIL because migration/tables/columns do not exist.

- [x] **Step 3: Implement the additive migration and models**

The migration must preflight that every existing Community post/comment resolves through a school with non-null `tenant_id`, then add `tenant_id`, `reviewed_at`, `reviewed_by_user_id`, and `moderation_reason_code` to posts/comments. Backfill before making tenant ownership non-null. Create the eight tables from the approved design with restrictive FKs for evidence and indexes beginning with `(tenant_id, school_id, ...)` for tenant-local queues. Reports include nullable `evidence_held_at` and `evidence_held_by_user_id` fields so severe cases can preserve snapshots and quarantined media against ordinary cleanup. Insert immutable version `2026-08-16` records for Terms, Privacy, Community Standards, and Child Safety using structured JSON sections; rollback removes only those exact version records and the new schema.

Define model status constants, for example:

```php
final class CommunityReport extends Model
{
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_REVIEWING = 'reviewing';
    public const STATUS_RESOLVED = 'resolved';

    protected $fillable = [
        'tenant_id', 'school_id', 'reporter_user_id', 'target_type',
        'community_post_id', 'community_comment_id', 'reported_user_id',
        'reason_code', 'details', 'priority', 'status', 'target_snapshot',
        'due_at', 'assigned_to_user_id', 'resolved_at', 'resolution_code',
    ];
}
```

Add audit actions for policy acceptance, adult authorization/revocation, report submitted/reviewed, content approved/rejected/hidden, user block/unblock, restriction applied/revoked, escalation, appeal submitted/decided.

- [x] **Step 4: Run focused tests, Pint, and SQLite lifecycle**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityModerationFoundationMigrationTest.php
..\tools\php\php-local.cmd vendor\bin\pint --test
```

Expected: focused suite and Pint PASS; isolated SQLite migrate/rollback/re-migrate PASS.

- [x] **Step 5: Commit the schema slice**

```powershell
git add -- backend/database/migrations/2026_08_16_000002_create_community_moderation_foundation.php backend/app/Models/CommunityPolicyVersion.php backend/app/Models/CommunityPolicyAcceptance.php backend/app/Models/CommunityReport.php backend/app/Models/CommunityReportAction.php backend/app/Models/CommunityUserBlock.php backend/app/Models/CommunityUserRestriction.php backend/app/Models/CommunityAppeal.php backend/app/Models/StudentCommunityAuthorization.php backend/app/Models/CommunityPost.php backend/app/Models/CommunityComment.php backend/app/Audit/AuditAction.php backend/app/Audit/AuditSubject.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/CommunityModerationFoundationMigrationTest.php
git commit -m "feat: add UGC moderation foundation"
```

### Task 2: Policy Gate, Student Adult Authorization, and Safety Filter

**Files:**
- Create: `backend/config/community_safety.php`
- Create: `backend/app/Services/Community/CommunityPolicyService.php`
- Create: `backend/app/Services/Community/CommunitySafetyFilter.php`
- Create: `backend/app/Services/Community/SafetyInspection.php`
- Modify: `backend/app/Services/Community/CommunityService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityController.php`
- Test: `backend/tests/Unit/CommunitySafetyFilterTest.php`
- Test: `backend/tests/Feature/CommunityPolicyGateApiTest.php`

**Interfaces:**
- Produces `CommunityPolicyService::assertCanContribute(User $user, int $tenantId, int $schoolId): void`.
- Produces `CommunitySafetyFilter::inspect(string $text): SafetyInspection`, where `SafetyInspection` exposes `normalized`, `allowed`, `reasonCode`, and `requiresManualReview`.
- Changes `CommunityService::publish()` and `comment()` so non-moderator content is stored pending and not returned as public content.

- [ ] **Step 1: Write failing unit and feature tests**

Cover Unicode/zero-width normalization, prohibited patterns, link/contact detection, policy-version acceptance, revoked student authorization, reviewed Guardian authorization, School Admin authorization, and moderator direct publication.

```php
$inspection = app(CommunitySafetyFilter::class)->inspect("b\u{200B}ully");
$this->assertFalse($inspection->allowed);
$this->assertSame('bullying_harassment', $inspection->reasonCode);

$this->actingAs($studentUser)
    ->postJson('http://127.0.0.1/api/v1/community/posts/1/comments', ['body' => 'Hello'])
    ->assertUnprocessable()
    ->assertJsonValidationErrors('community_policy');
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `tools\php\php-local.cmd backend\vendor\bin\phpunit backend\tests\Unit\CommunitySafetyFilterTest.php backend\tests\Feature\CommunityPolicyGateApiTest.php`

- [ ] **Step 3: Implement shared configuration and services**

`community_safety.php` defines the approved reason codes, `severe` codes, SLA hours (`4` severe, `24` normal), normalized blocked patterns, maximum report rate, and environment-backed public/support contact values. `SafetyInspection` is a readonly value object with constructor `__construct(public string $normalized, public bool $allowed, public ?string $reasonCode, public bool $requiresManualReview)`. No real contact or secret is committed.

`assertCanContribute()` requires active policy acceptance; for Student users it also requires an active `student_community_authorizations` row issued by an active reviewed same-school Guardian or School Admin.

Update publication behavior:

```php
$isModerator = $actor->hasPermissionTo('community.moderate');
$status = $isModerator ? 'published' : 'pending_review';
$mediaStatus = $isModerator ? 'ready' : 'quarantined';
```

Rejected text creates no post/comment/media. Pending content is visible only through an explicit author/moderator query, never the existing public feed query.

- [ ] **Step 4: Run focused Community regression and Pint**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Unit\CommunitySafetyFilterTest.php tests\Feature\CommunityPolicyGateApiTest.php tests\Feature\CommunityApiTest.php
..\tools\php\php-local.cmd vendor\bin\pint --test
```

- [ ] **Step 5: Commit the policy/filter slice**

```powershell
git add -- backend/config/community_safety.php backend/app/Services/Community/CommunityPolicyService.php backend/app/Services/Community/CommunitySafetyFilter.php backend/app/Services/Community/SafetyInspection.php backend/app/Services/Community/CommunityService.php backend/app/Http/Controllers/Api/V1/CommunityController.php backend/tests/Unit/CommunitySafetyFilterTest.php backend/tests/Feature/CommunityPolicyGateApiTest.php
git commit -m "feat: gate and filter Community contributions"
```

### Task 3: Reporting, Blocking, Feed Filtering, and Media Protection APIs

**Files:**
- Create: `backend/app/Services/Community/CommunityModerationService.php`
- Create: `backend/app/Services/Community/ReportTarget.php`
- Create: `backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php`
- Modify: `backend/app/Services/Community/CommunityAccessService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunityController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/CommunityReportAndBlockApiTest.php`

**Interfaces:**
- Produces `submitReport(User $reporter, int $tenantId, int $schoolId, ReportTarget $target, string $reasonCode, ?string $details, AuditContext $context): CommunityReport`.
- Produces `blockUser(...)`, `unblockUser(...)`, and reporter-owned list methods.
- Feed query excludes content from active blocked-user pairs and pending/rejected/hidden/quarantined records.

- [ ] **Step 1: Write failing API security tests**

Test post, comment, and user reports; target visibility; cross-school/tenant IDOR; duplicate active report; rate limiting; severe immediate quarantine; ordinary report remaining visible; block/unblock; blocked feed/comments; self-block denial; reporter privacy; and media download denial.

```php
$this->actingAs($parent)
    ->postJson('http://127.0.0.1/api/v1/community/reports', [
        'target_type' => 'post', 'target_id' => $post->id, 'reason_code' => 'child_safety',
    ])->assertCreated();

$this->assertSame('hidden', $post->fresh()->status);
$this->assertDatabaseHas('community_report_actions', ['action' => 'auto_quarantined']);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `tools\php\php-local.cmd backend\vendor\bin\phpunit backend\tests\Feature\CommunityReportAndBlockApiTest.php`

- [ ] **Step 3: Implement transactional reporting and blocking**

Routes under authenticated App surface:

```php
Route::get('/community/policies/current', [CommunitySafetyController::class, 'currentPolicies']);
Route::post('/community/policies/{communityPolicyVersion}/accept', [CommunitySafetyController::class, 'acceptPolicy']);
Route::post('/community/reports', [CommunitySafetyController::class, 'storeReport']);
Route::get('/community/reports/mine', [CommunitySafetyController::class, 'myReports']);
Route::post('/community/users/{user}/block', [CommunitySafetyController::class, 'block']);
Route::delete('/community/users/{user}/block', [CommunitySafetyController::class, 'unblock']);
Route::get('/community/blocked-users', [CommunitySafetyController::class, 'blockedUsers']);
Route::get('/community/content/mine', [CommunitySafetyController::class, 'myContent']);
Route::post('/community/students/{student}/authorization', [CommunitySafetyController::class, 'authorizeStudent']);
Route::delete('/community/students/{student}/authorization', [CommunitySafetyController::class, 'revokeStudentAuthorization']);
```

Resolve `target_id` only after applying current audience visibility into readonly `ReportTarget::__construct(public string $type, public ?CommunityPost $post, public ?CommunityComment $comment, public User $reportedUser)`. Snapshot body and media metadata inside the report transaction. Severe categories set hidden/quarantined state, place the report under evidence hold, and append `auto_quarantined`; audit failure rolls back all state changes.

- [ ] **Step 4: Run focused backend regression and route loading**

Run focused tests, `artisan route:list --path=api/v1/community`, and Pint. Expected: all PASS and no unauthenticated mutation route.

- [ ] **Step 5: Commit the report/block slice**

```powershell
git add -- backend/app/Services/Community/CommunityModerationService.php backend/app/Services/Community/ReportTarget.php backend/app/Services/Community/CommunityAccessService.php backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php backend/app/Http/Controllers/Api/V1/CommunityController.php backend/routes/api.php backend/tests/Feature/CommunityReportAndBlockApiTest.php
git commit -m "feat: add Community reporting and blocking"
```

### Task 4: School Queue, Platform Escalation, Restrictions, and Appeals

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/CommunityModerationController.php`
- Create: `backend/app/Http/Controllers/Api/V1/PlatformCommunityModerationController.php`
- Modify: `backend/app/Services/Community/CommunityModerationService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/CommunityModerationQueueApiTest.php`
- Test: `backend/tests/Feature/CommunityAppealApiTest.php`

**Interfaces:**
- Produces school queue/detail/SLA endpoints protected by `community.moderate`.
- Produces platform summary/severe detail/intervention endpoints protected by `community.moderate_platform`.
- Produces `reviewReport(...)`, `applyRestriction(...)`, `submitAppeal(...)`, and `decideAppeal(...)` state transitions.

- [ ] **Step 1: Write failing queue and appeal tests**

Cover same-school queue, platform aggregate, explicit severe detail access and access logging, ordinary cross-tenant content absence, required reasons, valid transition matrix, restriction scope/expiry, unrelated module access, media release only after approval, rejected media remaining quarantined, evidence-hold preservation, one appeal, and different-reviewer enforcement.

```php
$this->actingAs($originalModerator)
    ->postJson("http://localhost/api/v1/admin/community-appeals/{$appeal->id}/decision", [
        'decision' => 'upheld', 'reason' => 'Reviewed evidence.',
    ])->assertUnprocessable()->assertJsonValidationErrors('reviewer');
```

- [ ] **Step 2: Run both focused tests and confirm RED**

Run the two test files directly with PHPUnit.

- [ ] **Step 3: Implement queue and state transitions**

School queue queries always begin with resolved `tenant_id` and `school_id`. Platform list returns counts/severity/deadline metadata; case detail requires an explicit severe/escalated case and logs access. Each decision locks the report/content/restriction rows, validates the transition, writes an append-only action, sends a recipient-scoped notification, and persists the audit event in one transaction.

Add exact route groups:

```php
Route::prefix('admin/community-moderation')->middleware('permission:community.moderate')->group(function (): void {
    Route::get('/reports', [CommunityModerationController::class, 'index']);
    Route::get('/reports/{communityReport}', [CommunityModerationController::class, 'show']);
    Route::post('/reports/{communityReport}/decision', [CommunityModerationController::class, 'decide']);
    Route::post('/users/{user}/restrictions', [CommunityModerationController::class, 'restrict']);
    Route::delete('/restrictions/{communityUserRestriction}', [CommunityModerationController::class, 'revokeRestriction']);
    Route::post('/appeals/{communityAppeal}/decision', [CommunityModerationController::class, 'decideAppeal']);
});
Route::post('/community/appeals', [CommunitySafetyController::class, 'submitAppeal']);
Route::get('/community/appeals/mine', [CommunitySafetyController::class, 'myAppeals']);
```

Platform summary/detail/intervention routes live under the existing platform group and each uses `permission:community.moderate_platform`.

Community restrictions use scopes `comment`, `publish`, `media`, or `all`; they never alter attendance, finance, assessment, schedule, or account status.

- [ ] **Step 4: Run focused tests, Community regression, routes, and Pint**

Expected: all PASS; school moderator cross-school tests return 403; platform endpoints deny School Admin.

- [ ] **Step 5: Commit the moderation workflow**

```powershell
git add -- backend/app/Http/Controllers/Api/V1/CommunityModerationController.php backend/app/Http/Controllers/Api/V1/PlatformCommunityModerationController.php backend/app/Http/Controllers/Api/V1/CommunitySafetyController.php backend/app/Services/Community/CommunityModerationService.php backend/routes/api.php backend/tests/Feature/CommunityModerationQueueApiTest.php backend/tests/Feature/CommunityAppealApiTest.php
git commit -m "feat: add UGC review and appeals workflow"
```

### Task 5: App Policy, Report, Block, Pending Content, and Safety Centre UX

**Files:**
- Create: `app/src/features/community-safety/CommunityPolicyGate.tsx`
- Create: `app/src/features/community-safety/CommunitySafetyMenu.tsx`
- Create: `app/src/features/community-safety/CommunitySafetyCentre.tsx`
- Create: `app/src/features/community-safety/CommunitySafety.css`
- Modify: `app/src/api/portalApi.ts`
- Modify: `app/src/components/CommunityFeed.tsx`
- Modify: `app/src/components/ParentPortalView.tsx`
- Modify: `app/src/components/StudentPortalView.tsx`
- Modify: `app/src/components/TeacherPortalView.tsx`
- Test: `app/src/features/community-safety/CommunitySafety.test.tsx`

**Interfaces:**
- Typed client methods mirror Task 3/4 App endpoints and never accept tenant/school IDs.
- `CommunitySafetyMenu` receives only response-provided `can_report_content`, `can_report_user`, and author ID.

- [ ] **Step 1: Write failing App tests**

Test first-contribution policy gate, Student safety/adult-authorization message, separate report-content/report-user/block labels, reason submission, immediate blocked removal, My Reports privacy, unblock, pending/rejected author state, appeal entry, and API errors.

```tsx
await user.click(screen.getByRole('button', { name: 'Report content' }))
await user.click(screen.getByRole('radio', { name: 'Bullying or harassment' }))
await user.click(screen.getByRole('button', { name: 'Submit report' }))
expect(api.reportCommunityContent).toHaveBeenCalledWith(post.id, 'bullying_harassment', '')
```

- [ ] **Step 2: Run the focused Vitest file and confirm RED**

Run: `npm.cmd test -- --run src/features/community-safety/CommunitySafety.test.tsx` from `app/`.

- [ ] **Step 3: Implement accessible mobile-first UX**

Use a clearly labelled overflow menu; do not combine report and block into one action. Report confirmation explains emergency limitations. Block confirmation states that only Community content is affected. Pending content is separate from the public feed and labelled “Only you and moderators can see this.” Add My Reports, Blocked Users, Appeals, Community Standards, Child Safety, Privacy, and Contact Support to role More/Profile pages.

- [ ] **Step 4: Run App test, lint, and build**

Run from `app/`: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Expected: all PASS, no Oxlint warnings, TypeScript clean.

- [ ] **Step 5: Commit the App slice**

```powershell
git add -- app/src/api/portalApi.ts app/src/components/CommunityFeed.tsx app/src/components/ParentPortalView.tsx app/src/components/StudentPortalView.tsx app/src/components/TeacherPortalView.tsx app/src/features/community-safety/CommunityPolicyGate.tsx app/src/features/community-safety/CommunitySafetyMenu.tsx app/src/features/community-safety/CommunitySafetyCentre.tsx app/src/features/community-safety/CommunitySafety.css app/src/features/community-safety/CommunitySafety.test.tsx
git commit -m "feat: add in-app UGC safety controls"
```

### Task 6: Admin UGC Moderation Workspace

**Files:**
- Create: `frontend/src/features/moderation/UgcModerationPage.tsx`
- Create: `frontend/src/features/moderation/moderationApi.ts`
- Create: `frontend/src/features/moderation/UgcModerationPage.css`
- Create: `frontend/src/features/moderation/UgcModerationPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- `moderationApi` exposes school queue/detail/action/appeal methods and platform summary/detail methods.
- The page mode derives from backend permissions; it never accepts a tenant ID from a normal School Admin.

- [ ] **Step 1: Write failing Admin tests**

Cover permission-filtered navigation, school queue cards, severe/SLA ordering, overdue indicator, evidence display, required reason, approve/reject/hide/restrict/escalate actions, reporter privacy, platform aggregate, explicit severe detail, and different-reviewer appeal block.

- [ ] **Step 2: Run focused Admin test and confirm RED**

Run: `npm.cmd test -- --run src/features/moderation/UgcModerationPage.test.tsx` from `frontend/`.

- [ ] **Step 3: Implement the workspace**

Keep queue, case detail, decision form, restrictions, and appeal review in the new feature directory. `App.tsx` only adds permission-aware navigation and mounts the page. Require a selected reason before mutation; show server validation without weakening backend enforcement. The parent layout owns a 16px gap between case cards/panels.

- [ ] **Step 4: Run Admin test, lint, and build**

Run from `frontend/`: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Existing nine Fast Refresh warnings may remain; no new warning is accepted.

- [ ] **Step 5: Commit the Admin slice**

```powershell
git add -- frontend/src/App.tsx frontend/src/features/moderation/UgcModerationPage.tsx frontend/src/features/moderation/moderationApi.ts frontend/src/features/moderation/UgcModerationPage.css frontend/src/features/moderation/UgcModerationPage.test.tsx
git commit -m "feat: add Admin UGC moderation workspace"
```

### Task 7: Public Policy Pages, Support Contract, and Store-Readiness Check

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/PublicCommunityPolicyController.php`
- Create: `backend/app/Console/Commands/CheckStoreReadiness.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/PublicCommunityPolicyApiTest.php`
- Create: `backend/tests/Feature/StoreReadinessCommandTest.php`
- Create: `app/src/features/community-safety/PublicPolicyPage.tsx`
- Modify: `app/src/App.tsx`
- Test: `app/src/features/community-safety/PublicPolicyPage.test.tsx`
- Modify: `deploy/env/production.env.example`

**Interfaces:**
- Public GET endpoint returns effective policy sections and non-secret support metadata without authentication.
- `php artisan app:store-readiness` returns non-zero when public URLs, platform support, child-safety contact, or an effective standards version is missing.

- [ ] **Step 1: Write failing public-page and readiness tests**

Assert no-login access, tenant branding support display, explicit CSAE/CSAM prohibitions, App/developer name presence, no private case data, missing-config failure, and configured success.

```php
$this->artisan('app:store-readiness')
    ->expectsOutputToContain('CHILD_SAFETY_CONTACT_EMAIL is missing')
    ->assertFailed();
```

- [ ] **Step 2: Run focused Backend/App tests and confirm RED**

Run the two backend files and the public-page Vitest file.

- [ ] **Step 3: Implement public policy delivery and readiness command**

Support `/legal/terms`, `/legal/privacy`, `/legal/community-standards`, `/legal/child-safety`, and `/legal/support` before the App authentication check. Render structured API content without adding a Markdown/HTML package. Use only escaped React text. `deploy/env/production.env.example` documents keys but contains no real person, credential, or false claim.

- [ ] **Step 4: Run focused tests, link checks, lint, and builds**

Expected: public pages render without session; readiness fails on missing production contact and passes only under explicit test configuration.

- [ ] **Step 5: Commit public compliance surfaces**

```powershell
git add -- backend/app/Http/Controllers/Api/V1/PublicCommunityPolicyController.php backend/app/Console/Commands/CheckStoreReadiness.php backend/routes/api.php backend/tests/Feature/PublicCommunityPolicyApiTest.php backend/tests/Feature/StoreReadinessCommandTest.php app/src/features/community-safety/PublicPolicyPage.tsx app/src/features/community-safety/PublicPolicyPage.test.tsx app/src/App.tsx deploy/env/production.env.example
git commit -m "feat: add public Community safety policies"
```

### Task 8: Canonical Documentation, Qualification, MariaDB, and Publication

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/current-status.md`
- Modify: `docs/database.md`
- Modify: `docs/permissions.md`
- Modify: `docs/testing-and-release.md`
- Create: `docs/store-submission-ugc-checklist.md`

**Interfaces:**
- Produces honest current-status and store-operator evidence; does not claim store approval or legal completion.

- [ ] **Step 1: Update canonical documentation and submission checklist**

Document exact lifecycle/statuses, permissions, adult authorization, report/block/appeal behavior, SLA targets, public URLs, support/child-safety deployment gates, data retention caveat, and external operational items. Checklist includes reviewer accounts, screenshot paths, Play declarations, Apple review notes, real contact confirmation, legal reporting procedure, and moderator staffing.

- [ ] **Step 2: Run full local qualification**

Backend:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api
```

Admin and App, separately: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

- [ ] **Step 3: Run disposable SQLite and MariaDB lifecycle plus focused MariaDB tests**

Run fresh migrate, rollback of the new migration, and re-migrate on an isolated SQLite file and an explicitly created disposable XAMPP MariaDB database. Run all Community moderation feature tests against MariaDB. Drop only the named disposable database after verifying its exact name.

- [ ] **Step 4: Review diff and security evidence**

Run `git diff --check origin/master...HEAD`, inspect every changed filename, confirm no generated database/media/build artifact, scan for secret-bearing filenames/signatures, verify public links, and record known warnings/skips accurately.

- [ ] **Step 5: Commit documentation and qualify GitHub publication**

```powershell
git add -- README.md docs/architecture.md docs/business-rules.md docs/current-status.md docs/database.md docs/permissions.md docs/testing-and-release.md docs/store-submission-ugc-checklist.md
git commit -m "docs: document UGC moderation operations"
```

Push/create/merge only under explicit GitHub authorization. Trigger exact-commit Full qualification before merge and wait for the post-merge Release candidate. Store submission remains blocked until real contact/legal/operator checklist items are confirmed.
