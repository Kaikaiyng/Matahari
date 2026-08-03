# Security, Financial Integrity, and Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed request-integrity, tenant-isolation, financial-integrity, audit-coverage, and frontend-authorization vulnerabilities while failing closed on unconfirmed business rules.

**Architecture:** Add centralized middleware and school-scope resolution, strict domain validation and database invariants, transactional audit events for material mutations, best-effort authentication audit, and a read-only Super Admin Audit Trail. Existing Laravel services remain the transaction owners; React navigation and API handling mirror—but never replace—backend authorization.

**Tech Stack:** PHP 8.4, Laravel 13, PHPUnit 12, MariaDB 11.4/SQLite test database, React 19, TypeScript 6, Vite 8, Vitest, Oxlint

## Global Constraints

- Do not invent discount formulas, discount stacking, charge cancellation, credits, refunds, or reconciliation rules.
- Do not physically delete historical student, agreement, charge, payment, receipt, or audit records.
- Financial and material mutations must roll back when their required audit insert fails.
- Authentication audit is best-effort and must not expose or log secrets.
- All actor and school scope values come from trusted server state.
- Use forward-only corrective migrations; do not rewrite historical migrations.
- Write and observe a failing regression test before each implementation change.
- Do not add a package unless the native framework cannot meet the requirement.

---

### Task 1: Native CSRF, login throttling, and active-session middleware

