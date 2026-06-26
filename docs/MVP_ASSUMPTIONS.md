# MVP Working Assumptions

Version: 0.1
Date: 2026-06-25

These assumptions let implementation proceed before every school workflow detail is confirmed. They are intentionally conservative and can be revised after user acceptance testing.

## 1. Product Scope Assumptions

The MVP is a School Fee & Receipt Management System.

Included:

- School setup
- User roles
- Student records
- Parent records
- Fee items
- Student fee assignments
- Student discount assignments
- Monthly invoice generation
- Payment recording
- Receipt generation
- Dashboard
- Financial reports
- Audit logs

Excluded from MVP:

- Attendance
- Teacher management
- Parent portal
- WhatsApp reminders
- Email automation
- Online payment gateway
- Mobile app
- Accounting software integration

## 2. School and Role Assumptions

- The first school is Matahari International School.
- The initial school receipt prefix is `MIS`.
- Future schools should be added through database records, not code changes.
- School Admin and Finance users are assigned to one school.
- CEO and Super Admin can access group-level data.
- Finance can create invoices, record payments, generate receipts, and view reports.
- Finance cannot manage users or schools.

## 3. Student and Parent Assumptions

- Every student belongs to one school.
- Every student may optionally belong to one current class.
- Class is a real table in MVP, not only a text field.
- Student status controls billing inclusion.
- Only `active` students are included in monthly invoice generation.
- A parent can be linked to multiple students.
- A student can be linked to multiple parents or guardians.

## 4. Fee Assumptions

- Fee items are configured per school.
- A student can have multiple assigned fee items.
- Assigned fee amount can override the fee item's default amount.
- Fee assignment supports recurring and one-time fees.
- One-time fees use a target billing month and should be billed once.
- Old invoices do not change when fee assignments change later.

## 5. Discount Assumptions

- Discounts are explicitly assigned to students.
- Discount types support fixed amount and percentage.
- Discount assignments have optional start and end dates.
- MVP applies discounts to the whole invoice total.
- Item-level discount targeting is deferred.
- Old invoices do not change when discount assignments change later.

## 6. Invoice Assumptions

- Invoices are generated monthly.
- Invoice generation can start with all active students in a school.
- Class filter is useful and should be supported if implementation cost is low.
- The system prevents duplicate non-void invoices for the same student and month.
- Invoice items are snapshots.
- Invoice number has its own sequence separate from receipt number.
- Invoice can be edited before payment.
- After payment exists, invoice amount changes require void/reissue or controlled adjustment.

## 7. Payment Assumptions

- MVP UI records one payment against one invoice.
- Database supports future multi-invoice allocation.
- Payment methods are cash, bank transfer, QR, and future online payment.
- Cash and QR can be treated as confirmed when recorded.
- Bank transfer is recorded with a reference number.
- Bank transfer verification status is deferred unless school explicitly requires it.
- Payments are never hard-deleted.
- Mistakes are handled by voiding the payment with a reason.

## 8. Receipt Assumptions

- Receipt is generated automatically when a payment is confirmed.
- Each payment produces one receipt in MVP.
- Receipt number format is:

```text
MIS-2026-000001
```

- Receipt number is generated only by backend.
- Receipt sequence is separate per school, year, and prefix.
- Voided receipt numbers are never reused.
- Receipt PDF is required in MVP.

## 9. Reporting Assumptions

- Reports use actual invoice, payment, and receipt records.
- Reports do not rely on manually entered monthly summary values.
- Void payments and void receipts are excluded from collection totals.
- Void invoices are excluded from outstanding reports.
- The first required reports are:
  - Daily Collection
  - Monthly Collection
  - Outstanding
  - Payment History
  - Student Ledger
  - Receipt Listing

## 10. Deployment Assumptions

- Initial deployment is on one Ubuntu VPS.
- Docker is used for app services.
- Nginx handles reverse proxy.
- Cloudflare handles DNS.
- SSL uses Let's Encrypt.
- MySQL backup is required before production use.

## 11. Assumptions to Recheck During UAT

Recheck these with school staff:

1. Do parents commonly pay several months or siblings in one transaction?
2. Does bank transfer need pending/verified status?
3. Does receipt need manual approval before generation?
4. Are discounts ever limited to tuition only?
5. How are registration fees currently billed and tracked?
6. Is payment proof upload required for daily work?
7. What exact fields must appear on receipt PDF?
8. What reports are currently sent to the principal or CEO every month?
