# Business Rules

**Status:** Verified current behavior plus confirmed intended policy

**Repository baseline:** `14adce9508992c03c4249d49308a3841c198f4bd`

This document separates policy from implementation. A confirmed intended rule is not described as enforced unless the backend or schema proves it.

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

## Fee Agreements

Verified rules:

- Agreements belong to a school, student, and academic year.
- Creating an agreement creates a versioned record. The service writes active current versions and preserves earlier rows.
- Superseding locks the current agreement, marks it `superseded` and not current, and creates a new active current version.
- Agreement items snapshot fee code, description, amount, classification, billing frequency, billing months, and preview metadata.
- The database uniquely identifies a version by school, student, academic year, and `version_no`.
- School Admin and Super Admin can create/supersede through current seeded permissions. Finance cannot.

Confirmed policy:

- Historical agreements must not be silently edited in place.
- Replacements supersede earlier versions, and history must remain available.
- Finance users must not create or supersede agreements unless a future approved change explicitly grants and enforces that authority.

Important gaps:

- The database does not enforce that only one agreement is current for a student/year.
- Old activated future Fee Record charges are not reconciled when an agreement is superseded. Activating the replacement can leave old and new future charges outstanding.
- `requires_preview_confirmation` is stored, but the backend does not enforce a general confirmation step based on that flag.
- Agreement academic-year validation and Fee Record academic-year validation do not use the same format.

**Needs confirmation:** The approved policy for future charges when an agreement is replaced mid-year: cancel, credit, recalculate, or preserve them through a separate correction process.

## Discounts

Verified data concepts:

- Discount types: `percentage`, `fixed_amount`.
- Scopes: `tuition_only`, `total_payable`, `selected_fee_items`.
- Agreement discount and selected-item relationships are snapshotted in the database.
- Seed data includes a sibling-discount example. Seed values are demo fixtures, not approved production formulas.

Current limitation:

- Agreement discounts are not applied by Fee Record preview or activation. Generated charges currently use agreement item amounts directly.
- Percentage and fixed-value business bounds are incomplete.

**Needs confirmation:** Staff child, sibling, referral, legacy-pricing, scholarship, priority/stacking, proration, eligibility reassessment, removal, approval, and effective-date rules. No formula or percentage should be implemented from historical examples alone.

## Fee Record and Charges

Verified rules:

- Fee Record charges are the source of truth for the implemented outstanding and summary workflows; legacy invoices are separate.
- Preview derives scheduled charges from the current active agreement.
- Activation persists eligible scheduled charges; manual charges use the same ledger with explicit origin.
- Billing states used by the application include `billable` and `no_charge`.
- Collection states include `unpaid`, `partial`, and `paid`.
- Charge origins include `scheduled` and `manual`.

Integrity gap:

- The `(school, fee_agreement_item, billing_month)` database index is not unique. Current duplicate prevention is service-level and scoped to an agreement, so it does not resolve superseded-version overlap.

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

Current limitation:

- Payment records store actor/time/reason fields, but normal payment actions do not emit records through the new audit logger.
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

Exception:

- The legacy dashboard and monthly invoice-generation endpoints require authentication only. They do not enforce a specific permission or the authenticated user's school. This contradicts the intended backend-authorization rule and is an open security issue.

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
- Discounts do not affect the active Fee Record calculation.
- Superseding an agreement can leave overlapping future charges.
- Normal financial mutations are not integrated with the audit logger.
- Production MariaDB runtime grants, backups, binary logging, and restore reconciliation are **Not verified**.

These limitations must be resolved and tested before describing the finance workflow as production-ready.
