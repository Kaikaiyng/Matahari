# School Updates Final-Review Fixes Report

**Date:** 2026-08-25

**Branch:** `feat/school-updates`

**Review base:** `bc6a092`
**Scope:** All nine required final-review fixes and the related minor fixes in `.superpowers/sdd/final-review-fixes-brief.md`.

## Outcome

All requested corrections are implemented without changing the tenant-selected school boundary, weakening backend permissions, deleting historical records, bypassing transactional audit, or adding a migration.

1. Parent and Student Post Report controls render independently from update management controls. Their App persona still never exposes edit, withdraw, or hide actions.
2. The App report contract is typed and rendered as exactly `incorrect`, `outdated`, `inappropriate`, or `other`; details are capped at 1,000 characters; backend field validation is displayed; serialized JSON is covered.
3. Effective same-school `community.publish` is the sole publishing authority after tenant/school validation. It permits whole-school and any active same-school class audience without an extra position or Teaching Assignment rule. Explicit permission denial still fails at the backend.
4. Visibility and delivery are separated. Moderators see all same-school Updates, while class delivery is limited to active enrolled Students, Parents linked to active Students, and assigned Teachers. Whole-school delivery uses active tenant/school members with `community.view` and a Teacher, Parent, active Student, or effective Teacher App persona; platform-only and non-App Admin identities are excluded.
5. Historical pending/rejected posts remain discoverable to their authors and managers, but authors cannot edit them into publication. Managers receive an explicit Review and publish UI and a controlled transition whose old/new status is audited. Pending/rejected statuses are labeled accurately and do not expose Likes.
6. Historical Community restrictions remain stored/auditable but no longer block active School Update text or media publication.
7. An author may withdraw without entering a reason even when the author also moderates. A manager acting on another author must provide a reason. Open reports resolve with distinct `author_withdrawn` or `manager_withdrawn` actions/codes.
8. Backend Post Report responses normalize a partial post snapshot's missing `media` to an empty array, and Admin also handles that field defensively.
9. Audience eligibility is set-based rather than resolving permissions once per candidate user. A 30-non-App-user regression keeps whole-school preview at no more than 12 queries.

Related minor fixes use `context_json.post_id` to reload and focus the authorized Update, render feed load errors before the empty state, identify rejected image filename/type/10 MB limit, display composer validation fields, and reconcile canonical School Updates versus historical social-workflow documentation.

## TDD Evidence

Tests were changed before production code and run to capture the intended failures.

- Existing focused baseline, backend: `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\CommunityReportAndBlockApiTest.php tests\Feature\CommunityModerationQueueApiTest.php` — exit 0; 35 tests, 197 assertions.
- Existing focused baseline, App: `npm.cmd test -- --run src/components/MobileShell.test.tsx src/features/community-safety/CommunitySafety.test.tsx` — exit 0; 2 files, 27 tests.
- Existing focused baseline, Admin: `npm.cmd test -- --run src/features/moderation/UgcModerationPage.test.tsx` — exit 0; 1 file, 3 tests.
- RED backend: `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\CommunityModerationQueueApiTest.php` — exit 1; 34 tests, 25 passed, 9 failed, 151 assertions. Failures reproduced publish scope, inactive recipient, moderator delivery, invalid whole-school personas/N+1, pending edit, restriction blocking, author-manager reason, manager resolution code, and missing snapshot media.
- RED App: `npm.cmd test -- --run src/components/MobileShell.test.tsx src/features/community-safety/CommunitySafety.test.tsx src/api/portalApi.test.ts` — exit 1; 3 files, 1 passed/2 failed; 24 tests passed/10 failed. Failures reproduced report placement/reasons/errors, feed error/status, composer errors/files, withdrawal UI, and notification post targeting. The new serialization contract test passed while the UI regressions remained red.
- RED Admin: `npm.cmd test -- --run src/features/moderation/UgcModerationPage.test.tsx` — exit 1; 1 file, 3 passed/1 failed. The partial snapshot reproduced `Cannot read properties of undefined (reading 'map')`.

