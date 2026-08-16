# Business Rules

**Status:** Verified current behavior plus confirmed intended policy

**Repository baseline:** SaaS feature branch based on `master` at `0ad0558` (2026-08-14)

This document separates policy from implementation. A confirmed intended rule is not described as enforced unless the backend or schema proves it.

## Tenant Rules

- The request hostname, not a submitted tenant ID, selects the tenant.
- Only active tenants and active, explicitly verified domains resolve in production.
- Each school/campus belongs to exactly one tenant; business records remain school-scoped.
- A global user identity needs an active tenant membership. Roles and permitted schools are evaluated from that membership.
- `tenant-owner` cannot administer another tenant. Platform ownership is explicit and is never inferred from ordinary roles or identity fields.
- Tenant status, domain activation, branding, features, schools and memberships are audited transactionally.
- Migration never guesses customer campus grouping, production domains, guardian/student identities, portal activation or academic dates.

## Student Lifecycle

Verified stored/API status values are:

- `active`
- `withdraw`
- `graduate`
- `inactive`

Confirmed policy:

- Normal application workflows must not physically delete a student.
- A student who leaves is represented by a lifecycle status, while administrative and financial history remains traceable.

Current enforcement:

- There is no student delete API.
- Status changes use a dedicated permission-protected endpoint.
- Several foreign keys from finance records use restricted deletion for students.

**Needs confirmation:** Who may move a student between each status, whether transitions are restricted by a state machine, and whether any status change requires a reason or approval. The current endpoint accepts any verified status value and does not store a status-change reason.

## Academic Foundation and Portal Links

- `students.class_id` remains the legacy compatibility value. `class_enrolments` is the new academic-year history source for new academic modules; Phase A does not rewrite the legacy value.
- At most one current class enrolment exists per school, academic year, and student. Ending an enrolment preserves the row and allows a later current enrolment.
- Teaching access is derived from active/current teaching assignments for a teacher, academic year, class, and subject. Teacher APIs do not expose unrelated class rosters.
- Parent and student portal user references are nullable and must be assigned explicitly. Email, phone, and name matching are never used to guess an identity link.
- Existing guardian relationships upgrade as `unreviewed`; finance/academic access flags and current-slot values remain `NULL` until an authorized operator links a reviewed parent user and explicitly activates access.
- Student self-service is academic-only in this phase. Student finance access is not granted.

Implemented Community App/self-service rules:

- Admin Web and mobile surfaces must use the same user, parent, student, school, academic, and finance records.
- A reviewed guardian may have multiple children, and a student may have multiple guardians. Access is evaluated per active relationship and capability flag.
- A guardian with active finance access sees the student's account payment history, not only payments physically made by that guardian.
- Parent outstanding amounts must come from the existing Fee Record and payment-allocation domain logic. A mobile balance ledger or client-side authoritative calculation is forbidden.
- Parent Finance selects the child's explicitly stored current enrolment academic-year code. It must not guess or hard-code a production academic year; a child without a confirmed current enrolment receives no year-specific balance query.
- Parent receipt access reuses the existing immutable receipt snapshot. The App may view it and invoke browser printing/save-as-PDF, but does not create a second receipt definition or server-generated PDF.
- Parent Finance is read-only and exposes no payment interface.
- Teacher daily Attendance is limited to a current same-school teaching assignment and enrolled roster. Parent reads require the reviewed academic capability; Student reads resolve only the linked self record.
- Attendance values are `present`, `late`, `absent`, and `excused`. Corrections require a reason, preserve original marker metadata, and write their audit event in the same transaction.

Approved future rules:

- Manual in-app payment reminders are implemented for V1. Laravel rechecks the student's confirmed current enrolment and current outstanding data before resolving active same-school finance-enabled guardian accounts. Notification creation and `payment.reminder_sent` audit persistence share one transaction; no balance, enrolment, or recipient fails closed without a partial send. Automatic scheduling and external delivery are later work.
- Notification amount snapshots, if approved for display/audit, never become the financial source of truth.

Community, Assessment, and Quiz persistence preserves the approved school scope, audience/target shapes, result publication state, Quiz revisions, question options, materialized assignment recipients, and attempt history. Community enforces scoped publishing, feed visibility, private media delivery, reactions/comments, removal/moderation history, and transactional audit. Assessment enforces Teaching Assignment targets, draft-only editing, complete current-roster publication, published-only portal reads, and transactional audit. Class Schedule records are school/year/class scoped, portal-visible only after explicit publication, and read through current enrolment plus guardian academic access. Internal Calendar records are not implicitly family-visible. No grade formulas, historical dates, or timetable records are inferred. Formal Quiz uses only `multiple_choice` and `true_false`, exactly one correct option, explicit academic-year recipient materialization, hidden answer keys, and server scoring. Practice Quiz generation, AI, automatic/external reminders, push, and native packaging remain unimplemented.

