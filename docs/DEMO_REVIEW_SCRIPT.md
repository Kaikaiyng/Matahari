# Responsive Finance MVP Demo Script

Status: Current demo sequence

Last updated: 2026-07-12

## 1. Demo Goal

Show that a school administrator can complete the implemented finance flow without relying on the old monthly spreadsheet workflow:

```text
Login
  -> Find Student
  -> Review Fee Agreement
  -> Preview and Activate Charges
  -> Add Manual Charge when needed
  -> Allocate Payment
  -> Verify Payment
  -> Generate and Print Receipt
  -> Review Fee Record summaries
```

Do not present the system as a finished school ERP. Reports, Export, PDF generation, Parent Portal, Statements, Reminders, and production deployment are not part of this demo.

## 2. Devices

Primary device: iPad.

Recommended order:

1. Desktop at 1440x900
2. iPad landscape at approximately 1180x820
3. iPad portrait at approximately 820x1180
4. Mobile portrait at approximately 390x844
5. Return to desktop to prove the responsive pass did not reduce desktop usability

For a real iPad, connect both devices to the same trusted LAN and follow [Development Setup](DEVELOPMENT_SETUP.md).

## 3. Opening Message

Suggested explanation:

```text
This is the current Matahari internal Admin Finance MVP.

The demo focuses on student fee agreements, charge generation, payment allocation,
payment verification, receipts, and fee-record ledgers. It is designed first for
school admin work on desktop and iPad.
```

## 4. Login and Navigation

1. Open the login page.
2. Confirm labels, inputs, error placement, and Login button are readable.
3. Log in with a seeded local School Admin account.
4. On iPad portrait/mobile, open the menu drawer.
5. Confirm the current page is visually identified.
6. Select Students and confirm the drawer closes.
7. Confirm Logout remains accessible.

Expected:

- No page-level horizontal scrolling
- Touch targets are comfortable
- Navigation does not depend on hover
- Permission-restricted actions are absent or disabled

## 5. Student List and Detail

1. Search or filter the Student List.
2. Confirm Student Name, Student ID, Class, Status, and Open remain visible on narrow screens.
3. Open a student with a long name or identifier.
4. Review Student overview and Fee Record totals.
5. Confirm the narrow layout becomes a clear single-column task flow.

Explain that financial sections are kept separate so admin staff do not face one large unstructured ledger.

## 6. Fee Agreement

1. Open the current Fee Agreement.
2. Show amount, Charge Type, Billing Pattern, and Jan-Dec month controls.
3. Open the create or supersede workflow without saving unless using dedicated demo data.
4. Show selected and unselected month states.
5. Trigger a harmless validation state if suitable.

Expected:

- Month controls wrap and remain touch friendly
- Validation appears near the relevant item
- Save/Supersede actions remain reachable
- Backend enum names and payloads remain unchanged

## 7. Fee Record Preview and Activation

1. Select the academic year.
2. Preview scheduled charges.
3. Point out activation warnings before the rows.
4. On mobile, show stacked preview records.
5. Activate only when using dedicated disposable demo data.

Explain the distinction:

- Fee Agreement defines the billing arrangement.
- Fee Record charges are the actual expected balances used by payment allocation.

## 8. Manual Charge

1. Open Add Manual Charge.
2. Show Academic Year, Billing Month, Category, Description, Amount, and Remark.
3. Confirm the form is two columns where space permits and one column on mobile.
4. Do not submit unless the charge is part of planned demo data.

## 9. Payment Allocation

This is the highest-priority demo section.

1. Open Create Payment.
2. Show outstanding charges grouped by month/category.
3. Select one charge.
4. Enter or adjust a partial allocation amount.
5. Compare Payment Amount and Selected Allocation Total.
6. Create a mismatch and show the warning.
7. Show the manual-allocation warning without submitting it unless required.
8. Review payment method and status fields.

Expected:

- Charge targets are easy to tap
- Expected and outstanding amounts remain visible
- Important actions are not placed at the far edge of a scrolling row
- Mismatch and manual-allocation warnings are prominent

## 10. Payment and Receipt History

1. Open Payment History.
2. Show pending/verified/voided status and allocation details.
3. Show Verify and Void controls according to the logged-in permission set.
4. Open Receipt History.
5. Generate or view an existing receipt.
6. Show receipt status, void information, and long-number wrapping.

Explain that a payment with an issued receipt has stricter void safeguards.

## 11. Receipt Screen and Print

1. Open an issued receipt.
2. Confirm school, payer, student, receipt number, amount, and items are readable.
3. On mobile, demonstrate that the receipt item table scrolls inside the receipt rather than widening the page.
4. Select Print Receipt.
5. Inspect native print preview on the actual demo browser when available.

Do not describe browser printing as PDF generation.

## 12. Fee Record Summary

1. Open Fee Record Summary.
2. Filter by academic year, student, class/status, or outstanding state as available.
3. Confirm Student, Student ID, Expected, Paid, Outstanding, and Status remain present.
4. On narrow screens, show the horizontal-scroll cue and scroll the table inside its container.

## 13. Category Monthly

1. Open Category Monthly Fee Record.
2. Select a category and academic year.
3. Scroll the Jan-Dec ledger horizontally.
4. Point out paid, partial, unpaid, and no-charge states.
5. Open a student from the ledger when appropriate.

The ledger intentionally remains wide. It is not compressed into tiny text or rebuilt as a spreadsheet component.

## 14. Close and Collect Feedback

Ask finance/admin staff:

- Is the Fee Agreement terminology clear?
- Are preview and activation warnings sufficient?
- Can staff understand partial allocation without explanation?
- Is payment verification consistent with the real bank-transfer workflow?
- Does the receipt contain the required official wording?
- Which real-device or printer issue would block daily use?

Record confirmed changes in `docs/DECISIONS.md` or a new dated decision record without rewriting historical decisions.

## 15. Demo Pass Criteria

- All named flows open and remain readable
- No page-level horizontal overflow at the four target sizes
- Drawer and compact navigation work
- Financial statuses and destructive actions remain clear
- Jan-Dec ledger scrolls inside its container
- Desktop layout remains intact after narrow-screen testing
- Real iPad and print-preview gaps are reported honestly
