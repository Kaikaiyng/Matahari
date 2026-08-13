# Current Status

**Snapshot date:** 2026-08-13

**Inspected Phase A implementation commit:** `ecaa0a1f177292ae99c9338e255a1f93312971f5`

**Default branch:** `master`

**Current merged delivery:** `ddd7e193179129be35f7a2b1c408eb809734f8d4` (`Merge project-wide documentation update`)

**Overall status:** MIS-branded administration-finance demo MVP with Phase A foundations, separate Admin and multi-role App clients, live Community, daily Attendance, Assessment publication, Parent Finance reads, and class Schedule; formal Quiz, native/store delivery, and production operations remain incomplete

The Phase A commit above remains in the delivery history and is now included in `master`. The earlier white-label feature was delivered through [pull request #8](https://github.com/Kaikaiyng/Matahari/pull/8) and merged into `master` as `2f4c6bd199a7fae149658d3993aba370203746de` on 2026-08-04.

## Runtime Demo Identity

The runtime demonstration is presented as the **Matahari International School** administration system. A fresh, intentional reset of the ignored disposable SQLite demo database seeds the MIS tenant, `MIS` identifiers, and explicit Admin/Teacher/Parent/Student demo accounts; printable receipts remain marked as samples and are not valid receipts.

The reset command never runs automatically and must not be adapted to a database containing valuable data. MIS branding applies to fresh demo data and presentation; it does not rename existing tenants or rewrite historical student, invoice, payment, or receipt identifiers.

## 2026-08-12 MIS Demo and Portal Review

- The returned ZIP was reviewed on branch `feature/mis-demo-mobile-review` against Phase A merge `a69d32b`.
- Backend PHPUnit: 249 tests discovered, 241 passed, 8 MariaDB-only skipped, 1,287 assertions.
- Frontend Vitest: 16 files and 174 tests passed. Oxlint exited 0 with 9 pre-existing Fast Refresh organization warnings in `CalendarViews.tsx`; TypeScript/Vite production build passed with 91 modules transformed.
- Pint formatting/check, API route loading (70 routes), and repository diff checks passed.
- SQLite fresh migration with seed, repeated seed, latest rollback, re-migration, and API route loading passed on an explicit disposable database.
- **Not verified in this environment:** MariaDB lifecycle/FK/index inspection. No local MariaDB server or Docker executable was available; SQLite results are not presented as MariaDB proof.

## 2026-08-12 Admin/App Split

- Admin remains in `frontend/`; the independent mobile-first multi-role Community App is in `app/`. Both use the same Laravel API/database while keeping separate builds, intended domains, and role gates.
- Admin Vitest: 15 files and 169 tests passed. Oxlint exited 0 with 9 existing Fast Refresh organization warnings; the production build passed with 83 modules transformed.
- App Vitest: 3 files and 10 tests passed. Oxlint and the production build passed with 28 modules transformed.
- Backend full regression: 250 tests discovered, 242 passed, 8 opt-in MariaDB tests skipped, and 1,292 assertions. Pint and 70-route API loading passed. The focused two-origin CORS contract passed with 5 assertions.
- Deployment contracts: 18 tests passed, covering both compiled clients in the release manifest and separate Admin/App Nginx services pointing at the shared backend.
- Local HTTP checks passed for Admin `http://localhost:5173`, App `http://127.0.0.1:5174`, and both clients' proxied `/api/deployment-info` endpoint.
- No migration or database schema changed in this split. MariaDB lifecycle was therefore not rerun; the earlier Phase A MariaDB evidence remains the applicable schema result.

## 2026-08-12 Community App Direction

The App is approved as a private school-community product: a relationship-scoped Feed with Teacher/Staff publishing, reactions and controlled comments; daily Attendance on a general session schema; published Assessment results; formal Teacher-assigned Quiz plus separate Student Practice Quiz; and read-only Parent Finance without a payment interface.

Merged delivery `816ea1d` redesigns the Admin staff login and all App role surfaces. Daily Attendance is connected end to end: assigned Teachers load current rosters, submit `present`, `late`, `absent`, or `excused`, and must provide a reason for corrections; authorized Parents and the linked Student can read the resulting record. Attendance writes and their audit events share one transaction. Community persistence/media, Assessment results, formal Quiz, Practice Quiz generation, and Schedule remain clearly labelled UI previews rather than implemented backend modules. See [MIS App Product Specification](mobile-app-product-spec.md) and the root [Design System](../DESIGN.md).

## 2026-08-13 Community App Data Foundation

- The App/database comparison found that identity/RBAC, guardian/student links, enrolments, teaching assignments, notifications, read-only Parent Finance, Attendance, and Calendar already reuse the authoritative backend data.
- Eighteen additive tables now establish storage for Community content, academic terms/Assessments/results, and formal/Practice Quiz. The approved class targets, direct student targets, materialized Quiz recipients, shared `multiple_choice`/`true_false` option storage, result publication state, revision links, attempts, and answers are represented.
- The migration does not seed or infer posts, terms, dates, results, audiences, recipients, or Quiz attempts and does not alter current student, guardian, finance, payment, receipt, or role rows.
- This is schema only. Community media/publishing, result publication, Quiz generation/delivery/scoring, authorization services, mutation audits, and APIs remain unimplemented; the App screens remain previews until those slices are connected.

## 2026-08-13 Community Workflow

- Community publishing and reading are connected to the shared Laravel API and database. School/Super Admin may publish school-wide; Teachers may publish only to classes covered by current Teaching Assignments; Parent and Student feeds resolve linked current enrolments.
- Private photos, short videos, and PDFs are stored outside the public web root and downloaded only after the containing post audience is authorized. Appreciations, controlled comments, owner/author comment removal, Staff post hiding with reasons, and mutation audit events are implemented.
- Direct-student authoring UI, event-post composition, reports, malware scanning, retention automation, and a complete desktop Admin moderation workspace remain incomplete production gates.

## 2026-08-13 Assessment Workflow

- School/Super Admin can manage Academic Terms without inferred dates. Teachers create assessments only for current class/year/subject Teaching Assignments, save draft scores, and explicitly publish only after every currently enrolled target student has a score.
- Parent reads require the active reviewed guardian academic capability; Student reads resolve only the linked self record. Both surfaces expose only published results. No grade formula, weighting, ranking, or historical result is inferred.
- Assessment create/result/publication mutations and audit events share transactions. Published results fail closed against silent rewriting; an approved correction/version workflow and a broader desktop Admin assessment UI remain future work.

## 2026-08-13 Schedule Workflow

- Additive recurring class Schedule storage is scoped to school, academic year, and class; optional subject/Teaching Assignment references must match that scope.
- School Admin creates drafts and explicitly publishes them from the Admin Panel. Schedule mutations and audit events share transactions.
- Students see published entries for their current enrolment and due dates from published Assessments. Guardians use an active reviewed link with academic access.
- Existing internal Calendar records remain private to its existing permission boundary and are not automatically exposed to families.
- Local SQLite verification: all 61 tables migrated from fresh; the three new migrations rolled back in reverse FK order; existing seeded school/student data remained; re-migration returned to 61 tables. The focused schema suite passed 3 tests/24 assertions, and the backend regression passed 250 tests with 8 existing MariaDB-only skips and 1,339 assertions before the non-SQLite inspection test was added.
- GitHub [Full qualification run 31661265923](https://github.com/Kaikaiyng/Matahari/actions/runs/31661265923) passed on exact commit `f047c2d`: backend 250 passed/10 skipped/1,339 assertions, disposable MariaDB 11.4 full migrate/rollback/re-migrate, and 2 dedicated FK/index inspection tests with 59 assertions. Pint, 74 API routes, dependency audits, Admin 169 tests/build, App 16 tests/build, and 18 deployment tests passed. Admin lint retained the 9 known Fast Refresh warnings; App lint was clean.

## 2026-08-13 Role and Client Boundary Checkpoint

- Admin Panel access is limited to Super Admin, School Admin, Finance, and CEO. Teacher-only, Parent-only, and Student-only accounts are rejected by the Admin client; backend route permissions remain authoritative.
- The Community App admits Parent, Student, Teacher, and derived Staff personas. Finance-only and CEO-only accounts do not receive App personas. Multi-role App users may switch only among personas derived from their stored roles.
- Teacher Classes loads current teaching assignments and each assignment's scoped roster count from the same protected APIs used by Attendance. It does not expose unrelated classes or students.
- Parent Finance no longer embeds a demo balance or hard-codes `2026`. The parent summary includes the child's explicitly stored current enrolment academic year, and finance queries stop when no current year exists.
- Quiz, Schedule, Assessment/result examples, pending settings, and future moderation actions are explicitly labelled and non-actionable until their APIs exist. Receipt rows are viewing-only rather than fake download controls.
- Local checkpoint regression: backend 250 passed/10 MariaDB-only skipped/1,340 assertions; Admin 170 tests; App 19 tests; Pint, both lints, both builds, and 74 API routes passed. Admin retains the 9 known Fast Refresh warnings. SQLite fresh/seed created 61 tables, rolling back the three data-foundation migrations left 43 tables and preserved the school row, and re-migration restored 61 tables.

Later school-specific branding requires explicit approval and a controlled update to the presentation configuration and, if needed, a fresh disposable demo seed. It must not rename existing tenant data or rewrite financial history.

## 2026-08-13 Mobile App Visual Refinement

- The App shell now uses a compact MIS Community header and a role-aware floating liquid-glass navigation capsule. The active destination shows icon and label; inactive destinations retain icons with accessible names.
- Parent, Student, Teacher, and authorized Staff receive distinct five-item navigation sets. Sign out moved from the persistent header into each role's More/Profile page.
- Feed and record surfaces use calmer phone-first spacing, fewer nested borders, stronger content hierarchy, and at least 44px interactive targets. The Feed remains a clearly labelled preview where publishing is not connected.
- Automated browser checks covered 39 representative role/page/viewport combinations at 360x800, 390x844, and 430x932. No horizontal overflow or undersized visible interactive target remained after correction.
- The browser helper's packaged Windows server lacked its Playwright dependency; validation used a cached Playwright runner with installed Chrome and did not add a project dependency.
- App validation passed with 3 files and 16 tests, clean Oxlint, and a TypeScript/Vite production build with 76 transformed modules. Existing Admin regression passed with 15 files and 169 tests, Oxlint exit 0 with the 9 known Fast Refresh organization warnings, and an 83-module production build.
- Backend regression passed with 255 tests discovered, 247 passed, 8 opt-in MariaDB tests skipped, and 1,314 assertions. Pint passed and 74 API routes loaded. No backend schema changed in this visual-refinement branch, so a new MariaDB lifecycle was not run for this branch.

## 2026-08-13 Project-wide Documentation Reconciliation

- Root, Admin, App, Backend, canonical, operator, UAT, deployment, workflow, and historical-status documentation was reconciled against merged `master` at `816ea1d`.
- At that documentation checkpoint, current references described the separate Admin and multi-role Community App domains, shared Laravel/database boundary, implemented daily Attendance, 74-route/43-table inventory, and preview-versus-live module boundaries. The later data-foundation migration increases the current schema inventory to 61 tables without adding routes.
- Historical plans, dated evidence, and the FigJam workflow snapshot remain preserved as history and are explicitly labelled so they are not mistaken for current completion claims.
- Relative links across all tracked Markdown files, diff whitespace, and secret-bearing filename/content checks passed for the documentation change.

## Technology Snapshot

- Backend manifest: PHP `^8.3` and Laravel Framework `^13.8`; the resolved lockfile version is Laravel `13.17.0`.
- Validation runtime: PHP `8.4.21`.
- Admin and App manifests: React `19.2.7`, TypeScript `~6.0.2`, and Vite `^8.1.0`.
- Session-based authentication and a MariaDB/MySQL-compatible production direction; SQLite is used for the local demo and default tests.

The confirmed earlier technology direction named Laravel 10, but this repository is already on Laravel 13. This is a verified implementation difference, not a pending upgrade.

## Implemented Features

- Phase A academic foundation: additive academic-year, class-enrolment, subject, teaching-assignment, and nullable parent/student portal-link schema; `/api/v1` school context; scoped admin/teacher APIs; teacher assignment access; and transactional audit events.
- Teacher, parent, and student role definitions coexist with the existing many-to-many RBAC. Existing Admin/Finance assignments are preserved, and foundation role management changes only those three new roles.
- School Admin/Super Admin can create minimum active foundation accounts with teacher/parent/student roles and can later change only those foundation roles. Full account lifecycle and password recovery remain incomplete.

- Session username authentication, CSRF-protected mutations, username-plus-IP login throttling, logout, `/me`, active-user request checks, roles, and permissions.
- Permission-filtered navigation backed by authoritative route permissions.
- Student list/search/filter/create/detail/backend update/status, with transactional audit events.
- Read-only classes and active-student rosters.
- Fee Agreement create/history/show/supersede, item/discount snapshots, current-version uniqueness, cross-year validation, and transactional audit events.
- Fee Record preview/activation/manual charges/outstanding/summary/category-month ledger, scheduled-charge uniqueness, unsupported-discount and preview-confirmation fail-closed gates, and transactional activation/manual-charge audit events.
- Payment record/allocation/verification/void reversal/history with tenant-owned input validation and transactional audit events.
- Receipt issue/snapshot/display/browser print/void/regenerate/history with stable sequence behavior and transactional audit events.
- School calendar CRUD.
- Calendar Year, Month, and Week views, including a 12-month overview, upcoming-event month layout, a school-hours week timeline, and school-scoped active-staff participant multi-select.
- Settings page for the current single-school context and signed-in account access summary.
- Backend permission and school-scope enforcement for the dashboard and legacy monthly invoice generation.
- Secure audit schema/logger/sanitizer/request IDs/model immutability, best-effort authentication audit, read-only Super Admin API, and Audit Trail frontend.
- Responsive admin UI and temporary local/public demo tooling.

## Partially Implemented

- The seeded Super Admin currently defaults to the single seeded school. Multi-school selection remains planned and is not exposed in the frontend yet.
- Student profile update exists only on the backend; parent records are read-only in the real Student Detail flow.
- Fee item catalogue has a read API; the top-level page is static and management is absent.
- Discount definitions are stored as snapshots, but approved formulas and eligibility rules do not exist. Charge preview/activation is blocked for non-zero discounts.
- Payments and receipts work inside Student Detail; there are no independent top-level modules.
- Legacy invoices remain separate from the implemented Fee Record ledger and have no frontend workflow.
- Audit covers implemented critical authentication, student, agreement, Fee Record, payment, and receipt actions. Generic correction, recovery, and export are not implemented.

## Known Incomplete Features

- Existing guardian links remain `unreviewed` with nullable access flags, and no live parent/student user association or enrolment history is inferred. Portal activation and production backfill require a separately approved workflow.
- An independent `app/` web workspace, user-scoped notifications, Parent/Student self endpoints, Teacher daily Attendance, read-only guardian finance queries, role-aware navigation, and preview Community content now exist. Admin remains in `frontend/`; both clients share the backend/database but have independent local ports, builds, and intended domains. This is not completed production Parent Finance. Community/Assessment/Quiz schemas exist, but their services and APIs do not. Payment reminders, Quiz delivery/scoring, AI, Firebase, Capacitor, native authentication, and native packaging remain unimplemented.

- Parent CRUD, fee catalogue management, user/role management, password reset, and a global school selector.
- Reports beyond Fee Record views, exports, statements, reminders, parent portal, and server-side PDF.
- Refund, credit, overpayment, write-off, and approved correction/recovery workflows.
- Full academic ERP modules.
- Stable production deployment, automatic staging delivery, production promotion, monitoring, backup scheduling, and restore tooling. Repository CI/runtime configuration exists but external execution remains incomplete.

## Security and Operational Concerns

The previously confirmed dashboard/invoice school-scope defects, missing CSRF, missing login throttle, inactive existing sessions, and missing critical business audit integration have been corrected and covered by focused tests.

Remaining concerns are operational or planned-scope limitations:

1. Seeded demo accounts use a known development password and must never be deployed unchanged.
2. HTTPS termination, secure-cookie flags, proxy trust, CORS, shared session/rate-limit storage, and multi-instance behavior require environment-specific verification.
3. Audit append-only protection exists at the Eloquent model layer; raw SQL or privileged database users require least-privilege grants and database operations controls.
4. No production secret-management, CI, monitoring, alerting, backup, restore, or incident-response implementation is present.
5. Guardian data is returned with Student Detail under `students.view`; the intended independent role of `parents.view` is **Needs confirmation**.

No item above is evidence of production readiness. They must be addressed in a real deployment plan.

## Financial-Integrity Status

Implemented safeguards include:

- one current Fee Agreement per school/student/year and one scheduled charge per agreement item/month at database level;
- duplicate-data migration preflights that abort rather than alter ambiguous history;
- tenant-owned ID checks, distinct submitted IDs/months, four-digit year/date consistency, money scale/range validation, and percentage cap;
- rejection of superseding when charge history exists on or after the proposed effective month;
- rejection of discounted billing and unapproved preview-confirmation items;
- transactions, row locks, cent-based allocation equality, stable receipt sequencing, and required transactional audit inserts.

Remaining limitations:

- Approved discount formulas, stacking, eligibility, proration, and reassessment are not defined, so discounted billing is unavailable.
- No approved correction, refund, credit, overpayment, write-off, or reconciliation workflow exists.
- Legacy invoice/assignment paths and some reporting conversions still use PHP floating-point operations.
- Production concurrency/load behavior and recovery reconciliation are **Not verified**.

## Migration Concerns

- Historical migrations include data-destructive table rebuild/drop behavior, especially receipt-builder rollback.
- Username migration rollback cannot restore removed email/password-reset data.
- Many table-creation rollbacks delete financial history.
- The current-agreement/scheduled-charge migration deliberately fails when duplicate live data exists; deployment requires a reviewed data report and correction plan before retrying.
- The latest constraint migration has an implemented `down()` and focused SQLite and MariaDB lifecycle evidence recorded below.
- Production rollback safety, backups, and restoration are **Not verified**.

## Technical Debt

- `frontend/src/App.tsx` owns most state, API orchestration, and pages.
- No URL routing/deep links or shared server-state layer.
- Parent and fee catalogue top-level pages use static demo content.
- No pagination for major student and Fee Record summary queries; no formal scale tests or volume factories.
- Most status values are unconstrained strings.
- No project-level PHP static analysis, browser E2E suite, or performance suite. CI source now exists; current GitHub execution evidence must be checked separately.
- Supporting uppercase/historical documents may contain stale counts or pre-hardening descriptions; the canonical lowercase documents linked from the root README take precedence.

## Test Status

Phase A validation on 2026-08-12:

- Full backend PHPUnit: 242 tests total, 234 passed, 8 MariaDB-only skipped, and 1,254 assertions; exit 0.
- Phase A against disposable MariaDB 10.4.32: 17 tests and 103 assertions passed. The existing MariaDB group also passed independently with 8 tests and 33 assertions.
- SQLite and MariaDB fresh migration, rollback of all three Phase A migrations, and re-migration passed.
- The existing-data upgrade test passed with 12 assertions and confirmed that academic dates/history, identity associations, and guardian access are not inferred.
- MariaDB foreign-key and index inspection passed for nullable current-slot uniqueness, portal-user uniqueness, and the intended `RESTRICT`/`SET NULL` actions.
- Pint and API route loading passed; 59 API routes loaded.
- Frontend lint exited 0 with 9 pre-existing `react(only-export-components)` warnings. The TypeScript/Vite production build passed with 83 transformed modules.
- Frontend Vitest is **Not passed**: 160 tests passed and 8 failed across 15 files. The failures are existing branding-contract, navigation/finance expectation, and duplicate-control-query failures; Phase A has no frontend diff from its base. A fully green regression suite therefore cannot yet be claimed.

Complete scope and evidence are recorded in [Phase A Academic Foundation Delivery](phase-a-academic-foundation.md).

Focused hardening evidence completed before this documentation refresh includes:

- authentication/CSRF/session tests: 15 backend tests, 71 assertions; frontend API tests passed;
- school scope and legacy workflow tests: 20 backend tests, 92 assertions;
- financial request validation: 12 backend tests, 75 assertions;
- agreement/discount/preview gating: 21 backend tests, 132 assertions plus 12 frontend editor tests;
- financial database invariants: 23 backend tests, 135 assertions;
- payment/receipt/business audit group: 37 backend tests, 228 assertions;
- authentication audit: 16 backend tests, 83 assertions;
- audit API/immutability/permission: 9 backend tests, 65 assertions;
- Fee Record audit integration and related focused groups: 27 backend tests, 206 assertions;
- frontend lint and production build passed during focused work.

Final branch validation on 2026-08-03:

- `php artisan test`: 210 passed, 8 MariaDB-only tests skipped, 1,129 assertions; exit 0.
- `php artisan test --group=mariadb` on a disposable MariaDB 11.4.12 database: exit 0; the guarded group contains 8 tests and 33 assertions.
- SQLite and MariaDB `migrate:fresh --seed`, one-step rollback, and re-migration: all exit 0 against disposable databases.
- `php vendor/bin/pint --test`: exit 0.
- `php artisan route:list --path=api --except-vendor`: 38 API routes loaded; exit 0.
- `php artisan about --only=environment,drivers`: configuration loaded; exit 0.
- `npm.cmd test -- --run`: 12 files and 143 tests passed; exit 0.
- `npm.cmd run lint` and `npm.cmd run build`: exit 0; TypeScript and Vite production build completed.
- `npm.cmd ci`: 119 packages installed from the committed lockfile; exit 0.
- Real HTTP CSRF smoke: a tokenless login returned 419, `/api/csrf-cookie` returned 204, and the same invalid login with the cookie/header pair reached validation and returned 422.
- `npm.cmd audit --omit=dev --audit-level=moderate` and the complete-tree `npm.cmd audit --audit-level=moderate`: 0 vulnerabilities after updating PostCSS to 8.5.25 and Nano ID to 3.3.17 in the lockfile.
- Composer/PHP dependency advisory audit: **Not verified** because no Composer command was available. Existing locked dependencies and tests were used; this is a release-environment limitation.

The disposable MariaDB server used `--skip-grant-tables` solely to validate schema and application behavior without local credentials. This does not validate production accounts, grants, TLS, or authentication configuration.

White-label branch validation on 2026-08-04:

- `php artisan test --no-ansi`: 211 passed, 8 MariaDB-only tests skipped, and 1,131 assertions; exit 0.
- `php vendor/bin/pint --test`, `php artisan route:list --path=api --except-vendor`, and `php artisan about --only=environment,drivers`: exit 0; 38 API routes loaded.
- `npm.cmd test -- --run`: 14 files and 156 tests passed; exit 0. `npm.cmd run lint` and `npm.cmd run build` also exited 0; the production build transformed 73 modules.
- `npm.cmd audit --omit=dev --audit-level=moderate` and `npm.cmd audit --audit-level=moderate`: 0 vulnerabilities.
- Controller QA reset the ignored disposable SQLite demo database, then used the in-app browser against temporary local backend/frontend processes on ports 8010/5180. Login/checking-session, sidebar/drawer, Dashboard, Students list, Student Detail, Calendar, Super Admin Audit Trail, and receipt view were checked at 1440x900, 1180x820, 820x1180, and 390x844. No page-level horizontal overflow or legacy runtime branding was observed, and `DEMO` identifiers were visible.
- Receipt `DEMO.A0001` displayed the exact `SAMPLE — NOT A VALID RECEIPT` notice. With print media emulated at an A4-like 794x1123 viewport, the receipt and notice remained visible with no document horizontal overflow or legacy branding.
- QA used a temporary ignored `backend/.env`, generated from `.env.example` to provide `APP_KEY`, and removed it afterward. Unknown existing services on ports 8000/5173 were left untouched; only the exact temporary processes on 8010/5180 were stopped. The gstack browse package lacked Playwright in this environment, so the Codex in-app browser was used as the fallback; this is an environment limitation, not a product issue.
- Release delivery is verified: [pull request #8](https://github.com/Kaikaiyng/Matahari/pull/8) was merged into `master` as `2f4c6bd199a7fae149658d3993aba370203746de` on 2026-08-04. The remote feature branch was retained, matching existing repository practice.

Deployment-foundation local validation on 2026-08-06:

- `php artisan test --no-ansi`: 224 tests, 216 passed, 8 MariaDB-only skipped, and 1,147 assertions; exit 0.
- `php vendor/bin/pint --test`: exit 0.
- API and health route loading: 39 API routes plus the `/health` route loaded; exit 0.
- `npm.cmd test -- --run`: 15 files and 158 tests passed; exit 0.
- `npm.cmd run lint` and `npm.cmd run build`: exit 0; TypeScript and Vite production build completed with 75 transformed modules.
- `node --test deploy/tests/*.test.mjs`: 16 deployment contract tests passed, including the cross-platform npm lockfile and Composer security guards; exit 0.
- Composer 2.10.2 `audit --locked`: 0 security vulnerability advisories after updating Guzzle to 7.15.3 and its compatible transitive dependencies.
- Bash syntax validation passed for the release packager, PHP entrypoint, database initializer, and runtime-grant scripts.
- Tracked secret-bearing filename and private-key-content scans returned no findings.
- Docker is not installed on this workstation. Image build, Nginx syntax, Compose rendering/startup, container health, and real MariaDB identity/grant behavior remain **Not verified** locally and must be checked by GitHub/VPS execution.

Dependency security refresh on 2026-08-07:

- CommonMark was updated from 2.8.2 to 2.9.0 after three newly published advisories caused the full GitHub qualification job to fail closed.
- Composer 2.10.2 `audit --locked`: 0 security vulnerability advisories; exit 0.
- `node --test deploy/tests/*.test.mjs`: 17 deployment contract tests passed, including the new CommonMark minimum-version guard; exit 0.
- The complete backend suite remained at 224 tests, 216 passed, 8 MariaDB-only skipped, and 1,147 assertions; Pint passed.

Sidebar reference refresh on 2026-08-07:

- The authenticated desktop shell now uses a white reference-style sidebar with a 256-pixel expanded state, an 80-pixel collapsed state, a light-blue active item, and a compact footer. The collapse preference is stored locally under the brand-neutral `admin-sidebar-collapsed` key.
- Existing page keys, navigation items, permission filtering, page-selection callbacks, and logout behavior remain unchanged. Logout moved from the utility header to the sidebar footer so there is one clear control.
- Mobile retains the existing drawer, backdrop, focus, Escape, scroll-lock, and close-on-navigation behavior. A 390-by-844 browser check confirmed that labels remain visible in the drawer even when the desktop preference is collapsed.
- A follow-up contrast fix narrowed sidebar brand-copy selectors so the shared white school mark is no longer overridden by muted text color.
- `npm.cmd test -- --run`: 15 files and 160 tests passed; `npm.cmd run lint` and `npm.cmd run build` exited 0, with 77 production modules transformed.
- In-app browser checks covered expanded desktop, collapsed desktop, collapse persistence after reload, and the mobile drawer. Backend and database suites were not rerun because this change is limited to the frontend shell and presentation token.

## Deployment Status

- No production environment or production database is evidenced in the repository.
- GitHub Actions now defines quick checks, a single immutable ZIP build, full application/dependency checks, and a disposable MariaDB migration lifecycle. GitHub-hosted execution must be verified against the current `master` run.
- Pinned PHP-FPM/Nginx definitions, private MariaDB Compose configuration, generic isolated staging/production application stacks, non-secret environment examples, database identity/grant scripts, and deployment contract tests are present.
- The repository exposes a database-aware, non-secret `/health` response and a runtime `/api/deployment-info` label so the same ZIP can display `STAGING`, `PRE-LAUNCH DEMO`, or no banner.
- No stable hosting, real Docker/Compose startup, edge TLS/Basic Auth, remote deployment, monitoring, or infrastructure runtime is verified.
- A temporary Quick Tunnel launcher exists for demos only.
- Backup, binary-log, restore, reconciliation, runtime database grants, and recovery objectives are **Not verified**.

The approved direction is recorded in [Staging and Production Deployment Design](superpowers/specs/2026-08-06-staging-production-deployment-design.md), and the current repository-owned portion is documented in [Deployment Foundation](deployment-foundation.md). Automatic staging SSH deployment, exact-artifact production promotion, atomic remote switching, backup/restore, and Telegram monitoring remain follow-up work.

The repository must not be described as production-ready.

## Immediate Recommended Priorities

1. Plan controlled academic-year, enrolment, portal-link, and guardian-access production-data gates without inferred backfill.
2. Run real-device and school UAT for the independent Community App, then separately approve native authentication and store packaging before adding any native dependency.
3. Confirm discount formulas/eligibility and the approved correction/reconciliation policy before enabling discounted or retroactive billing.
4. Define refund, credit, overpayment, write-off, and audit-driven correction/recovery workflows.
5. Run and stabilize CI on `master`, then verify remote staging/production operations, least-privilege database grants, monitoring, backups, and restore/reconciliation.
6. Add the global Super Admin school selector, pagination/load targets, MariaDB concurrency tests, and browser E2E coverage as the relevant product phases require them.

## Needs Confirmation

- Approved maximum operating scale and performance targets.
- CEO/management print/report permissions.
- Student status transition approvals/reasons.
- Discount formulas, stacking, eligibility, proration, and reassessment.
- Approved treatment of charge history when an agreement must change mid-year.
- Cash maker-checker and non-cash proof requirements.
- Refund/credit/overpayment/write-off/correction policy.
- Relationship between `students.view` and guardian/`parents.view` data.
- Data retention, archival, privacy erasure, and backup expiry.
- Production topology, security controls, MariaDB version, release authority, recovery objectives, and monitoring.