## Community UGC Safety

- Current Terms and Community Standards must be accepted before contribution. Reporting and blocking remain available without contribution acceptance.
- Student freeform interaction also requires active reviewed adult authorization; Students cannot self-authorize.
- Non-moderator posts/comments are private `pending_review` submissions. Approval publishes/releases them; rejection preserves author, audit and appeal history. Public feeds exclude pending/rejected content.
- Content reports, user reports and blocks are distinct. Blocks affect only mutual Community content/reactions, not official records or school communications.
- Report lifecycle is `submitted` → `reviewing` → `resolved`. Severe cases target 4 hours and normal cases 24 hours; these are operational targets, not automated legal deadlines.
- Decisions require a reason category and written reason. Material report/content/restriction/appeal changes and audit records share a transaction.
- One appeal is permitted for the applicable decision; its source moderator cannot decide it.
- Evidence hold/history are preserved. Automated retention/deletion is not implemented; lawful CSAM reporting and retention procedures require external legal and operational approval.

## Fee Agreements

Verified rules:

- Agreements belong to a school, student, and academic year.
- Creating an agreement creates a versioned record. The service writes active current versions and preserves earlier rows.
- Superseding locks the current agreement, marks it `superseded` and not current, and creates a new active current version.
- Agreement items snapshot fee code, description, amount, classification, billing frequency, billing months, and preview metadata.
- The database uniquely identifies a version by school, student, academic year, and `version_no`.
- A nullable `current_slot` unique key enforces at most one current agreement for each school, student, and academic year. Current rows use slot `1`; historical rows use `NULL`.
- School Admin and Super Admin can create/supersede through current seeded permissions. Finance cannot.

Confirmed policy:

- Historical agreements must not be silently edited in place.
- Replacements supersede earlier versions, and history must remain available.
- Finance users must not create or supersede agreements unless a future approved change explicitly grants and enforces that authority.

Current safeguards and limitations:

- Superseding is rejected with HTTP 409 when the earlier agreement has any Fee Record charge on or after the replacement effective month. The transaction leaves both versions unchanged.
- `requires_preview_confirmation` produces an explicit preview warning and blocks activation. No server-bound approval mechanism exists yet.
- Agreement and Fee Record request paths require a four-digit academic year; a new agreement effective date must fall within that year.
- The migration adding current-agreement and scheduled-charge uniqueness aborts instead of guessing how to repair duplicate pre-existing rows.

**Needs confirmation:** The approved policy for future charges when an agreement is replaced mid-year: cancel, credit, recalculate, or preserve them through a separate correction process.

## Discounts

Verified data concepts:

- Discount types: `percentage`, `fixed_amount`.
- Scopes: `tuition_only`, `total_payable`, `selected_fee_items`.
- Agreement discount and selected-item relationships are snapshotted in the database.
- Seed data includes a sibling-discount example. Seed values are demo fixtures, not approved production formulas.

Current limitation and fail-closed behavior:

- Approved discount formulas do not exist. Any agreement containing a non-zero discount is rejected by Fee Record preview and activation instead of generating undiscounted charges.
- Percentage values are capped at 100, selected fee codes must belong to the submitted agreement items, and monetary values are limited to the database-safe range with at most two decimal places. These validation bounds are not a business formula.

**Needs confirmation:** Staff child, sibling, referral, legacy-pricing, scholarship, priority/stacking, proration, eligibility reassessment, removal, approval, and effective-date rules. No formula or percentage should be implemented from historical examples alone.

## Fee Record and Charges

Verified rules:

- Fee Record charges are the source of truth for the implemented outstanding and summary workflows; legacy invoices are separate.
- Preview derives scheduled charges from the current active agreement.
- Activation persists eligible scheduled charges; manual charges use the same ledger with explicit origin.
- Billing states used by the application include `billable` and `no_charge`.
- Collection states include `unpaid`, `partial`, and `paid`.
- Charge origins include `scheduled` and `manual`.

Integrity safeguards:

- `(school_id, fee_agreement_item_id, billing_month)` is unique for scheduled agreement-item charges. Because manual charges use a nullable agreement-item ID, repeated legitimate manual charges remain possible.
- Activation rejects a second generation for the same student, agreement, and academic year.
- Manual charges and scheduled activation write central audit events in the same database transaction; an audit failure rolls the charges back.

