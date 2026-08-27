# Business Rules

**Status:** Verified current behavior plus confirmed intended policy

**Repository baseline:** Role and User Abilities delivery (2026-08-23)

This document separates policy from implementation. A confirmed intended rule is not described as enforced unless the backend or schema proves it.

## Tenant Rules

- The request hostname, not a submitted tenant ID, selects the tenant.
- Only active tenants and active, explicitly verified domains resolve in production.
- Each school/campus belongs to exactly one tenant; business records remain school-scoped.
- A global user identity needs an active tenant membership. Roles and permitted schools are evaluated from that membership.
- Tenant/platform configuration belongs to the explicit Super Admin platform owner and is never inferred from an ordinary role.
- Tenant status, domain activation, branding, features, schools and memberships are audited transactionally.
- Migration never guesses customer campus grouping, production domains, guardian/student identities, portal activation or academic dates.

## Employee Access Rules

- Employee positions are exactly School Admin, Finance, and Teacher; one employee holds one position at a time.
- Finance includes every School Admin default plus supported finance-only mutations.
- Authorized same-school Admins may grant or deny another employee's grantable User Abilities, but cannot edit themselves, platform owners, cross-school users, or platform-only abilities.
- Manage implies View. Removing View removes dependent Manage selections.
- Every position, User Ability, or Teacher App Access update requires a reason and its Audit Trail record in the same transaction.
- App personas are exactly Teacher, Parent, and Student. Elevated employees remain Teacher in the App; there is no Staff persona.

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
- Teacher class Attendance is limited to a current same-school teaching assignment and enrolled roster unless a school-scoped, time-bound Attendance ability explicitly grants broader access. Parent reads require the reviewed academic capability. Student self-service does not expose Attendance.
- Attendance values are `present`, `late`, `absent`, and `excused`. Corrections require a reason, preserve original marker metadata, and write their audit event in the same transaction.
- `unmarked` is a client/read-model state for a current enrolment without an attendance record. It is never persisted and cannot erase an existing record.
- Campus Attendance and class Attendance are separate records. Campus events are immutable `entry` or `exit` movements; multiple movements per day are preserved. A vendor/source external event ID is idempotent, while distinct events remain a full timeline. School-wide arrival/dismissal times determine Late and Early Leave display flags.
- Active guardians receive in-app entry and exit notifications by default. Admin may change those two school-wide notification defaults. Card/device credentials are encrypted and face templates are not stored by RYLAY.

Approved future rules:

- Manual in-app payment reminders are implemented for V1. Laravel rechecks the student's confirmed current enrolment and current outstanding data before resolving active same-school finance-enabled guardian accounts. Notification creation and `payment.reminder_sent` audit persistence share one transaction; no balance, enrolment, or recipient fails closed without a partial send. Automatic scheduling and external delivery are later work.
- Notification amount snapshots, if approved for display/audit, never become the financial source of truth.
- Notification producers use channel-neutral messages and targets. In-app notifications remain user-addressed; external destinations are separate operational addresses and never imply a RYLAY user identity. Exact scopes are global (no tenant/school), tenant (tenant only), or school (tenant plus a school owned by it). No external channel may bypass host-resolved tenant, membership, permission, or school authorization.
- External destinations store no provider credential. Telegram sending, Bot tokens, user binding/login, queue/outbox, retries, delivery history, and management UI are not implemented.

