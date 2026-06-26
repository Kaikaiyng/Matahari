# MVP User Acceptance Test Checklist

Version: 0.1
Date: 2026-06-25

This checklist defines what the first usable version must prove. The goal is to confirm that the system can replace the school's Excel-based fee workflow for a normal billing month.

## 1. Test Roles

Prepare test users:

- Super Admin
- CEO
- School Admin
- Finance

Acceptance:

- Each user can log in.
- Each user sees only the navigation allowed for their role.
- School-level users cannot access another school's data.
- CEO can see group-level reports.

## 2. School Setup

Test data:

- School name: Matahari International School
- School code: MIS
- Receipt prefix: MIS

Acceptance:

- School profile can be created and edited.
- Receipt prefix is stored.
- School status can be active or inactive.

## 3. Student and Parent Workflow

Scenario:

Create three students:

- One active student
- One inactive student
- One active student with sibling discount

Acceptance:

- Student can be created, edited, searched, and filtered.
- Parent can be created and linked to more than one student.
- Student detail shows linked parents.
- Inactive student is not included in invoice generation.

## 4. Fee Setup Workflow

Scenario:

Create fee items:

- Tuition Fee, RM800, recurring
- Transport, RM120, recurring
- Registration, RM50, one-time

Acceptance:

- Fee items can be created and edited.
- Student can be assigned multiple fees.
- Assigned amount can override default amount.
- One-time fee can be targeted to a billing month.

## 5. Discount Workflow

Scenario:

Create and assign discounts:

- Sibling Discount, 10 percent
- Scholarship, RM100 fixed amount

Acceptance:

- Discount item can be created.
- Discount can be assigned to a student.
- Discount can be fixed or percentage.
- Discount affects generated invoice total.
- Invoice stores discount snapshot.

## 6. Monthly Invoice Generation

Scenario:

Generate July 2026 invoices for Matahari International School.

Acceptance:

- Admin can preview invoice generation.
- Only active students are included.
- Students without assigned fees are skipped or flagged.
- System creates invoices for eligible students.
- Invoice contains fee and discount line snapshots.
- Running the same generation again does not create duplicates.
- Generated invoice has pending status and correct outstanding amount.

## 7. Invoice Snapshot Test

Scenario:

After generating July 2026 invoice, change Tuition Fee from RM800 to RM900.

Acceptance:

- Existing July 2026 invoice remains RM800 for tuition.
- New future invoice uses updated fee if assignment is updated.
- Student ledger shows historical invoice correctly.

## 8. Payment Workflow

Scenario:

Record partial and full payments.

Acceptance:

- Finance can record cash payment.
- Finance can record bank transfer with reference number.
- Partial payment updates invoice status to partial.
- Full payment updates invoice status to paid.
- Outstanding amount recalculates correctly.
- Payment appears in payment history.

## 9. Receipt Workflow

Scenario:

Record three confirmed payments.

Acceptance:

- Receipt is generated for each confirmed payment.
- Receipt numbers are sequential:

```text
MIS-2026-000001
MIS-2026-000002
MIS-2026-000003
```

- Receipt number cannot duplicate.
- Receipt PDF can be downloaded or printed.
- Receipt can be voided with a reason.
- Voided receipt number is not reused.

## 10. Void and Correction Workflow

Scenario:

Void a mistaken payment.

Acceptance:

- Payment cannot be hard-deleted by normal users.
- Payment can be voided with reason.
- Invoice paid amount decreases after void.
- Invoice outstanding amount recalculates.
- Audit log records who voided the payment and why.

## 11. Dashboard

Acceptance:

- Dashboard shows today's collection.
- Dashboard shows monthly collection.
- Dashboard shows outstanding fees.
- Dashboard shows active student count.
- Dashboard shows overdue accounts.
- Dashboard shows invoices this month.
- Recent payments table updates after payment entry.
- Outstanding students panel updates after payment and void actions.

## 12. Reports

Acceptance:

- Daily Collection report matches recorded confirmed payments.
- Monthly Collection report totals confirmed payments for selected month.
- Outstanding report lists unpaid and partial invoices.
- Payment History report lists payment date, amount, method, reference, and received by.
- Student Ledger shows invoice, payment, receipt, and outstanding history for one student.
- Receipt Listing shows active and void receipts.
- Reports can export to Excel.
- Required reports can export or print to PDF where applicable.

## 13. Multi-School Safety

Scenario:

Create a second test school.

Acceptance:

- Second school can have its own students and fees.
- Second school has its own receipt prefix and sequence.
- School Admin from MIS cannot see second school records.
- CEO can view both schools in group dashboard.

## 14. Audit Log

Acceptance:

- Creating student writes audit log.
- Changing assigned fee writes audit log.
- Generating invoice writes audit log.
- Recording payment writes audit log.
- Generating or voiding receipt writes audit log.
- Exporting report writes audit log if required.

## 15. MVP Pass Criteria

The MVP passes UAT when:

- A normal monthly invoice cycle can be completed without Excel.
- Receipt numbers are automatic and non-duplicated.
- Partial and full payments update balances correctly.
- Outstanding report matches invoice/payment records.
- Daily and monthly collection reports match payment records.
- Principal or CEO can trust dashboard totals.
- A second school can be added without code changes.
