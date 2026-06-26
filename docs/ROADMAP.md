# MVP Roadmap and Product Decisions

Version: 0.1
Date: 2026-06-25

## Product Positioning

Start with a narrow, valuable product:

```text
School Fee & Receipt Management System
```

Do not position the first version as a full ERP. The first version should win trust by making invoices, payments, receipts, and outstanding reports reliable.

## Recommended Delivery Phases

### Phase 1: Foundation

Goal: Establish secure multi-school basics.

Deliverables:

- Authentication
- User accounts
- Roles
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

- Fee item management
- Student fee assignment
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

Invoices must store the fee and discount details used at generation time. Old invoices must not recalculate when current fee settings change.

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

1. Should one payment be allowed to pay multiple invoices from day one?
2. Should invoices be generated for all active students, selected classes, or selected students?
3. Should invoice numbers have their own prefix and sequence separate from receipt numbers?
4. Should registration fee be one-time and automatically excluded after first invoice?
5. Can discounts apply only to selected fee items, or always to the whole invoice?
6. Should admin be allowed to manually adjust invoice amount after generation?
7. Should receipt be generated automatically after payment, or by a separate click?
8. Should email invoice/receipt sending be included in MVP?
9. Should class be a proper table in MVP, or just a text field first?
10. Should payment proof upload be included in MVP?

## Recommended Answers for First Build

| Decision | Recommendation |
| --- | --- |
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

The next useful artifact is database design.

Suggested output:

- Entity relationship diagram
- Table list
- Key columns
- Important unique constraints
- Receipt sequence transaction design
- Invoice generation pseudo-flow
