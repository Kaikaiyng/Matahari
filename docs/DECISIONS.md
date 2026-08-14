# Product and Technical Decision Log

## Current Superseding Decisions — 2026-08-14

The following decisions supersede the historical platform-name and single-organization assumptions below:

| Area | Current decision | Status |
| --- | --- | --- |
| Platform name | **RYLAY** | Adopted |
| Primary domain | `rylay.my`, registered through Hostinger | Adopted |
| DNS authority | Cloudflare nameservers; no credentials stored in the repository | Adopted |
| Product model | Multi-tenant school SaaS; MIS is the first tenant | Implemented foundation |
| Initial host convention | `{tenant}.rylay.my` Admin, `{tenant}-app.rylay.my` App, `console.rylay.my` platform control | Adopted |
| API topology | Same-origin `/api` reverse proxy per Admin/App host for the initial deployment | Adopted |
| VPS | Not purchased or provisioned | Pending |

The RYLAY platform brand must not overwrite tenant branding or historical school, student, finance, invoice, payment or receipt identifiers. See [SaaS Multi-Tenancy](saas-multitenancy.md) for the current architecture.

> **Historical decision record (June 2026).** Preserve these decisions and open questions as planning history; later implementation differs in several areas. In particular, MIS branding, the separate Community App, Phase A academic/identity foundations, and daily Attendance are now implemented development slices even though this record placed them outside the first finance MVP. Current behavior is documented in [System Architecture](SYSTEM_ARCHITECTURE.md), [Database Design](DATABASE_DESIGN.md), and [Implementation Status](IMPLEMENTATION_STATUS.md).

Version: 0.2
Date: 2026-06-26

This document records default decisions for the MVP. Items marked "Needs confirmation" should be reviewed with the school before implementation hardens.

## Decision Summary

| Area | Decision | Status |
| --- | --- | --- |
| Product positioning | Name platform IEM Education Platform; build finance MVP first | Adopted |
| Backend | Laravel + MySQL | Adopted |
| Frontend | React + TypeScript + TailwindCSS | Adopted |
| Multi-school | Every school-owned business record uses `school_id` | Adopted |
| Fee templates | Standard fees should be assigned through templates before student overrides | Adopted |
| Fee history | Invoice line items are snapshots | Adopted |
| Discount engine | Explicit student-assigned discounts, no complex rule engine in MVP | Adopted |
| Permission model | Role -> Permission -> Module, avoid hardcoded role behavior | Adopted |
| Receipt sequence | Backend transaction with locked sequence row | Adopted |
| Invoice/receipt separation | Invoice is bill; receipt is proof of payment after payment exists | Adopted |
| Audit values | Log old_values and new_values for changed records | Adopted |
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

Use `IEM Education Platform` as the product/platform name, while starting with the finance and billing MVP.

Reason:

The name must support future modules such as Attendance, Teacher, Parent Portal, Academic, and HR. The most painful current workflow is still monthly Excel-based fee administration, so solving invoices, payments, receipts, outstanding tracking, and reports gives the fastest practical value.

Impact:

- Attendance, teacher management, parent portal, timetable, and mobile app stay outside MVP.
- Dashboard and reports focus on finance first.
- Sales/demo language should emphasize replacing Excel finance workflows.
- User-facing platform copy should not lock the product into "fee only" forever.

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

## 6A. Fee Templates

Decision:

Use fee templates as the standard way to assign recurring fees.

Reason:

The school should not need to edit hundreds of student fee rows when tuition changes for a class or programme.

Impact:

- `fee_templates` defines reusable structures such as Nursery Fee or Primary Year 1 Fee.
- `fee_template_items` contains fee items and template amounts.
- `student_fee_template_assignments` assigns the template to a student.
- `student_fee_assignments` remains useful for exceptions and overrides.
- Invoice generation snapshots template items into `invoice_items`.

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

## 8A. Invoice and Receipt Separation

Decision:

Invoices and receipts are separate objects.

Workflow:

```text
Invoice Created
        ->
Waiting Payment
        ->
Payment Received
        ->
Receipt Generated
```

Reason:

An invoice is a request for payment. A receipt is proof that payment was received. Treating them as the same object creates accounting confusion and weak auditability.

Impact:

- One invoice can be pending, partial, paid, overdue, or void.
- A receipt is generated only from a confirmed payment.
- Receipt PDF actions should live under receipt/payment workflows, not invoice creation.

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

## 11A. Audit Old and New Values

Decision:

Audit logs should store machine-readable `old_values` and `new_values` for changed records.

Reason:

For accountability and debugging, "fee updated" is not enough. The system should show what changed, for example RM800 to RM850.

Impact:

- Create actions use `old_values = null` and `new_values = created snapshot`.
- Update actions store changed old and new fields.
- Void/correction actions store status and reason changes.
- Audit UI can later render before/after differences.

## 11B. Permission Model

Decision:

Avoid hardcoded role behavior. Use modules, permissions, and role-permission mapping.

Reason:

The same role name may need different access per school or customer. Permission slugs make the system flexible without code changes.

Impact:

- Seed default roles: Super Admin, CEO, School Admin, Finance.
- Seed modules and permission slugs such as `payment.create`, `receipt.void`, `student.delete`, `report.export`.
- Backend policies check permission slugs and school scope.
- Frontend navigation is derived from allowed permissions.

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
9. What fee templates should be created for Matahari's real programmes?
10. Which reports are required by admin, principal, and CEO on month-end?
