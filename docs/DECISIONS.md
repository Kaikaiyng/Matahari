# Product and Technical Decision Log

Version: 0.1
Date: 2026-06-25

This document records default decisions for the MVP. Items marked "Needs confirmation" should be reviewed with the school before implementation hardens.

## Decision Summary

| Area | Decision | Status |
| --- | --- | --- |
| Product positioning | Build School Fee & Receipt Management first, not full ERP | Adopted |
| Backend | Laravel + MySQL | Adopted |
| Frontend | React + TypeScript + TailwindCSS | Adopted |
| Multi-school | Every school-owned business record uses `school_id` | Adopted |
| Fee history | Invoice line items are snapshots | Adopted |
| Discount engine | Explicit student-assigned discounts, no complex rule engine in MVP | Adopted |
| Receipt sequence | Backend transaction with locked sequence row | Adopted |
| Payment deletion | Void payments, do not hard-delete | Adopted |
| Receipt deletion | Void receipts, do not reuse receipt numbers | Adopted |
| Class model | Use a `classes` table from day one | Adopted |
| Payment allocation | Database supports multiple invoices; first UI can focus on one invoice | Adopted |
| Receipt generation | Auto-generate receipt when payment is confirmed | Needs confirmation |
| One-time fees | Track target billing month and include once | Needs confirmation |
| Discount scope | Apply to whole invoice in MVP | Needs confirmation |
| Email sending | Defer from MVP | Adopted |
| Payment proof upload | Defer unless school needs bank reconciliation immediately | Needs confirmation |

## 1. Product Positioning

Decision:

Start with School Fee & Receipt Management.

Reason:

The most painful current workflow is monthly Excel-based fee administration. Solving invoices, payments, receipts, outstanding tracking, and reports gives the fastest practical value.

Impact:

- Attendance, teacher management, parent portal, timetable, and mobile app stay outside MVP.
- Dashboard and reports focus on finance first.
- Sales/demo language should emphasize replacing Excel finance workflows.

## 2. Backend Stack

Decision:

Use Laravel + MySQL for MVP.

Reason:

Laravel is strong for admin systems, authentication, policies, validation, reports, queues, PDF, Excel export, and VPS deployment. MySQL fits the business data model and expected scale.

Impact:

- Use Laravel migrations as the source of truth for schema.
- Use Laravel policies/middleware for school-level authorization.
- Use services for invoice generation, payment allocation, and receipt sequencing.

## 3. Frontend Stack

Decision:

Use React + TypeScript + TailwindCSS.

Reason:

The UI is an admin application with dashboards, tables, forms, filters, and workflows. React and Tailwind support fast iteration and a clean SaaS-style interface.

Impact:

- Frontend should be a practical admin UI, not a marketing site.
- Use reusable table, filter, form, dialog, and KPI card components.
- Red accent should be used sparingly for primary actions and warnings.

## 4. Multi-School Data Boundary

Decision:

Every school-owned business record includes `school_id`.

Reason:

IEM may later add kindergartens and future schools. School-level users must only see their own records; CEO and Super Admin can see group reports.

Impact:

- `school_id` appears on students, parents, classes, fees, discounts, invoices, payments, receipts, and audit logs.
- Queries must be scoped by school except for group-level roles.
- Unique constraints are usually per school, not global.

## 5. Invoice Snapshot

Decision:

Invoices must snapshot fee and discount details at generation time.

Reason:

Historical invoices must remain correct even if current fee structures change.

Impact:

- `invoice_items` stores description, type, source reference, quantity, unit amount, and line total.
- Reports use invoice/payment records, not current fee assignments.
- Editing a fee item does not update old invoices.

## 6. Discount Logic

Decision:

Use explicit assigned discounts in MVP.

Reason:

Rules like sibling discount, referral discount, and scholarship can be represented as assigned fixed or percentage discounts without building a complex engine.

Impact:

- `discount_items` defines reusable discount types.
- `student_discount_assignments` stores the actual value and effective dates.
- MVP applies discounts to the whole invoice unless confirmed otherwise.

Needs confirmation:

Whether discounts ever apply only to specific fee items, e.g. tuition only but not transport.

## 7. Payment Allocation

Decision:

Database supports payment allocation, but MVP UI can start with one payment to one invoice.

Reason:

Schools may eventually receive one bank transfer that covers multiple months or siblings. The schema should not block that future need.

Impact:

- `payments` stores the received amount.
- `payment_allocations` links payment amounts to invoices.
- First UI can hide multi-invoice allocation until needed.

Needs confirmation:

Whether Matahari currently receives one payment that covers several months, siblings, or invoices.

## 8. Receipt Generation

Default decision:

Generate receipt automatically when payment is confirmed.

Reason:

Admin expects a receipt after recording payment, and automatic generation reduces missed receipts and manual steps.

Impact:

- Recording a confirmed payment triggers receipt sequence generation.
- Receipt can be reprinted/downloaded.
- If a payment is voided, the receipt should also be voided or clearly marked as invalid.

Needs confirmation:

Some schools may want a separate "Generate Receipt" click after checking payment proof. If so, receipt generation should be manual for bank transfer and automatic for cash.

## 9. Receipt Numbering

Decision:

Receipt numbers are backend-only and generated inside a database transaction.

Format:

```text
MIS-2026-000001
```

Reason:

Duplicate receipt numbers are one of the current Excel risks.

Impact:

- Use `receipt_sequences` with row locking.
- Never reuse voided receipt numbers.
- Do not allow normal users to edit receipt numbers.

## 10. One-Time Fees

Default decision:

One-time fees use a target billing month and should be included once.

Reason:

Registration and material fees should not appear every month.

Impact:

- `student_fee_assignments.billing_month` can target a one-time fee.
- Invoice generation checks whether the one-time fee has already been billed.

Needs confirmation:

Whether one-time fees should be automatically selected by billing month or manually selected during invoice generation.

## 11. Invoice Adjustments

Decision:

Allow invoice edits before payment. After payment exists, use void/reissue or controlled adjustment.

Reason:

Financial records should not silently change after collection starts.

Impact:

- UI should lock major invoice amount edits once paid_amount > 0.
- Adjustment lines can be added later if required.
- Audit logs should capture all correction actions.

## 12. Email and WhatsApp

Decision:

Defer email and WhatsApp sending from MVP.

Reason:

The first version should focus on internal admin reliability. Communication automation can be added after invoice and receipt data are trusted.

Impact:

- PDFs can be downloaded manually first.
- Future modules can send invoice reminders, receipts, and overdue notices.

## 13. Payment Proof Upload

Default decision:

Defer from MVP unless current bank transfer reconciliation is painful.

Reason:

File upload adds storage, preview, permissions, and backup considerations. It is useful but not required for the first finance workflow.

Needs confirmation:

Whether finance staff currently need to attach bank slips or QR screenshots.

## 14. Items to Confirm with User or School

Before implementation begins, confirm:

1. Do parents often pay multiple invoices or siblings in one transaction?
2. Should receipt be automatic for all payment methods?
3. Should bank transfer payments have a pending verification status?
4. Are discounts always applied to the full invoice?
5. How are one-time fees currently handled in Excel?
6. Does the school need payment proof uploads in MVP?
7. What exact receipt format and fields are required?
8. What is the official school code for receipt prefix: `MIS` or something else?
