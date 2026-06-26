# MVP Demo and Review Script

Version: 0.1
Date: 2026-06-25

Use this script to present the MVP concept to school stakeholders using the PRD and Canva mockup.

Canva mockup:

- Edit: https://www.canva.com/d/waTV5XSLkhk3c18
- View: https://www.canva.com/d/CTiTU6jFQpFFMPy

## 1. Meeting Goal

The goal of the review is to confirm whether the proposed MVP solves the school's most painful Excel-based finance workflow.

Do not present it as a complete ERP.

Position it as:

```text
A school fee, invoice, payment, receipt, and outstanding report system.
```

## 2. Suggested Attendees

- Finance/Admin staff who currently manage Excel
- School Admin
- Principal
- CEO or group representative
- Future system owner or IT contact

## 3. Opening Explanation

Suggested script:

```text
Today we are not reviewing a full school ERP.

We are reviewing a focused first version that replaces the monthly Excel fee process:
copying worksheets, changing receipt numbers, recording payments, checking outstanding fees, and preparing reports.

If this workflow is correct, we can later add attendance, parent portal, WhatsApp reminders, and online payment.
```

## 4. Show Current Pain Point

Walk through the current manual process:

```text
Previous Month Excel
  -> Copy Sheet
  -> Change Month
  -> Change Receipt Number
  -> Change Date
  -> Manual Payment Recording
  -> Manual Outstanding Checking
```

Ask:

- Is this accurate?
- Which step is most painful?
- Which step causes the most mistakes?
- Which step takes the most time?

## 5. Show Proposed Workflow

Walk through proposed workflow:

```text
Student Registration
  -> Assign Fee Structure
  -> Generate Monthly Invoice
  -> Record Payment
  -> Generate Receipt
  -> Dashboard Updated
  -> Reports
```

Ask:

- Is any step missing?
- Is the order correct?
- Who performs each step today?

## 6. Show Canva Dashboard Mockup

Open the Canva view URL.

Explain:

- This is a concept mockup.
- It shows the type of dashboard the school admin or finance user would see.
- It is not final UI.

Point out:

- Today's Collection
- Monthly Collection
- Outstanding Fees
- Active Students
- Overdue Accounts
- Generate Monthly Invoices button
- Recent Payments
- Outstanding Students

Ask:

- Are these the right numbers to show first?
- What number would finance check every morning?
- What number would principal or CEO care about?
- Is anything unnecessary?

## 7. Review Core Modules

Use the PRD to walk through:

1. Students
2. Parents
3. Fee Items
4. Discounts
5. Monthly Invoices
6. Payments
7. Receipts
8. Reports
9. Multi-school support

For each module, ask:

- Is this needed for first version?
- Is this enough for first version?
- What would block daily use if missing?

## 8. Confirm Critical Decisions

Ask these directly:

1. Should receipt be generated automatically after payment?
2. Should bank transfer payment require verification before receipt?
3. Do parents often pay multiple invoices or siblings in one transaction?
4. Are discounts applied to the whole invoice or only certain fees?
5. How should registration fee be billed?
6. Is payment proof upload required for MVP?
7. What exact receipt format is required?
8. What reports must be exported to Excel?

Record answers in `docs/DECISIONS.md`.

## 9. Review UAT Success Criteria

Explain:

The first version is successful if a normal billing month can be completed without Excel.

Review these pass criteria:

- Generate monthly invoices for active students.
- Prevent duplicate invoices.
- Record full and partial payments.
- Generate non-duplicate receipt numbers.
- Print/download receipt.
- Show accurate outstanding report.
- Show daily and monthly collection report.
- Support a second school without code changes.

Ask:

- Would this be enough to test with real admin staff?
- What must be added before they can stop using Excel?

## 10. Close with Next Steps

Suggested close:

```text
If these assumptions are correct, the next step is to build the technical foundation:
Laravel backend, React admin UI, MySQL database, Docker deployment, and the first migrations.

The first development milestone should prove student records, fee setup, invoice generation, payment recording, and receipt numbering.
```

## 11. Meeting Output Checklist

After the meeting, update:

- `docs/DECISIONS.md`
- `docs/MVP_ASSUMPTIONS.md`
- `docs/PRD.md`
- `docs/DATABASE_DESIGN.md` if schema-impacting answers changed
- `docs/UAT_CHECKLIST.md` if acceptance criteria changed

Minimum outputs:

- Confirmed MVP scope
- Confirmed receipt numbering format
- Confirmed payment workflow
- Confirmed discount behavior
- Confirmed required reports
- Named UAT approver