## Payments

Verified statuses:

- `pending_verification`
- `verified`
- `voided`

Verified methods:

- `cash`
- `bank_transfer`
- `duitnow_qr`
- `cheque`
- `credit_card`
- `fpx`

Verified workflow:

- School Admin and Super Admin can record payments. Finance does not receive `payments.create` in the current seed.
- Cash payments are recorded as verified immediately, with the recorder also stored as verifier.
- Non-cash payments begin pending verification.
- Finance and Super Admin can verify or void payments.
- Allocations must belong to the same school/student, cannot exceed outstanding charge amounts, and must total the payment amount using cent-based comparison.
- Verification rechecks available outstanding balances while rows are locked.
- Voiding a verified payment reverses its valid charge-allocation effects and records actor, time, and reason.
- A payment cannot be voided while it has an issued receipt.
- There is no payment delete API.

Confirmed policy:

- Verification must be traceable.
- Verified payments must not be silently rewritten.
- Voiding must preserve the original payment and its audit information.

Current audit behavior:

- Record, verify, and void actions emit allowlisted central audit events inside their finance transaction. If the required audit insert fails, the payment mutation is rolled back.
- The schema does not constrain payment status values with an enum/check.
- Payment proof is a nullable string, not a verified upload workflow.

**Needs confirmation:** Maker-checker separation for cash payments, approved proof requirements by method, refund/credit/overpayment/write-off rules, and whether the recorder may verify their own non-cash payment.

## Receipts

Verified workflow:

- Only verified payments can produce receipts.
- One payment may have only one issued receipt at a time.
- Receipt items snapshot payment allocation descriptions and amounts.
- Receipt status values are `issued` and `voided`.
- A void stores actor, time, and reason; regeneration after void uses a new number.
- Receipt numbers are generated under a locked sequence and are unique within a school.
- Current display format is `{school prefix}.A#### (MM/YYYY)`, for example a continuous `A` series with the receipt month/year shown in parentheses.
- The sequence is continuous for `(school, prefix, series)`; it does not reset by year or month.
- There is no receipt delete or edit API. Server-side PDF generation is not implemented; the frontend uses browser printing.

Confirmed policy:

- Receipt numbering must remain stable and traceable.
- Voided numbers must never be reused.

## User Access

- Backend `permission:<slug>` middleware is authoritative for standard student, agreement, Fee Record, payment, receipt, class, and calendar endpoints.
- Frontend button hiding does not grant or deny authority.
- School ownership is checked in multiple controllers, requests, and services, not by a single tenant layer.

Legacy endpoint hardening:

- Dashboard access requires `fee_record.view`; monthly invoice generation requires `fee_record.generate`.
- A school-bound user is forced to their stored school even if another ID is submitted. A global Super Admin must submit an explicit existing school. Invoice actors are derived from the authenticated user, and submitted classes must belong to the resolved school.

See [Permissions](permissions.md) for the complete matrix.

## Historical Record Retention and Deletion

Confirmed policy:

- Student, Fee Agreement, charge, payment, receipt, and material audit history must remain traceable.
- Records must not disappear merely to simplify a workflow.

Current implementation uses status/supersede/void paths and has no delete APIs for students, agreements, payments, or receipts. This does not establish a complete legal retention schedule.

**Needs confirmation:** Retention duration, archival, privacy deletion/anonymization obligations, backup expiry, and who may approve exceptional data correction or erasure.

## Financial Integrity

Verified safeguards include transactions, row locks for critical payment/receipt/agreement paths, decimal database columns, cent-based payment allocation comparison, stable receipt sequencing, and actor/timestamp/reason fields for verification/void operations.

Known limitations:

- Legacy invoice calculations and some summaries use PHP floating-point operations. Do not claim all application financial calculations are decimal-safe.
- Discounted charge generation is unavailable until formulas and approval behavior are confirmed; it fails closed rather than billing the wrong amount.
- Agreements with existing charges on or after a proposed replacement month require a future approved correction/reconciliation workflow before superseding.
- Current central audit coverage includes agreement create/supersede, Fee Record activation/manual charges, payment record/verify/void, and receipt issue/void. Generic corrections, refunds, credits, write-offs, and exports are not implemented.
- Production MariaDB runtime grants, backups, binary logging, and restore reconciliation are **Not verified**.

These limitations must be resolved and tested before describing the finance workflow as production-ready.
