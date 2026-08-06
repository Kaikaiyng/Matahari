# Current Status

**Snapshot date:** 2026-08-04

**Inspected implementation commit:** `faee84d72a7e75cbac967774446235a571a734de`

**Default branch:** `master`

**Overall status:** White-labelled neutral administration-finance demo MVP with application hardening in place; production operations and several business policies remain incomplete

The commit above is the final white-label feature head delivered through [pull request #8](https://github.com/Kaikaiyng/Matahari/pull/8). GitHub merged it into `master` as `2f4c6bd199a7fae149658d3993aba370203746de` on 2026-08-04.

## Runtime Demo Identity

The runtime demonstration is presented as **School Admin System**. A fresh, intentional reset of the ignored disposable SQLite demo database seeds the fictional **Demo International School** tenant and `DEMO` identifiers; printable receipts are marked as samples and are not valid receipts.

The repository retains internal Matahari project history and historical records as development evidence. Those records do not describe the neutral runtime identity or establish an affiliation with, or endorsement by, a school. The reset command never runs automatically and must not be adapted to a database containing valuable data. Existing receipt identifiers are financial history and are never rewritten automatically.

Later school-specific branding requires explicit approval and a controlled update to the presentation configuration and, if needed, a fresh disposable demo seed. It must not rename existing tenant data or rewrite financial history.

## Technology Snapshot

- Backend manifest: PHP `^8.3` and Laravel Framework `^13.8`; the resolved lockfile version is Laravel `13.17.0`.
- Validation runtime: PHP `8.4.21`.
- Frontend manifest: React `19.2.7`, TypeScript `~6.0.2`, and Vite `^8.1.0`.
- Session-based authentication and a MariaDB/MySQL-compatible production direction; SQLite is used for the local demo and default tests.

The confirmed earlier technology direction named Laravel 10, but this repository is already on Laravel 13. This is a verified implementation difference, not a pending upgrade.

## Implemented Features

- Session username authentication, CSRF-protected mutations, username-plus-IP login throttling, logout, `/me`, active-user request checks, roles, and permissions.
- Permission-filtered navigation backed by authoritative route permissions.
- Student list/search/filter/create/detail/backend update/status, with transactional audit events.
- Read-only classes and active-student rosters.
- Fee Agreement create/history/show/supersede, item/discount snapshots, current-version uniqueness, cross-year validation, and transactional audit events.
- Fee Record preview/activation/manual charges/outstanding/summary/category-month ledger, scheduled-charge uniqueness, unsupported-discount and preview-confirmation fail-closed gates, and transactional activation/manual-charge audit events.
- Payment record/allocation/verification/void reversal/history with tenant-owned input validation and transactional audit events.
- Receipt issue/snapshot/display/browser print/void/regenerate/history with stable sequence behavior and transactional audit events.
- School calendar CRUD.
- Backend permission and school-scope enforcement for the dashboard and legacy monthly invoice generation.
- Secure audit schema/logger/sanitizer/request IDs/model immutability, best-effort authentication audit, read-only Super Admin API, and Audit Trail frontend.
- Responsive admin UI and temporary local/public demo tooling.

## Partially Implemented

- Global Super Admin school scope: the backend accepts an explicit valid school, but the frontend has no school selector and shows a scope-required state instead of assuming school `1`.
- Student profile update exists only on the backend; parent records are read-only in the real Student Detail flow.
- Fee item catalogue has a read API; the top-level page is static and management is absent.
- Discount definitions are stored as snapshots, but approved formulas and eligibility rules do not exist. Charge preview/activation is blocked for non-zero discounts.
- Payments and receipts work inside Student Detail; there are no independent top-level modules.
- Legacy invoices remain separate from the implemented Fee Record ledger and have no frontend workflow.
- Audit covers implemented critical authentication, student, agreement, Fee Record, payment, and receipt actions. Generic correction, recovery, and export are not implemented.

## Known Incomplete Features

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
- `node --test deploy/tests/*.test.mjs`: 14 deployment contract tests passed; exit 0.
- Bash syntax validation passed for the release packager, PHP entrypoint, database initializer, and runtime-grant scripts.
- Tracked secret-bearing filename and private-key-content scans returned no findings.
- Docker is not installed on this workstation. Image build, Nginx syntax, Compose rendering/startup, container health, and real MariaDB identity/grant behavior remain **Not verified** locally and must be checked by GitHub/VPS execution.

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

1. Confirm discount formulas/eligibility and the approved correction/reconciliation policy before enabling discounted or retroactive billing.
2. Define refund, credit, overpayment, write-off, and audit-driven correction/recovery workflows.
3. Add the global Super Admin school selector and remove remaining static prototype data from operational pages.
4. Run and stabilize the new CI on `master`, then implement remote staging/production release operations, execute least-privilege database grants, monitoring, backups, and a verified restore/reconciliation drill.
5. Add pagination, load targets, and MariaDB concurrency testing for the intended operating scale.
6. Decompose the frontend application and add URL routing/browser E2E coverage.

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
