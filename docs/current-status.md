# Current Status

**Snapshot date:** 2026-08-03

**Inspected implementation commit:** `8b65469e96a81551d9c7cac4cf10c44ab6342761`

**Default branch:** `master`

**Overall status:** Internal/demo administration-finance MVP with application hardening in place; production operations and several business policies remain incomplete

The commit above is the last application commit before this documentation refresh. Use Git history and the final merge commit for the complete delivered snapshot.

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
- Stable production deployment, CI/CD, monitoring, backup scheduling, and restore tooling.

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
- No project-level PHP static analysis, browser E2E suite, performance suite, or CI workflow.
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

## Deployment Status

- No production environment or production database is evidenced in the repository.
- No GitHub Actions/other CI workflow is present.
- No stable hosting, Docker, Nginx, TLS, monitoring, or infrastructure configuration is present.
- A temporary Quick Tunnel launcher exists for demos only.
- Backup, binary-log, restore, reconciliation, runtime database grants, and recovery objectives are **Not verified**.

The repository must not be described as production-ready.

## Immediate Recommended Priorities

1. Confirm discount formulas/eligibility and the approved correction/reconciliation policy before enabling discounted or retroactive billing.
2. Define refund, credit, overpayment, write-off, and audit-driven correction/recovery workflows.
3. Add the global Super Admin school selector and remove remaining static prototype data from operational pages.
4. Establish CI, production configuration, least-privilege database access, monitoring, backups, and a verified restore/reconciliation drill.
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
