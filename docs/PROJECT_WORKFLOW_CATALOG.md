# Matahari Project Workflow Catalog

Status: Evidence-backed current-state catalog

Last reviewed: 2026-07-14

This catalog is the source checklist for the editable FigJam workflow board and the final Notion documentation. It distinguishes runtime behavior from approved-but-unimplemented design and historical/deferred scope.

Published FigJam board: [Matahari Complete Project Workflow Atlas](https://www.figma.com/board/sGDlrRbsbHsuT5laZEzKa8?utm_source=other&utm_content=edit_in_figjam&oai_id=v1%2FwOVdpwOgFVs6eNhbOHdwC1cOfCUWewcVQHceqgjBVtixXsxAsX2TAY&request_id=5a0a7805-91cc-4e9d-8bc8-d191c5b72bb5)

The board contains 15 numbered diagrams (`00` through `14`) and 15 matching Mermaid sources under `docs/workflow-diagrams/`.

## 1. Status Legend

- **Implemented**: reachable in current code, protected and tested unless a limitation is stated.
- **Backend only**: API/domain behavior exists, but the current React navigation does not expose a complete workflow.
- **Prototype/static**: visible frontend shell or sample content without a complete working module.
- **Legacy/unsafe**: retained scaffold behavior that is outside the protected finance route group.
- **Approved design**: documented and approved, but absent from current routes/schema/frontend behavior.
- **Deferred**: explicitly outside the current MVP.

## 2. System and Actor Boundary

Runtime path:

1. A desktop, iPad, or mobile browser opens the React 19 + TypeScript + Vite frontend.
2. `frontend/src/api.ts` sends credentialed JSON requests to the Laravel API and includes the database-backed Laravel session cookie.
3. Protected routes run encrypted-cookie, queued-cookie, session, `auth`, and `permission:<slug>` middleware.
4. Controllers validate request and school ownership, then call transaction-oriented services for finance mutations.
5. Eloquent persists school-scoped records in MariaDB; PHPUnit uses SQLite `:memory:`.
6. Validation failures return 422, missing authentication returns 401, and denied permissions/school scope return 403.

Human and system actors:

- Unauthenticated staff visitor
- Super Admin, currently global (`school_id = null`)
- CEO, seeded role but currently no seeded permissions
- School Admin, school-scoped operational role
- Finance, school-scoped review/verification role
- React frontend
- Laravel session/auth middleware
- Permission middleware
- Domain controllers and services
- MariaDB / SQLite test database
- Browser print workflow

Parent and student users are not authenticated actors. Parent Portal and Student Portal are deferred.

## 3. Role and Permission Matrix

### 3.1 Current seeded behavior

| Capability | Super Admin | CEO | School Admin | Finance |
| --- | --- | --- | --- | --- |
| Scope | Global user; business screens may still require an explicit school | Role exists | Own school | Own school |
| Students view | Yes | No seeded permission | Yes | Yes |
| Students create/update/status | Yes | No | Yes | No |
| Parents view/create/update permission records | Yes | No | Yes | View only |
| Parent API/UI | No complete CRUD routes; static prototype page | Same | Same | Same |
| Fee items view | Yes | No | Yes | Yes |
| Fee items manage permission | Yes | No | No | No |
| Fee item mutation API/UI | Not implemented | Not implemented | Not implemented | Not implemented |
| Fee Agreements view | Yes | No | Yes | Yes |
| Fee Agreements create/supersede | Yes | No | Yes | No |
| Fee Record view | Yes | No | Yes | Yes |
| Fee Record activate/manual charge | Yes | No | Yes | No |
| Payments view | Yes | No | Yes | Yes |
| Payments create | Yes | No | Yes | No |
| Payments verify/void | Yes | No | No | Yes |
| Receipts view/create/print | Yes | No | Yes | Yes |
| Receipts void | Yes | No | No | Yes |
| User management | Not implemented | No | No | No |

Super Admin receives all 23 current business permissions. School Admin receives 19 operational permissions. Finance receives 12 read/review/control permissions. The `ceo` role is created but `DatabaseSeeder` does not currently sync any permissions to it.

### 3.2 Approved design, not implemented

The approved username/user-management design adds five `users.*` permissions to Super Admin and gives CEO read-only permissions for students, parents, fee items, Fee Agreements, Fee Record, payments, receipts, and receipt printing. It also changes staff login from email to normalized username and adds Super Admin-only account administration. None of these routes, migrations, or frontend screens exists in the current runtime.

## 4. Frontend Navigation and Availability

| Navigation item | Current behavior |
| --- | --- |
| Dashboard | Live legacy endpoint with demo fallback; finance widgets are labelled future phase |
| Students | Main implemented workspace for student, agreement, charges, payments, and receipts |
| Parents | Static prototype contacts only |
| Fees | Static Fee Agreement foundation table only |
| Fee Record | Implemented read-only Summary and Category Monthly views |
| Invoices | Prototype message; no working frontend module |
| Payments | Prototype message; real payment workflow is inside Student Detail |
| Receipts | Prototype message; real receipt workflow is inside Student Detail |
| Reports | Static future-phase cards |
| Settings | Current user identity, roles, school scope, and permission badges only |

Responsive shell behavior:

- Desktop 1181px+: full sidebar and dense tables.
- iPad landscape 1024–1180px: compact labelled rail.
- iPad portrait 768–1023px: drawer navigation and single-column flows.
- Mobile below 768px: drawer, stacked forms/records, and contained horizontal ledgers.
- Drawer closes by navigation, Escape, close button, or backdrop; focus returns to the menu button.
- Browser print hides application chrome and prints only the receipt scope.

## 5. Authentication, Session, and Authorization Flow

### 5.1 Implemented login

1. Frontend initially calls `GET /api/me` to restore a session.
2. If `/me` succeeds, the frontend stores the user, roles, and effective permission slugs, then loads the Dashboard.
3. If `/me` returns 401, the frontend shows the login form.
4. The current login form is prefilled with demo email/password values.
5. Staff submits email and password to `POST /api/login`.
6. Laravel validates required email format and password string.
7. `Auth::attempt` checks the credentials.
8. Invalid credentials return 422 on `email`.
9. On success, Laravel regenerates the session.
10. If user status is not `active`, Laravel logs out, invalidates the session, regenerates the CSRF token, and returns a distinct inactive-account error.
11. Active login updates `last_login_at` and returns id, name, email, `school_id`, roles, and sorted unique permissions.
12. Frontend renders all navigation items but conditionally hides/disables finance actions using permissions.
13. Every protected backend action independently rechecks authentication and the required permission.
14. `POST /api/logout` logs out, invalidates the session, regenerates token, and returns the frontend to the guest state.

### 5.2 Approved authentication change

The approved design replaces email with lowercase username, removes staff email/reset-table concepts, uses a generic credential error for invalid and inactive accounts, removes demo-prefilled credentials, and preserves sessions/roles/school assignments. This is not implemented yet.

## 6. Student Lifecycle and Workspace

### 6.1 List and find students

1. Authenticated user needs `students.view`.
2. School-scoped users automatically query their `school_id`.
3. Backend defaults status to `active`; supported values are active, withdraw, graduate, inactive, or all.
4. Backend supports filters for level group, class, student number, and search across number/name.
5. Current Student List UI exposes status filter and refresh; Fee Record totals are loaded separately for the selected academic year.
6. Results are ordered by student number and show identity, level/class, status, expected fees, and outstanding totals.
7. Opening a student loads detail, agreement history, Fee Record summary/outstanding, payment history, and receipt history according to permissions.

### 6.2 Create student

1. User needs `students.create`.
2. UI captures student number, full name, level group, gender, DOB, registration date, status, and notes.
3. Backend validates school, optional class, school-unique student number, supported level group, supported status, and date/string constraints.
4. Backend derives the school from the logged-in user unless a global user supplies one.
5. Student is created without physical-delete behavior.
6. UI opens the new detail, refreshes related finance sections, and reloads the student list.

### 6.3 Update profile and status

- `PATCH /students/{student}` exists and can update class, number, name, level, gender, dates, and notes, but the current React Student Detail does not expose a profile edit form.
- Status is deliberately changed through `PATCH /students/{student}/status`, not the general update endpoint.
- Supported states: active, withdraw, graduate, inactive.
- Records and finance history remain retained; no student delete route exists.
- School Admin/Super Admin may change status; Finance is view-only.

### 6.4 Parent/guardian data

Student detail returns linked parent/guardian name, phone, email, relationship, and primary-contact flag. The database supports many-to-many student-parent links. Parent permission slugs exist, but there are no protected parent CRUD routes and the Parents navigation page is only static sample content.

## 7. Fee Agreement Lifecycle

### 7.1 View

1. User needs `fee_agreements.view` and matching school scope.
2. Student agreement history is sorted by academic year then version descending.
3. Each response includes current/history status, payment plan, effective window, item snapshots, billing configuration, and discount snapshots.

### 7.2 Create current agreement

1. School Admin/Super Admin opens Create Agreement.
2. Frontend loads active fee items.
3. User selects academic year, payment plan, effective dates, remarks, fee items, amounts, classifications, billing frequency/months, and optional discount.
4. Backend requires at least one item and requires both TUITION and MISC.
5. OTHERS requires a custom description.
6. Payment plan is monthly, termly, or yearly.
7. Item classification is recurring, optional_service, one_time, or manual.
8. Billing frequency is monthly, termly, yearly, custom, or one_time.
9. Termly/custom require at least one month; yearly/one_time require exactly one month.
10. Discount type is percentage or fixed amount; scope is tuition_only, total_payable, or selected_fee_items.
11. Selected-item discounts require selected fee codes; all discounts require a remark.
12. Inside a transaction the service locks the student/year current agreement query.
13. If a current agreement already exists for that student/year, creation returns 422.
14. Otherwise it calculates next version number and creates an active current agreement.
15. Fee items and discounts are snapshotted so later catalog changes do not rewrite history.

### 7.3 Supersede

1. User needs `fee_agreements.update`.
2. Only an active current agreement may be superseded.
3. New effective date must be after the existing effective date.
4. Service locks the current agreement.
5. Existing agreement gets `effective_to = new effective_from - 1 day`, `is_current = false`, and `status = superseded`.
6. Any competing current rows for the same student/year are also demoted under lock.
7. New version is created with version +1, active/current status, new snapshots, and user attribution.
8. Historical versions remain visible and immutable through the UI.

## 8. Fee Record Charge Flow

### 8.1 Preview scheduled charges

1. User needs `fee_record.view`.
2. User selects a four-digit academic year.
3. Service requires an active current Fee Agreement for student/year.
4. For each agreement item, configured months win.
5. Monthly frequency without explicit months produces January–December.
6. Termly, yearly, custom, or one-time without the required months produces a blocking warning and no silent charge.
7. Months outside the agreement effective window are excluded.
8. Each preview row contains agreement/item identity, billing month, mapped category, code, description, expected amount, billing/collection status, origin, and confirmation flag.
9. Temporary category mapping: TUITION/MISC→SF+MF, TRANSPORT→TR, MEAL→MP, HIGH_SCOPE→HS, HOSTEL→HT, application/deposit/enrolment/registration→PAYMENT, and uniforms/books/PE/worksheet/other categories→OTHERS.

### 8.2 Activate scheduled charges

1. User needs `fee_record.generate` or `fee_record.manage` in the frontend; route requires `fee_record.generate`.
2. Service locks the current agreement and checks for existing charges for the same student/agreement/year.
3. Duplicate activation returns 422.
4. Service recomputes preview inside the transaction.
5. Any missing-month warning blocks activation.
6. Each preview row becomes a `fee_record_charges` row.
7. Positive expected amount starts `billing_status = billable`, `collection_status = unpaid`, paid 0, outstanding = expected.
8. Zero amount starts `no_charge` and `paid`.
9. Scheduled rows have `charge_origin = scheduled`, `source_type = agreement_item`, and activation timestamp.

### 8.3 Add manual charge

1. User needs `fee_record.manage`.
2. UI captures academic year, billing month, category, description, amount, and remark.
3. Amount must be greater than zero and month must belong to the selected year.
4. Student must have an active current agreement for that year.
5. Optional fee item must belong to the same school.
6. Service creates an immediately active, billable, unpaid charge with `charge_origin = manual` and `source_type = manual_charge`.
7. Manual charge appears in outstanding picker, summary, and category-monthly ledger.

### 8.4 Outstanding picker

1. User needs `fee_record.view`.
2. Query returns only the student's selected-year rows that are billable, unpaid/partial, and outstanding above zero.
3. Rows are ordered by billing month, category, and id.
4. Payment UI groups them by month and category for exact-cell allocation.

### 8.5 Read-only Fee Record views

Summary filters academic year, level group, class, student status, outstanding-only, and student name/number. It aggregates expected, paid, outstanding, outstanding months/categories, latest active issued receipt, and overall no_charges/unpaid/partial/paid state.

Category Monthly adds category and returns one Jan–Dec cell per student/category. Each month cell aggregates charge count, expected, paid, outstanding, raw categories, fee codes, and active issued receipt references. Both views read charge balances; pending payments, legacy invoices, and receipt issuance/voiding do not directly change charge totals.

## 9. Payment Recording and Allocation Flow

### 9.1 Create payment

1. User needs `payments.create`; current operational actor is School Admin or Super Admin.
2. UI opens inside Student Detail and loads outstanding charge cells for the academic year.
3. Supported methods: cash, bank_transfer, duitnow_qr, cheque, credit_card, and fpx.
4. Required fields include method, payment date, positive amount, and at least one allocation; cash also requires received date.
5. Optional fields: paid by, bank account, reference, proof text/reference, remark, academic year.
6. User selects exact charge cells and may enter a partial amount up to each cell's outstanding balance.
7. A manual allocation can be added only for legacy/unclassified money and does not reduce Fee Record charges.
8. Frontend compares payment total and allocation total; backend repeats an exact cents comparison.
9. Allocation total mismatch returns 422.
10. Charge allocation must reference a charge belonging to the same student/school/year, be billable, have outstanding balance, and not exceed outstanding.
11. Fee-item/agreement-item legacy references must belong to the same student/school.
12. Payment and allocation snapshots are created in a transaction.
13. Cash starts verified, records the creator as verifier, and immediately applies charge balances.
14. Non-cash starts pending_verification and does not reduce charge balances yet.
15. Creating a payment never auto-generates a receipt and never updates legacy invoice balances.

### 9.2 Verify non-cash payment

1. User needs `payments.verify`; current operational actor is Finance or Super Admin.
2. Only pending_verification may transition to verified.
3. Voided or already verified payments return 422.
4. Received date is required; bank/reference/remark may be updated.
5. Service locks payment, student, allocations, and each affected charge.
6. It rechecks every allocation against the charge's current outstanding balance, preventing two pending payments from over-clearing the same cell.
7. Charge paid/outstanding cached amounts are updated.
8. Charge collection status becomes paid, partial, or unpaid.
9. Payment becomes verified with verifier and timestamp.
10. Verification does not auto-generate a receipt.

### 9.3 Void payment

1. User needs `payments.void`; current operational actor is Finance or Super Admin.
2. Void reason is required.
3. An already voided payment returns 422.
4. Any active issued receipt blocks payment void; receipt must be voided first.
5. Verified payment reverses each charge allocation under lock, restoring paid/outstanding and recalculating collection state.
6. Pending payment has not changed charge balances, so it needs no balance reversal.
7. Guard rejects reversal if it would make paid negative or outstanding exceed expected.
8. Payment becomes voided with actor, timestamp, and reason.
9. There is no payment delete route.

## 10. Receipt Lifecycle

### 10.1 Generate receipt

1. User needs `receipts.create`; School Admin, Finance, and Super Admin currently have it.
2. Receipt starts from a payment, not an invoice.
3. Payment is locked and must be verified, not pending or voided.
4. Payment must not already have an issued receipt; a second attempt returns 422 in current code/tests.
5. `paid_by` comes from payment or must be supplied during generation; supplied value is persisted back to a blank payment.
6. Service locks or creates the per-school prefix/series sequence and increments it transactionally.
7. Current format is `{schoolPrefix}.A#### (MM/YYYY)` and the sequence is continuous rather than resetting monthly.
8. Receipt snapshots school/payment/student identity, payer, methods/dates, amount, amount in words, issuer, and status.
9. Receipt item snapshots are copied from ordered payment allocations.
10. Status starts issued and `active_payment_id` enforces one active receipt per payment.
11. Receipt generation does not change Fee Record balances.

### 10.2 View and print

1. `receipts.view` lists history and opens immutable receipt snapshots.
2. `receipts.print` fetches the same receipt response, sets printed time in the frontend, then invokes `window.print()`.
3. Print scope contains school, receipt number/date, printed time, issuer, payer, student, payment/received dates, method, amount, amount in words, and line items.
4. Screen-only shell/history/actions are hidden by print CSS. This is browser printing, not PDF generation.

### 10.3 Void and regenerate

1. User needs `receipts.void`; current operational actor is Finance or Super Admin.
2. Only issued receipts may be voided and reason is required.
3. Service locks the receipt, sets status voided, clears `active_payment_id`, and records actor/time/reason.
4. Voiding a receipt does not reverse Fee Record balances.
5. Once the issued receipt is voided, the payment may be voided or a new receipt may be generated.
6. Regeneration consumes the next sequence number; voided numbers are never reused.
7. There are no receipt edit or delete routes.

## 11. Payment and Receipt State Coupling

- Pending non-cash payment: allocations exist but charge balances are unchanged; no receipt allowed.
- Verified payment: charge allocations applied; eligible for one issued receipt.
- Issued receipt: freezes an immutable snapshot and blocks payment void.
- Voided receipt: frees `active_payment_id`; payment balance effects remain.
- Voided verified payment: charge allocations reversed; no new receipt allowed.
- Voided pending payment: no charge reversal needed.
- Cash payment skips pending state and applies balances immediately.

## 12. Legacy Dashboard and Invoice Flow

These two endpoints are outside the authenticated finance route group and must be marked legacy/unsafe.

### Dashboard

`GET /api/dashboard/school` accepts `school_id` (default 1) and invoice month. It reports verified-payment collection, legacy invoice outstanding/overdue/count, active students, recent verified payments, and top outstanding invoice students. The frontend calls school 1/month 2026-07 and falls back to hardcoded demo metrics if the request fails. Current UI explicitly says production finance widgets are future phase and directs users to Fee Record.

### Monthly invoice generation

`POST /api/invoices/generate-monthly` accepts school, month, issue/due dates, optional creator, and class. It selects active students, reads legacy student fee/discount assignments, skips duplicate active invoices or students without active fees, snapshots fee and discount lines, calculates totals, creates pending invoices, and generates a per-school/year invoice number. It is backend-only/legacy, has no current frontend module, and payment creation/verification intentionally does not update invoice balances.

## 13. School Scope and Future Multi-School Hook

- `schools` exists with code, name, receipt/invoice prefixes, contact data, and status.
- Users and core business/finance records carry `school_id`.
- Student numbers, fee names, invoice numbers, and receipt sequences are scoped by school where defined.
- School-scoped requests compare the authenticated user's school with the target record.
- A global Super Admin (`school_id = null`) bypasses target-school comparisons, but some list/create endpoints still require an explicitly supplied school; current frontend does not provide a complete global school selector.
- Subdomain resolution, school switching, cross-school CEO reporting, and production tenant middleware are deferred. Existing `school_id` and school code are only the extension hook.

## 14. Approved User-Management Flow, Not Implemented

Planned login uses normalized username. Super Admin would list/create/edit users, assign exactly one fixed role, activate/deactivate, and reset passwords. Safety rules would prevent self-deactivation, self-demotion, and removal/demotion of the last active Super Admin. User actions would write audit logs without password/hash data. Non-Super Admin Settings would remain self-view only. Planned routes are `/users`, `/users/{user}`, `/users/{user}/status`, `/users/{user}/reset-password`, and `/roles`; none currently exists.

## 15. Explicitly Deferred Flows

- Statements and reminders
- General reports and exports
- PDF generation
- Parent Portal / student authentication
- Production dashboard finance logic
- Production invoice frontend and invoice PDF
- Refunds, credit notes, overpayments, write-offs, and advanced corrections
- Queue-driven email/WhatsApp communication
- Attendance, teacher, academic, and other broad ERP modules
- Hosting, deployment, domain, Cloudflare, Docker, Nginx, TLS
- Cross-school CEO reporting and full production multi-school operations
- Automatic grade promotion
- Confirmed dynamic sibling-discount rules and prorated mid-year enrollment

## 16. Current Evidence Conflicts and Caveats

- Documentation/UAT says repeated receipt generation may return/reuse an active receipt; current service and tests return 422 until the issued receipt is voided.
- Implementation status/UAT mentions student edit in the frontend; current backend update route exists, but React has no profile edit workflow.
- CEO read-only permissions are approved in a design document but not synced in the current seeder.
- Username authentication/user management is approved design only; runtime still uses email and exposes/prefills demo credentials.
- Parent and fee-management permissions exist without complete mutation routes/UI.
- Payments and Receipts are implemented inside Student Detail while their top-level navigation pages remain prototypes.
- Dashboard and invoice generation routes are unauthenticated legacy endpoints.
- Historical PRD/backlog describes invoice-centric payment updates and broader modules; current implemented finance source of truth is Fee Record charges and their allocations.
- Category mapping is explicitly temporary until final school fee codes are confirmed.
- MariaDB fresh migration has a known foreign-key ordering workaround.
- Real iPad Safari and native print preview still require operator verification.

## 17. FigJam Coverage Checklist

The final board must include all of these named areas:

1. Runtime system boundary and status legend
2. Current role/permission matrix including the current empty CEO role
3. Implemented login/session/logout and approved username-login overlay
4. Frontend navigation availability and responsive shell
5. Student list/create/detail/update-status plus backend-only profile update and parent prototype
6. Fee Agreement create/view/supersede with validations and snapshots
7. Fee Record preview/activate/manual/outstanding/summary/category-monthly
8. Payment create/allocation/cash/non-cash/verify/void and charge balance effects
9. Receipt generate/view/print/void/regenerate and payment void guard
10. Student, agreement, charge, payment, and receipt state machines
11. Legacy dashboard and invoice-generation flows
12. School scope and future multi-school hook
13. Approved user management and CEO read-only design, clearly marked unimplemented
14. Deferred modules and business-rule TBDs
15. Evidence conflicts/known limitations

## 18. Authoritative Sources

- Runtime routes: `backend/routes/api.php` and `artisan route:list --path=api`
- Roles/permissions/sample actors: `backend/database/seeders/DatabaseSeeder.php`
- Auth/RBAC: `AuthController`, `LoginRequest`, `EnsureUserHasPermission`, session/CORS config
- Domain behavior: API controllers, Form Requests, Fee Agreement and Billing services
- Persistence: migrations and Eloquent models
- UI behavior: `frontend/src/App.tsx`, `frontend/src/api.ts`, and responsive/print CSS
- Edge cases: 92 PHPUnit feature/unit tests, especially agreement, charge, allocation, payment, receipt, summary, and category-monthly suites
- Current scope: `IMPLEMENTATION_STATUS.md`, `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `UAT_CHECKLIST.md`, and `DEMO_REVIEW_SCRIPT.md`
- Approved future auth/user design: `docs/superpowers/specs/2026-07-12-username-auth-user-management-design.md`
- Draft business-rule caveats: `docs/business-rules/business-rules-v0.1.md`
- Historical context only: PRD, decisions, roadmap, backlog, and business-workflow discovery documents
