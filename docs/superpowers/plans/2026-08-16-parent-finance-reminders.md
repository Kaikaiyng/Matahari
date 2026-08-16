# Parent Finance and Manual Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the read-only Parent Finance App and let authorized Admin users send audited in-App payment reminders to eligible guardians.

**Architecture:** Extend the existing shared Laravel finance, guardian-link, receipt and `portal_notifications` foundations. A transactional reminder service recalculates Fee Record outstanding amounts, resolves eligible guardian users and writes notifications plus audit; Parent receipt access remains child-scoped. Admin and App consume these APIs without creating another ledger or payment flow.

**Tech Stack:** Laravel 13/PHP 8.4/PHPUnit, React 19/TypeScript/Vitest, existing CSS and browser print.

## Global Constraints

- No online payment, email, WhatsApp, push, scheduled reminders or new PDF package.
- Never trust submitted tenant/guardian IDs; enforce tenant, surface, school and guardian-child scope in Laravel.
- Use only active same-school links with `can_view_finance = true` and active linked guardian users.
- Recalculate current outstanding from Fee Record data; do not add a balance table.
- Notification and material audit persistence share one transaction.
- Receipt UI uses the immutable authoritative receipt snapshot and browser Print / Save as PDF.

---

### Task 1: Backend reminder permission and transactional service

**Files:**
- Create: `backend/database/migrations/2026_08_16_000001_add_payment_reminder_permission.php`
- Create: `backend/app/Services/Billing/PaymentReminderService.php`
- Create: `backend/app/Http/Controllers/Api/PaymentReminderController.php`
- Create: `backend/tests/Feature/ParentFinanceReminderApiTest.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces: `PaymentReminderService::send(Student $student, User $actor, AuditContext $context): array{student_id:int,academic_year:string,outstanding_amount:float,recipient_count:int}`.
- Produces: `POST /api/students/{student}/payment-reminders`, protected by Admin surface and `permission:payment_reminders.send`.

- [ ] Write failing tests proving permission denial, wrong-school denial, no-current-enrolment/no-balance/no-recipient validation, unique eligible recipients, notification payload, and audit rollback.
- [ ] Run `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\ParentFinanceReminderApiTest.php` and confirm the missing route/service failures.
- [ ] Add `payment_reminders.send` and assign it to `super-admin`, `school-admin`, and `finance`; `down()` removes only this permission and its role pivots.
- [ ] Add `AuditAction::PaymentReminderSent` and implement the service inside `DB::transaction()`: lock the student/current enrolment, call `FeeRecordChargeGenerationService::outstanding()`, decimal-sum positive outstanding amounts, resolve distinct active guardian portal users from active finance-enabled links, create `payment_reminder` notifications, then record a Payments/Student audit event containing academic year, amount and recipient IDs/count.
- [ ] Add the controller/route and return HTTP 201 with the service result. Validation failures use field keys `academic_year`, `outstanding`, or `recipients` and create no rows.
- [ ] Rerun the focused test until green, then run Pint on changed PHP files.
- [ ] Commit only Task 1 files with `feat: add audited payment reminders`.

### Task 2: Parent receipt detail and isolation

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/ParentPortalController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/ParentFinanceReminderApiTest.php`

**Interfaces:**
- Produces: `GET /api/v1/portal/parent/children/{student}/receipts/{receipt}` returning `{data: PortalReceipt}`.

- [ ] Add failing tests for linked-child receipt detail plus unrelated child, unrelated receipt, disabled finance capability, school and tenant denial.
- [ ] Run the focused backend test and confirm the new route is missing.
- [ ] Extract one receipt snapshot formatter used by list/detail. In detail, call existing guardian access enforcement and require `receipt.student_id`, `receipt.school_id` and route student to match; fail closed with 403.
- [ ] Rerun the focused test and full `DemoPortalApiTest` until green.
- [ ] Commit Task 2 files with `feat: secure parent receipt detail`.

### Task 3: Parent App finance experience

**Files:**
- Modify: `app/src/api/portalApi.ts`
- Modify: `app/src/components/ParentPortalView.tsx`
- Modify: `app/src/App.css`
- Modify: `app/src/App.test.tsx`

**Interfaces:**
- Consumes: existing outstanding/payment/list APIs and new receipt-detail route.
- Produces: `portalApi.getChildReceipt(studentId, receiptId)` plus child finance cards and receipt detail dialog.

- [ ] Add failing App tests that authenticate a parent with two finance-enabled children, click the second child card, verify only its endpoints/data appear, show all payment/receipt rows, open receipt detail, and invoke `window.print`; also prove no payment button exists and payment reminders appear in the notification list.
- [ ] Run `npm.cmd test -- --run` and confirm UI/interaction failures.
- [ ] Replace the Finance dropdown with accessible child cards; reset stale finance arrays when switching and expose load errors.
- [ ] Render total balance, all payment rows with status, and all receipt rows. Receipt click fetches the child-scoped detail and opens a dialog containing snapshot items, payer/method/date/number/status and a Print / Save as PDF button calling `window.print()`.
- [ ] Add compact responsive/print CSS without changing other role views.
- [ ] Run App Vitest, Oxlint and build; commit with `feat: complete parent finance app`.

### Task 4: Admin Remind action, docs and qualification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/App.test.tsx`
- Modify: `docs/business-rules.md`
- Modify: `docs/permissions.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md`

**Interfaces:**
- Consumes: `POST /students/{student}/payment-reminders` and `payment_reminders.send`.

- [ ] Add failing Admin tests proving the Remind button is permission-gated, calls the exact selected-student endpoint, reports recipient count/balance, and displays validation errors without changing payments.
- [ ] Run focused Admin tests and confirm failure.
- [ ] Add `canSendPaymentReminders`, request state, success/error message and a Remind action in the selected student's Payments header; disable it while sending and do not add payment-entry behavior.
- [ ] Run Admin Vitest, Oxlint and build.
- [ ] Update canonical rules/permissions/status/testing docs for in-App manual reminders, receipt print/save, role permission and verified isolation.
- [ ] Run full Backend PHPUnit/Pint/routes, App and Admin test/lint/build, disposable SQLite migration/rollback/re-migrate, guarded MariaDB groups/lifecycle on `rylay_audit_test`, docs links, `git diff --check`, and secret/artifact scans.
- [ ] Commit with `feat: connect admin payment reminders` and publish through the already authorized GitHub branch/PR workflow.
