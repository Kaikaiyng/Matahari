# Business Workflow Discovery

> **Historical discovery record (June 2026).** Questions and target flows are retained for stakeholder context. The implemented demo flow is documented in [Demo Review Script](DEMO_REVIEW_SCRIPT.md), [UAT Checklist](UAT_CHECKLIST.md), and [Implementation Status](IMPLEMENTATION_STATUS.md).

Version: 0.1
Date: 2026-06-26
Product: IEM Education Platform
Initial school: Matahari International School

## 1. Purpose

This document records the business workflows that must be understood before building deeper features.

The product should digitize Matahari's existing administration process instead of forcing the school to change how it works. The software can improve control, validation, reporting, and auditability, but the staff workflow should remain familiar.

## 2. Core Operating Flow

```text
New Student
        ->
Admission
        ->
Create Student and Parent Records
        ->
Assign Fee Template
        ->
Apply Discount Rules or Overrides
        ->
Generate Monthly Invoice
        ->
Payment
        ->
Receipt
        ->
Outstanding Follow-up
        ->
Monthly Report
```

## 3. Student Admission Discovery

Questions to confirm with administration:

- Who creates a new student record?
- What exact student ID format is used today?
- Is the student ID manually assigned or automatically generated?
- What admission statuses exist before a student becomes active?
- Which fields are mandatory before billing can begin?
- Can a student start mid-month?
- How are withdrawals, graduates, and inactive students handled?

Target system behavior:

- Only active students should be included in normal monthly invoice generation.
- Student status changes should be audited.
- Incomplete billing setup should be visible before monthly generation.

## 4. Fee Structure Creation

Questions to confirm:

- What fee groups currently exist?
- Are fees different by level, class, programme, or branch?
- Which fees are monthly?
- Which fees are one-time?
- Which fees are optional, such as transport?
- Who is allowed to edit standard tuition?
- Does a fee change apply immediately or from a future month?

Target system behavior:

```text
Fee Template
        ->
Assign Template to Student
        ->
Optional Override
        ->
Invoice Snapshot
```

Examples:

- Nursery Fee
- Primary Year 1 Fee
- Primary Year 2 Fee
- Transport Add-on

Important rule:

Editing a current fee template must not change invoices that were already generated.

## 5. Discount Rules

Questions to confirm:

- What discount types exist today?
- Are discounts fixed amount or percentage?
- Are sibling discounts calculated automatically or manually approved?
- Do discounts apply to the full invoice or only selected fees?
- Can multiple discounts be stacked?
- Who approves scholarships or special discounts?
- Should discounts expire automatically?

Target system behavior:

- Discounts should be structured records, not Excel formulas.
- Each discount should have a reason or approval note when needed.
- Invoice generation should snapshot discount name, type, value, and calculated amount.

## 6. Monthly Billing Process

Current Excel-based process:

```text
Previous Month Excel
        ->
Copy Sheet
        ->
Change Month
        ->
Change Receipt Number
        ->
Change Date
        ->
Manual Payment Recording
        ->
Manual Outstanding Checking
```

Target system process:

```text
Select School
        ->
Select Billing Month
        ->
Preview Active Students
        ->
Review Missing Fee Templates
        ->
Generate Invoices
        ->
Review Created and Skipped Invoices
```

Questions to confirm:

- What date are monthly invoices normally created?
- What due date is used?
- Are invoices generated for all students at once or by class?
- Should admin preview before generation?
- What should happen if a student has no fee template?
- Can invoices be regenerated after voiding?

## 7. Payment Methods

Supported MVP methods:

- Cash
- Bank Transfer
- QR

Future method:

- Online payment

Questions to confirm:

- Are bank transfers verified before receipt issuance?
- Are QR payments treated as confirmed immediately?
- Do parents pay one invoice at a time or multiple invoices together?
- Do parents pay siblings together?
- Are reference numbers mandatory for bank transfer?
- Does finance need payment proof uploads in MVP?

Target system behavior:

- Payments update invoice balance and status.
- Partial payments are allowed.
- The database supports future multi-invoice allocation even if the first UI starts simple.

## 8. Receipt Issuance

Required workflow:

```text
Invoice Created
        ->
Waiting Payment
        ->
Payment Received
        ->
Receipt Generated
```

Important rules:

- Invoice and receipt are separate objects.
- A receipt is generated only after payment exists.
- Receipt numbers are generated from `receipt_sequences`.
- Do not use `MAX(receipt_no) + 1`.
- Voided receipt numbers are never reused.

Questions to confirm:

- Should receipts be automatic after payment confirmation?
- Should bank transfer receipts require a manual verification step?
- What exact receipt fields are required?
- Does the receipt need school stamp/signature?
- Should receipt PDF be printable on A4 or thermal format?

## 9. Outstanding Handling

Questions to confirm:

- When is an invoice considered overdue?
- Does the school use grace periods?
- Who follows up overdue accounts?
- Are late fees charged?
- How are partial payments followed up?
- How should inactive students with outstanding balances be handled?

Target system behavior:

- Dashboard shows overdue accounts.
- Outstanding report is filterable by school, class, month, and student.
- Student ledger shows all invoices, payments, receipts, and outstanding balance.

## 10. Refund and Correction Process

Questions to confirm:

- Does the school issue refunds?
- Are refunds paid by cash, bank transfer, or credit note?
- Who approves refunds?
- Are overpayments carried forward to next month?
- How are wrong payments corrected today?

Target system behavior:

- Financial records should be voided or adjusted, not hard-deleted.
- Audit logs should capture old values and new values.
- Refund support can be deferred if the current workflow rarely needs it.

## 11. Reporting Process

Questions to confirm:

- What daily report does finance prepare?
- What monthly report does the principal need?
- What group report does the CEO need?
- What Excel columns are required for export?
- Are reports based on payment date, receipt date, or invoice month?
- Should voided payments and receipts appear in reports?

MVP reports:

- Daily Collection
- Monthly Collection
- Outstanding
- Payment History
- Student Ledger
- Receipt Listing

## 12. Discovery Output Required Before Next Build Phase

Before implementing deeper CRUD and PDF workflows, collect:

- Real Excel sample structure, with sensitive data removed if needed.
- Official student ID and receipt number formats.
- Fee templates and fee item list.
- Discount rules and approval rules.
- Monthly billing calendar.
- Required receipt PDF fields.
- Required daily and monthly report columns.
- Rules for voids, refunds, overpayments, and write-offs.
