# MVP Roadmap and Product Decisions

> **Historical delivery plan (June 2026).** Phase names and proposed deliverables remain useful context, but the implementation evolved toward Fee Agreements and Fee Record charges. See [Implementation Status](IMPLEMENTATION_STATUS.md) and [Database Design](DATABASE_DESIGN.md) for the current state.

Version: 0.2
Date: 2026-06-26

## Product Positioning

Start with a narrow, valuable product:

```text
IEM Education Platform
First MVP: Finance and Billing
```

Do not position the first version as a full ERP. The first version should win trust by making invoices, payments, receipts, and outstanding reports reliable, while the platform name stays broad enough for future modules.

## Recommended Delivery Phases

### Phase 1: Foundation

Goal: Establish secure multi-school basics.

Deliverables:

- Authentication
- User accounts
- Roles
- Modules and permissions
- School management
- School-level data scoping
- Audit log foundation

### Phase 2: Core Records

Goal: Replace basic student and parent spreadsheet records.

Deliverables:

- Student CRUD
- Parent CRUD
- Student-parent linking
- Class/status filtering
- Student profile view

### Phase 3: Fee Setup

Goal: Model the current Excel fee setup in structured data.

Deliverables:

- Fee template management
- Fee item management
- Student fee template assignment
- Student fee overrides and optional add-ons
- Discount item management
- Student discount assignment
- Recurring and one-time fee support

### Phase 4: Monthly Billing Workflow

Goal: Replace the monthly copy-sheet process.

Deliverables:

- Monthly invoice generation
- Invoice preview
- Duplicate invoice prevention
- Invoice item snapshots
- Invoice status management
- Invoice PDF

### Phase 5: Payment and Receipt Workflow

Goal: Make collection and receipt handling reliable.

Deliverables:

- Payment recording
- Partial payment support
- Payment void flow
- Receipt sequence generation
- Receipt PDF
- Receipt void flow

### Phase 6: Reporting and Dashboard

Goal: Give admins, principals, and CEO trusted visibility.

Deliverables:

- Dashboard metrics
- Daily collection report
- Monthly collection report
- Outstanding report
- Payment history
- Student ledger
- Receipt listing
- Excel/PDF export

### Phase 7: Hardening and Deployment

Goal: Prepare for real school use.

Deliverables:

- Permission review
- Audit log coverage
- Data validation
- Backup strategy
- Docker deployment
- Nginx configuration
- Ubuntu VPS deployment notes
- User acceptance testing checklist

## MVP Decisions Already Leaning Toward

### Backend

Recommendation: Laravel + MySQL.

Reason:

- Strong fit for admin CRUD, finance workflows, PDF, Excel export, validation, auth, and deployment on a VPS.
- Easier to maintain for a small local/business application.
- Good long-term ecosystem for reports, queues, email, and role permissions.

### Discount Logic

Recommendation: Use explicit assigned discounts in MVP.

Do not build a complex rule engine yet. Each student can have fixed or percentage discounts, with effective dates and notes. Invoice generation stores discount snapshots.

### Fee and Invoice Integrity

Recommendation: Snapshot all invoice items.

Invoices must store the fee template, fee item, override, and discount details used at generation time. Old invoices must not recalculate when current fee settings change.

### Permission Model

Recommendation: Use Role -> Permission -> Module.

Seed default roles, but check permission slugs in policies and controllers instead of hardcoding role behavior.

### Invoice and Receipt Separation

Recommendation: Keep invoice and receipt as separate objects.

An invoice is a bill. A receipt is proof of payment. A receipt should only be generated after payment exists.

### Receipt Numbering

Recommendation: Backend-only receipt sequence.

Receipt numbers should be generated inside a database transaction. Each school and year should have an independent sequence.

Example:

```text
MIS-2026-000001
MIS-2026-000002
KGA-2026-000001
```

### Payment Deletion

Recommendation: Never hard-delete payments.

Mistakes should be handled through voiding with a reason and audit record.

## Open Product Decisions

These should be confirmed before database design is finalized.

1. What real fee templates does Matahari use today?
2. Should one payment be allowed to pay multiple invoices from day one?
3. Should invoices be generated for all active students, selected classes, or selected students?
4. Should invoice numbers have their own prefix and sequence separate from receipt numbers?
5. Should registration fee be one-time and automatically excluded after first invoice?
6. Can discounts apply only to selected fee items, or always to the whole invoice?
7. Should admin be allowed to manually adjust invoice amount after generation?
8. Should receipt be generated automatically after payment, or by a separate click?
9. Should email invoice/receipt sending be included in MVP?
10. Should class be a proper table in MVP, or just a text field first?
11. Should payment proof upload be included in MVP?

## Recommended Answers for First Build

| Decision | Recommendation |
| --- | --- |
| Fee assignment | Use fee templates first, with student overrides for exceptions. |
| One payment across multiple invoices | Defer unless current school workflow needs it immediately. |
| Invoice generation scope | Support all active students first; add class filter if easy. |
| Invoice number prefix | Yes, but lower risk than receipt numbers. |
| Registration fee | Model as one-time fee with usage tracking. |
| Discount scope | Apply to whole invoice first; item-level later. |
| Manual invoice adjustment | Allow before payment only; after payment use void/reissue or adjustment. |
| Receipt generation | Generate automatically when payment is confirmed, with reprint option. |
| Email sending | Defer to phase 2. |
| Class model | Use simple class table if building database fresh. |
| Payment proof upload | Defer unless bank transfer reconciliation is painful now. |

## Next Recommended Artifact

The next useful artifact is business workflow discovery with Matahari administration, followed by database design updates from confirmed workflow details.

Suggested output:

- Entity relationship diagram
- Table list
- Key columns
- Important unique constraints
- Receipt sequence transaction design
- Invoice generation pseudo-flow
- Fee template assignment flow
- Role-permission matrix