School Updates enforce host-resolved tenant and school scope, effective `community.publish`, whole-school or one-or-more active same-school class audiences, immediate text plus optional image publication, optional deduplicated in-app notifications, Likes, Post Reports, and transactional audit. Effective publish authority is not narrowed by employee position or Teaching Assignment after the ability check. Parent and Student identities have read, Like, and Post Report access; they never gain publish/manage authority from their persona. Active report reasons are exactly `incorrect`, `outdated`, `inappropriate`, or `other`, with optional details limited to 1,000 characters; authors and moderators are not offered reporting. Comments, new direct-Student targeting, user blocking, restrictions, appeals, and routine approval are not active workflows. Historical Community comments, direct-Student posts, reports, pending/rejected rows, restrictions, and appeals remain preserved storage; historical restrictions are audit-only and do not block current Update text/image publication. Non-manager authors cannot publish historical pending/rejected rows by editing; an authorized manager can discover and explicitly publish them with transactional audit. Author withdrawal requires the author to retain effective same-school `community.publish` and keeps its optional fixed reason even when the author also moderates; `community.moderate` independently permits management, and a manager withdrawing another author's post must provide a reason. Both paths preserve records and use distinct report action/resolution codes. Assessment enforces Teaching Assignment targets, draft-only editing, complete current-roster publication, published-only portal reads, and transactional audit. Class Schedule records are school/year/class scoped, portal-visible only after explicit publication, and read through current enrolment plus guardian academic access. Internal Calendar records are not implicitly family-visible. No grade formulas, historical dates, or timetable records are inferred. Formal Quiz uses only `multiple_choice` and `true_false`, exactly one correct option, explicit academic-year recipient materialization, hidden answer keys, and server scoring. Practice Quiz generation, AI, automatic/external reminders, push, and native packaging remain unimplemented.

## Historical Community UGC Safety (replaced by active School Updates)

The policy-acceptance gate and active School Update Post Reports remain current. Every rule below about freeform social contribution, blocking, Community restrictions, or appeals is a historical compatibility record only: it must not be used to enable or block the active School Updates workflow.

- Current Terms and Community Standards must be accepted before the authenticated Community App shell is available. If policy status cannot be verified, the App remains blocked and offers retry. School Update Post Reporting remains available after access; user blocking is historical-only.
- **Historical only:** Student freeform interaction required active reviewed adult authorization; Students could not self-authorize.
- **Historical only:** Non-moderator social posts/comments entered `pending_review`; approval/rejection preserved author, audit, and appeal history. This is not the active Update publication path.
- **Historical only:** A non-moderator edit of published social content returned it to `pending_review`. Active published Updates remain published on an authorized author edit, while old pending/rejected rows require a manager transition.
- **Historical only:** Content/user blocks affected social content and reactions. Blocking is not an active School Updates feature and never hides official Updates.
- Report lifecycle is `submitted` → `reviewing` → `resolved`. Severe cases target 4 hours and normal cases 24 hours; these are operational targets, not automated legal deadlines.
- Active Post Report decisions require a reason category and written reason and share a transaction with their audit record.
- **Historical only:** Community restriction and appeal decisions shared transactional audit, and one appeal was permitted for applicable social-workflow decisions. These restrictions/appeals do not govern active Updates.
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

## UGC, Child Protection & Account Deletion Rules

- **Pre-Filtering & Normalization**: All user-submitted text undergoes server-side normalization (Unicode FORM_KC, zero-width character stripping) and regex pattern matching against prohibited categories (violence, hate, profanity, grooming, sexual content).
- **Contact Leakage Prevention**: Text containing phone numbers, email addresses, external URLs, or messaging handles (WhatsApp, Telegram, WeChat, IG, TikTok, LINE) is flagged as privacy exposure and blocked from immediate public display.
- **Pre-Social Safety Warnings**: Student users must see an in-app safety reminder banner/modal before composing posts or comments.
- **Parental Social Control**: Parent/Guardian accounts retain granular permissions (`can_post_community`, `can_upload_media`) to control or restrict their child's freeform social interactions.
- **No 1-on-1 Private Messaging**: All Community interaction is school/class-scoped and visible to authorized staff. Unmonitored direct messaging or random user discovery is strictly prohibited.
- **Account Provisioning & Deletion Policy**:
  - RYLAY uses institution-provisioned accounts managed by school administrators. Self-registration is disabled.
  - To comply with App Store and Google Play requirements, users/guardians may request account deletion via the in-app Profile settings or the public HTTPS page `https://rylay.my/account-deletion`.
  - Upon processing an approved deletion request, personal identity info (PII), credentials, and non-essential social content are purged/anonymized. Academic and financial history (fee agreements, payment receipts) are legally preserved in anonymized form for compliance and audit requirements.
