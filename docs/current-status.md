# Current Status

**Snapshot date:** 2026-08-03

**Inspected commit:** `14adce9508992c03c4249d49308a3841c198f4bd`

**Default branch:** `master`

**Overall status:** Internal/demo administration-finance MVP with release-blocking security and financial-integrity gaps

This status records the repository baseline inspected for the documentation foundation. A documentation commit cannot refer to its own final hash; use Git history for the later documentation/merge commit.

## Implemented Features

- Session username authentication, logout, `/me`, active-user login check, roles, and permissions.
- Student list/search/filter/create/detail/backend update/status.
- Read-only classes and active-student rosters.
- Fee Agreement creation/history/show/supersede and item/discount snapshots.
- Fee Record preview/activation/manual charges/outstanding/summary/category-month ledger.
- Payment recording/allocation/verification/void reversal/history.
- Receipt issue/snapshot/display/browser print/void/regenerate/history.
- School calendar CRUD.
- Responsive admin UI for desktop, tablet, and mobile.
- Temporary local SQLite demo and temporary Cloudflare Quick Tunnel tooling.
- Audit schema/logger/sanitizer/request ID/model-immutability foundation.

## Partially Implemented

- Dashboard uses real APIs but hard-codes school/month/year in the frontend and exposes a legacy backend authorization gap.
- Student profile update exists only on the backend; parent records are read-only in the real Student Detail flow.
- Fee item catalogue has a read API; the top-level page is static and management is absent.
- Agreement discounts are stored but do not change Fee Record charges.
- Payments and receipts work inside Student Detail; top-level pages are placeholders.
- Legacy invoices exist independently of the implemented Fee Record ledger.
- Audit infrastructure exists without business-event integration or an Audit Trail UI/API.

## Known Incomplete Features

- Parent CRUD, fee catalogue management, user/role management, password reset.
- Reports beyond Fee Record views, exports, statements, reminders, parent portal, server-side PDF.
- Refund, credit, overpayment, write-off, and approved correction workflows.
- Full academic ERP modules.
- Stable production deployment, CI/CD, monitoring, backup scheduling, and restore tooling.

## Release-Blocking Security Concerns

1. **Legacy dashboard cross-school read:** any authenticated user can supply another school ID; no specific permission or authenticated school check is applied.
2. **Legacy invoice cross-school write:** any authenticated user can invoke monthly invoice generation with supplied school/actor IDs; no specific permission or authenticated school check is applied.
3. **CSRF protection not verified:** session-cookie API routes manually include cookie/session middleware but not CSRF verification; the frontend sends no CSRF token.
4. **No login throttling:** the login route has no rate limiter.
5. **Inactive existing sessions:** user status is checked at login but not rechecked on later authenticated requests.
6. **Demo credentials:** seeded accounts use a known development password and must never be deployed unchanged.
7. **Audit coverage:** business and authentication mutations do not call the audit logger.

The first two issues are confirmed backend authorization defects. The CSRF deployment risk requires an explicit security design/verification rather than an assumption based only on SameSite/CORS.

## Financial-Integrity Concerns

1. Superseding an agreement does not reconcile old activated future charges. A replacement can create overlapping outstanding charges.
2. Agreement discounts are snapshots only and do not affect active Fee Record amounts.
3. The database does not uniquely enforce one current agreement per student/year or one charge per agreement item/month.
4. Agreement API academic-year and Fee Record academic-year formats are inconsistent.
5. End-to-end decimal safety is not established; legacy invoice and some reporting paths use floating-point operations.
6. Payment/receipt actor fields exist, but financial mutations do not emit central audit events.

## Migration Concerns

- Historical migrations include data-destructive table rebuild/drop behavior, especially receipt-builder rollback.
- Username migration rollback cannot restore removed email/password-reset data.
- Many table-creation rollbacks delete financial history.
- The payment-allocation agreement-item foreign key was moved to a later corrective migration after its parent table exists; older documentation that still reports the original ordering caveat is stale.
- The documentation task validated the current schema on a disposable MariaDB 11.4.12 instance, including fresh/one-step rollback/re-migration and the guarded MariaDB group. This is local compatibility evidence, not production validation.
- Production rollback safety, backups, and restoration are **Not verified**.

## Technical Debt

- `frontend/src/App.tsx` owns most state, API orchestration, and pages.
- No URL routing/deep links or shared server-state layer.
- Navigation is not permission-filtered and several frontend permission checks mismatch backend slugs.
- Dashboard is fixed to school 1 / July 2026 / academic year 2026.
- No pagination for major student and Fee Record summary queries; no formal scale tests or volume factories.
- Most status values are unconstrained strings.
- No project-level PHP static analysis, browser E2E suite, performance suite, or CI workflow.
- Existing older current-reference documents contain stale test counts and several architecture/schema overclaims. The canonical lowercase documents linked from the root README supersede them where they conflict.

## Test Status at Inspection

Fresh baseline commands executed in the isolated documentation worktree before edits:

- Backend PHPUnit: 185 tests discovered; 177 passed, 8 MariaDB-only tests skipped; 923 assertions; exit 0.
- Frontend Vitest: 11 files and 141 tests passed; exit 0.
- API route inventory: 35 non-vendor routes.

The eight skipped cases in the default suite require an explicitly opted-in disposable MariaDB database. Final documentation-branch validation also recorded:

- Guarded MariaDB 11.4.12 group: 8 tests passed, 33 assertions.
- SQLite disposable migration fresh/one-step rollback/re-migration: passed.
- MariaDB disposable migration fresh/one-step rollback/re-migration: passed.
- Frontend Oxlint: passed.
- Frontend TypeScript and Vite production build: passed, 73 modules transformed.
- Laravel configuration and API route loading: passed.
- Temporary public-demo launcher contract/runtime scripts: passed.
- Backend Pint `--test`: failed on 20 existing application/test files. No PHP files were changed by this documentation task.

The Pint failure and release-blocking application issues mean the repository does not satisfy the configured merge gate. See [Testing and Release](testing-and-release.md).

## Deployment Status

- No production environment or production database is evidenced in the repository.
- No GitHub Actions/other CI workflow is present.
- No stable hosting, Docker, Nginx, TLS, monitoring, or infrastructure configuration is present.
- A temporary Quick Tunnel launcher exists for demos only.
- Backup, binary-log, restore, reconciliation, runtime database grants, and recovery objectives are **Not verified**.

The repository must not be described as production-ready.

## Immediate Recommended Priorities

1. Protect or retire the legacy dashboard and invoice endpoints; add permission and cross-school negative tests.
2. Define and implement CSRF/login-throttling/session-status security requirements.
3. Decide and test the mid-year agreement supersede/charge reconciliation rule before broader finance use.
4. Confirm discount formulas/eligibility and implement them in the Fee Record source of truth.
5. Integrate central audit events into authentication and financial mutations, then add an authorized Audit Trail API/UI.
6. Run the full disposable MariaDB migration/rollback/re-migration and guarded integration suite.
7. Establish CI, production configuration, least-privilege database access, backups, and a verified restore/reconciliation drill.
8. Add pagination/load targets and test the intended operating scale.

## Needs Confirmation

- Approved maximum operating scale and performance targets.
- CEO/management print/report permissions.
- Student status transition approvals/reasons.
- Discount formulas, stacking, eligibility, proration, and reassessment.
- Mid-year agreement supersede treatment of already activated future charges.
- Cash maker-checker and non-cash proof requirements.
- Refund/credit/overpayment/write-off/correction policy.
- Data retention, archival, privacy erasure, and backup expiry.
- Production topology, security controls, MariaDB version, release authority, recovery objectives, and monitoring.