**Files:**
- Modify: `backend/bootstrap/app.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Modify: `backend/app/Http/Requests/LoginRequest.php`
- Create: `backend/app/Http/Middleware/EnsureUserIsActive.php`
- Modify: `frontend/src/api.ts`
- Test: `backend/tests/Feature/AuthApiTest.php`
- Create: `backend/tests/Feature/CsrfMiddlewareTest.php`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: session API middleware containing request-forgery protection; `EnsureUserIsActive::handle(Request, Closure): Response`; a same-origin CSRF bootstrap route; frontend mutation bootstrap behavior.

- [ ] Write backend tests for throttle isolation, throttle clearing, inactive existing sessions, middleware registration, missing-token rejection, and valid-token acceptance.
- [ ] Run `php artisan test --filter='AuthApiTest|CsrfMiddlewareTest'` and confirm the new assertions fail for the missing controls.
- [ ] Register native request-forgery middleware, the CSRF bootstrap route, username-plus-IP rate limiting, and active-session enforcement.
- [ ] Write frontend tests showing the API client bootstraps the CSRF cookie once, sends `X-XSRF-TOKEN`, retries once after 419, and never bootstraps safe GET requests.
- [ ] Run `npm test -- --run src/api.test.ts` and confirm failure before changing the API client.
- [ ] Implement the mutation bootstrap with a shared in-flight promise and decoded cookie header.
- [ ] Run the focused backend and frontend tests and confirm they pass.

### Task 2: Authoritative school scope and legacy endpoint permissions

**Files:**
- Create: `backend/app/Support/ResolvesSchoolScope.php`
- Modify: `backend/app/Http/Controllers/Api/DashboardController.php`
- Modify: `backend/app/Http/Controllers/Api/InvoiceGenerationController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/AuthApiTest.php`
- Create: `backend/tests/Feature/DashboardApiTest.php`
- Create: `backend/tests/Feature/InvoiceGenerationApiTest.php`

**Interfaces:**
- Produces: `ResolvesSchoolScope::forRequest(Request $request, ?int $requestedSchoolId): int`, which forces school-bound users to their own school and requires a valid explicit school for a global user.

- [ ] Add permission-matrix and cross-school regression tests for both endpoints, including forged `created_by`.
- [ ] Run the focused tests and observe the cross-school/actor tests fail.
- [ ] Add `fee_record.view` and `fee_record.generate` route middleware and resolve school scope centrally.
- [ ] Remove client authority over creator IDs and pass `$request->user()->id` to mutation services.
- [ ] Run the focused tests and route-list command.

### Task 3: Strict Fee Agreement and money validation

**Files:**
- Modify: `backend/app/Http/Requests/StoreFeeAgreementRequest.php`
- Modify: `backend/app/Http/Requests/SupersedeFeeAgreementRequest.php`
- Modify: `backend/app/Http/Requests/StorePaymentRequest.php`
- Modify: `backend/app/Http/Requests/StoreManualFeeRecordChargeRequest.php`
- Modify: `backend/app/Http/Requests/GenerateReceiptRequest.php`
- Create: `backend/app/Rules/DatabaseMoney.php`
- Modify: `backend/app/Services/FeeAgreements/FeeAgreementVersioningService.php`
- Test: `backend/tests/Feature/FeeAgreementApiTest.php`
- Test: `backend/tests/Feature/PaymentModuleApiTest.php`
- Test: `backend/tests/Feature/FeeRecordManualChargeApiTest.php`
- Test: `backend/tests/Feature/ReceiptBuilderApiTest.php`

**Interfaces:**
- Produces: `DatabaseMoney` validation for non-negative or positive decimal values with at most two fractional digits and maximum `99999999.99`.

- [ ] Add 422 regression tests for cross-school and duplicate fee items, unknown/duplicate selected codes, ambiguous academic years, three-decimal and out-of-range money.
- [ ] Run focused tests and confirm failures produce current 500/silent acceptance/database errors.
- [ ] Add tenant-qualified `Rule::exists`, `distinct`, four-digit year, selected-code after-validation, and `DatabaseMoney` rules.
- [ ] Add service-level defensive lookup-count checks that throw `ValidationException` inside the transaction.
- [ ] Run focused tests and confirm database state remains unchanged for each rejected request.

### Task 4: Fail-closed discounts, preview confirmation, and supersede conflicts

**Files:**
- Modify: `backend/app/Services/FeeAgreements/FeeAgreementVersioningService.php`
- Modify: `backend/app/Services/Billing/FeeRecordChargeGenerationService.php`
- Modify: `backend/app/Http/Controllers/Api/FeeRecordController.php`
- Modify: `frontend/src/features/fee-agreements/feeAgreementEditorModel.ts`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`
- Test: `backend/tests/Feature/FeeAgreementApiTest.php`
- Test: `backend/tests/Feature/FeeRecordChargeCellApiTest.php`
- Test: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`

**Interfaces:**
- Produces: conflict response when a superseded period contains activated charges; validation response for discounted or preview-confirmation-required activation.

- [ ] Add tests for activate-old/supersede/activate-new overlap, paid and allocated old charges, non-zero discounts, and preview-confirmation flags.
- [ ] Run focused tests and observe duplicate or unsafe billing behavior.
- [ ] Lock and inspect future charges before supersede; throw a 409 domain conflict without modifying either agreement.
- [ ] Reject preview/activation when non-zero discounts or preview-confirmation flags are present.
- [ ] Change frontend copy/state so a local discount estimate is never represented as payable and activation is disabled with the server-compatible reason.
- [ ] Run backend and frontend focused tests.

### Task 5: Corrective database invariants and decimal casts

**Files:**
- Create: `backend/database/migrations/2026_08_03_000001_add_fee_agreement_and_charge_integrity_constraints.php`
- Modify: `backend/app/Models/FeeAgreement.php`
- Modify: `backend/app/Models/FeeAgreementItem.php`
- Modify: `backend/app/Models/FeeAgreementDiscount.php`
- Modify: `backend/app/Models/FeeRecordCharge.php`
- Modify: `backend/app/Models/Payment.php`
- Modify: `backend/app/Models/PaymentAllocation.php`
- Modify: `backend/app/Models/Receipt.php`
- Modify: `backend/app/Models/ReceiptItem.php`
- Test: `backend/tests/Feature/FeeAgreementApiTest.php`
- Create: `backend/tests/Feature/FinancialIntegrityMigrationTest.php`

**Interfaces:**
- Produces: nullable `current_slot` (`1` for current, `NULL` for history), unique current-agreement key, and unique scheduled agreement-item/month key.

- [ ] Add migration tests for fresh schema, existing clean data, duplicate-data preflight failure, uniqueness, one-step rollback, and re-migration.
- [ ] Run SQLite migration tests and observe missing constraints.
- [ ] Add the forward-only corrective migration, backfill current slots, and update create/supersede services atomically.
- [ ] Add `decimal:2` casts for persisted monetary columns without changing response field names.
- [ ] Run SQLite focused tests and the MariaDB guarded migration/invariant suite.

### Task 6: Student mutation services and atomic domain audit

**Files:**
- Create: `backend/app/Services/Students/StudentMutationService.php`
- Modify: `backend/app/Http/Controllers/Api/StudentController.php`
- Modify: `backend/app/Http/Controllers/Api/StudentStatusController.php`
- Modify: `backend/app/Services/FeeAgreements/FeeAgreementVersioningService.php`
- Modify: `backend/app/Services/Billing/PaymentRecordingService.php`
- Modify: `backend/app/Services/Billing/ReceiptGenerationService.php`
- Test: `backend/tests/Feature/StudentManagementApiTest.php`
- Test: `backend/tests/Feature/FeeAgreementApiTest.php`
- Test: `backend/tests/Feature/PaymentModuleApiTest.php`
- Test: `backend/tests/Feature/ReceiptBuilderApiTest.php`
- Create: `backend/tests/Feature/Audit/BusinessAuditIntegrationTest.php`

**Interfaces:**
- Consumes: `AuditLoggerContract::record(AuditEvent, AuditContext): AuditLog`.
- Produces: transactional student create/update/status methods and allowlisted audit events for every material business mutation.

- [ ] Add event-payload tests for each action and throwing-logger tests proving the business mutation rolls back.
- [ ] Run audit integration tests and observe missing events/non-atomic behavior.
- [ ] Move direct student writes into the service and record only actual changed fields.
- [ ] Inject audit context/logger into existing Fee Agreement, payment, and receipt transaction owners and record action-specific events before commit.
- [ ] Run focused business and audit tests.

### Task 7: Best-effort authentication audit

**Files:**
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Modify: `backend/config/logging.php`
- Test: `backend/tests/Feature/AuthApiTest.php`
- Create: `backend/tests/Feature/Audit/AuthAuditTest.php`

**Interfaces:**
- Produces: redacted `security` log channel fallback event `audit.write_failed` and best-effort login success/failure/logout audit events.

- [ ] Add tests for event fields, secret absence, logger failure, and logout invalidation in a `finally` path.
- [ ] Run focused tests and observe missing audit/fallback behavior.
- [ ] Capture trusted context, write auth audit events without credentials, and catch only audit-write failures for structured fallback logging.
- [ ] Ensure logout always invalidates the session even when the audit logger throws.
- [ ] Run focused tests and inspect test logs for absence of credentials and tokens.

### Task 8: Read-only Audit Trail API

**Files:**
- Create: `backend/app/Http/Requests/IndexAuditLogRequest.php`
- Create: `backend/app/Http/Resources/AuditLogResource.php`
- Create: `backend/app/Http/Controllers/Api/AuditLogController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Audit/AuditLogApiTest.php`

**Interfaces:**
- Produces: `GET /api/audit-logs` with allowlisted filters and cursor pagination capped at 100; `GET /api/audit-logs/{auditLog}`; both require `audit.view`.

- [ ] Add unauthenticated/all-role matrix, filter, cursor, cap, school-data, not-found, and secret non-exposure tests.
- [ ] Run the API test and observe missing routes.
- [ ] Implement validated query filters, stable ordering by `(created_at,id)`, explicit resource fields, and no mutation routes.
- [ ] Run focused API tests and `php artisan route:list --path=api/audit-logs`.

### Task 9: Permission-aware navigation, scoped dashboard, and Audit Trail UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/features/audit/AuditTrailPage.tsx`
- Create: `frontend/src/features/audit/AuditTrailPage.test.tsx`
- Create: `frontend/src/features/audit/auditTypes.ts`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: permission-tagged navigation; Audit Trail list/detail; dashboard query without hard-coded school `1`; forbidden and invalid-current-page recovery states.