## Final Validation

### Backend

- `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\CommunityModerationQueueApiTest.php` — exit 0; 34 tests, 187 assertions.
- `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\CommunityApiTest.php tests\Feature\CommunityReportAndBlockApiTest.php tests\Feature\CommunityModerationQueueApiTest.php tests\Feature\UserAbilityAuthorizationTest.php tests\Feature\Audit\BusinessAuditIntegrationTest.php tests\Feature\Audit\AuditLogApiTest.php` — exit 0; 52 tests, 307 assertions.
- `..\tools\php\php-local.cmd vendor\bin\phpunit` — exit 0; 389 discovered, 377 passed, 12 existing MariaDB-gated skips, 2,122 assertions.
- `..\tools\php\php-local.cmd vendor\bin\pint --test` — exit 0 after Pint formatted the new test file; passed.
- `..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor` — exit 0; 151 routes loaded.

One first attempt at the broader focused command referenced nonexistent `tests\Feature\AuditApiTest.php` and exited 1 before the test run. It was corrected to the repository's actual Audit test paths shown above; the corrected focused and full suites passed.

### Community App

- `npm.cmd test -- --run src/components/MobileShell.test.tsx src/features/community-safety/CommunitySafety.test.tsx src/api/portalApi.test.ts` — exit 0; 3 files, 34 tests.
- `npm.cmd test` — exit 0; 9 files, 53 tests.
- `npm.cmd run lint` — exit 0; no warnings reported.
- `npm.cmd run build` — exit 0; TypeScript project build and Vite production build passed.

### Admin

- `npm.cmd test -- --run src/features/moderation/UgcModerationPage.test.tsx` — exit 0; 1 file, 4 tests.
- `npm.cmd test` — exit 0; 18 files, 187 tests.
- `npm.cmd run lint` — exit 0; nine existing `CalendarViews.tsx` Fast Refresh warnings, no new warning.
- `npm.cmd run build` — exit 0; TypeScript project build and Vite production build passed.

### Repository checks

- `git diff --check` — exit 0.
- Credential-marker scan of the tracked diff (`AWS_`, private-key headers, API/client/access secret markers) — no matches.
- Complete diff and changed-file list reviewed against all nine required findings and related minor fixes.
- No migration was added or edited; a schema lifecycle was therefore not run for this correction set.
- No dependency or lockfile changed, and no generated `dist` artifact is staged.

## Changed Files

- Backend behavior: `CommunityController.php`, `CommunityModerationController.php`, `CommunityAccessService.php`, `CommunityService.php`, `SchoolUpdateAudienceResolver.php`.
- Backend regressions: `CommunityApiTest.php`, `CommunityModerationQueueApiTest.php`.
- App behavior/contracts: `portalApi.ts`, `CommunityFeed.tsx`, `MobileShell.tsx`, `NotificationCentre.tsx`, `TeacherPortalView.tsx`, `CommunitySafetyMenu.tsx`.
- App regressions: `portalApi.test.ts`, `MobileShell.test.tsx`, `CommunitySafety.test.tsx`.
- Admin defensive contract: `moderationApi.ts`, `UgcModerationPage.tsx`, `UgcModerationPage.test.tsx`.
- Canonical documentation: `docs/architecture.md`, `docs/business-rules.md`, `docs/current-status.md`, `docs/permissions.md`.

## Limitations and Not Verified

- Disposable MariaDB behavior, including JSON expressions and the set-based audience query on MariaDB, is **Not verified** in this correction run. The 12 MariaDB-gated PHPUnit cases remained skipped in the default SQLite suite.
- Browser/manual UAT is **Not verified**.
- Real-device/native App behavior is **Not verified**.
- Attendance device or other hardware behavior is **Not verified** and was outside this change.
- No migration changed, so no migration/rollback claim is made for these fixes.
- Production load/concurrency behavior remains **Not verified**. The added query-count regression proves bounded SQLite query count for the representative test population, not a production performance benchmark.