- [ ] Add frontend tests for every seeded role's visible navigation, forbidden direct selection, current-page recovery, dashboard URL, audit loading/filter/detail/error states, and secret-safe rendering.
- [ ] Run focused tests and observe current all-module navigation/hard-coded school failures.
- [ ] Filter navigation by required permissions and guard page rendering.
- [ ] Build dashboard parameters from the authenticated user's authoritative school or an explicit Super Admin selector.
- [ ] Implement Audit Trail UI using the read-only endpoints.
- [ ] Run focused frontend tests, type checking, lint, and build.

### Task 10: Documentation, full validation, review, and delivery

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/database.md`
- Modify: `docs/permissions.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md`

**Interfaces:**
- Produces: repository documentation matching the hardened code and recording every remaining operational or business-rule limitation.

- [ ] Update implementation status, route/permission matrix, CSRF flow, audit architecture, database constraints, fail-closed discount/supersede behavior, and exact validation commands.
- [ ] Run `vendor/bin/pint --test`; format affected/pre-existing listed PHP files until the repository check passes without semantic changes.
- [ ] Run full PHPUnit, frontend Vitest, Oxlint, TypeScript, and Vite production build.
- [ ] Run MariaDB focused tests and fresh/rollback/re-migrate workflow, recording exact evidence.
- [ ] Start a local HTTP server and perform a real CSRF cookie/login/mutation rejection smoke test.
- [ ] Check routes, configuration, Markdown links/fences, Mermaid syntax, secrets, generated junk, git cleanliness, and the complete diff.
- [ ] Push the feature branch, update the Draft PR description with every command/result and remaining limitation, mark ready, and wait for required checks/reviews.
- [ ] Merge only when the remote default branch is current, the PR is mergeable, all required checks pass, and no Important/Critical issue remains; then verify `origin/master` contains the merge and delete the feature branch if repository practice permits.
