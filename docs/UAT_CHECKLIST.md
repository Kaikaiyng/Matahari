# MIS Admin and Community App User Acceptance Checklist

Status: Current implemented-scope UAT

Last updated: 2026-08-13

The current build passes this checklist when a school administrator can complete the implemented student-to-receipt flow accurately and the four Community App roles remain correctly scoped on phone-sized screens. This checklist does not claim acceptance for preview/deferred modules or production readiness.

## 1. Test Preparation

- Use seeded or anonymized local data only.
- Prepare School Admin and Finance users with different permission sets.
- Prepare at least one active student with a current Fee Agreement.
- Prepare one student with outstanding Fee Record charges.
- Prepare pending, verified, and receipted payment examples where practical.
- Back up the local database before destructive void/activation tests.

## 2. Login and RBAC

- [ ] Valid user can log in and restore the current session.
- [ ] Username is normalized to lowercase/trimmed form and staff email is not accepted as the login identifier.
- [ ] Invalid credentials show a readable error.
- [ ] Logout clears the authenticated session.
- [ ] School Admin and Finance see only permitted navigation/actions.
- [ ] Direct API calls to protected actions return 401/403 when appropriate.
- [ ] Permission rules are enforced by the backend, not only hidden by the frontend.
- [ ] A multi-role user can switch App role without gaining out-of-scope records.

## 3. Responsive Navigation

- [ ] Desktop shows the full sidebar.
- [ ] iPad landscape shows a readable compact navigation rail.
- [ ] iPad portrait/mobile show a menu button and drawer.
- [ ] Drawer closes after navigation, Escape, close control, or backdrop.
- [ ] Background content does not scroll while the drawer is open.
- [ ] Current page remains identifiable.
- [ ] Focus states and touch targets are visible and usable.

## 4. Student Management

Before Admin student-management checks, validate the separate Community App:

- [ ] Parent, Student, Teacher, and Staff each receive the documented five-item navigation set.
- [ ] The active destination shows icon and label; inactive destinations remain accessible by name.
- [ ] Floating navigation respects the device safe area and never covers the final page action.
- [ ] Visible controls are at least 44 by 44px and pages do not overflow at 360, 390, or 430px widths.
- [ ] Sign out is available from More/Profile for every role.
- [ ] Parent sees only explicitly linked children; Student sees only self; Teacher sees only currently assigned classes/students.
- [ ] Cross-school portal links and academic identifiers are rejected by Laravel.
- [ ] Teacher daily Attendance accepts `present`, `late`, `absent`, or `excused`; a correction requires a reason and audit record.
- [ ] Parent/Student Attendance history reflects live scoped data.
- [ ] Parent Finance is read-only and offers no payment control.
- [ ] Feed publishing/media, Assessment, Schedule, and Quiz previews are not represented as persisted production features.

- [ ] Student List loads, searches, and filters by status.
- [ ] Student Name, Student ID, Class, Status, and Open remain visible on narrow screens.
- [ ] Authorized user can create a student; profile editing remains backend-only in the current UI.
- [ ] Validation appears beside the relevant field.
- [ ] Student status can change to supported values without deleting the record.
- [ ] Student Detail shows overview, Fee Record totals, agreements, charges, payments, and receipts in a readable flow.
- [ ] Long names and identifiers wrap without widening the page.
- [ ] Fee-period selection updates both the `Paid / Total Fees` card and every student row for the same month/all-year period.

## 4A. Classes Directory

- [ ] Classes are grouped under the correct Kindergarten, Primary, Secondary, or STP level.
- [ ] Active-student counts match `GET /api/students?status=active`.
- [ ] Opening a class shows only active students assigned to that class.
- [ ] Opening Student Detail and returning restores the originating class roster.
- [ ] Empty, loading, permission, and retry states are readable.

## 5. Fee Agreement

- [ ] User can view current and historical agreement versions.
- [ ] Authorized user can create an agreement.
- [ ] Superseding preserves the old version and makes the new version current.
- [ ] Agreement items keep amount, Charge Type, Billing Pattern, and billing months.
- [ ] Monthly, termly, yearly, custom, one-time, and manual validation follows backend rules.
- [ ] Jan-Dec controls wrap and remain distinguishable and touch friendly.
- [ ] Preview totals match the item configuration.
- [ ] Save/Supersede actions remain reachable on iPad/mobile.

## 6. Fee Record Preview and Activation

- [ ] Academic year control and Preview/Activate actions fit the viewport.
- [ ] Preview lists scheduled charges with month, item, category, amount, and status.
- [ ] Blocking warnings appear before activation.
- [ ] Activation creates expected charges only when rules allow it.
- [ ] Repeated activation does not create prohibited duplicate charges.
- [ ] Mobile preview records remain readable without page overflow.

## 7. Manual Charge

- [ ] Form includes Academic Year, Billing Month, Category, Description, Amount, and Remark.
- [ ] Required-field and amount validation are local and readable.
- [ ] Authorized submission creates a manual charge without changing scheduled-charge behavior.
- [ ] Created charge appears in outstanding and summary views.
- [ ] Form is one column on mobile and no more than two readable columns on tablet.

## 8. Payment Allocation

- [ ] Outstanding charges are grouped by month/category.
- [ ] Charge selection is easy to tap.
- [ ] Expected and outstanding amounts are visible.
- [ ] Partial allocation accepts a valid amount below the outstanding balance.
- [ ] Allocation cannot exceed selected outstanding or payment amount.
- [ ] Selected total and payment amount are clearly compared.
- [ ] Mismatch blocks submission and shows a prominent warning.
- [ ] Manual allocation warning remains visible.
- [ ] Successful payment stores method, date, reference, status, and allocation rows.
- [ ] Important payment actions are not hidden at the far edge of a scrollable row.

## 9. Payment Verification and Void

- [ ] Pending payment can be verified by an authorized user.
- [ ] Verification records verifier and verification timestamp.
- [ ] Unauthorized user cannot verify or void.
- [ ] Void requires a valid reason and records the actor/time.
- [ ] Voiding correctly reverses allocation effects on outstanding charges.
- [ ] Payment with an issued active receipt is protected from unsafe voiding.
- [ ] Payment history keeps status and allocation details readable on mobile.

## 10. Receipts

- [ ] Receipt can be generated from an eligible payment.
- [ ] Repeated generation while an issued receipt exists is rejected and does not issue a duplicate number.
- [ ] Receipt number is unique and generated by backend sequence logic.
- [ ] Receipt amount and item snapshots match the payment.
- [ ] Receipt screen shows school, payer, student, items, amount in words, issuer, and status.
- [ ] Print action opens the browser print workflow.
- [ ] Receipt can be voided only with permission and reason.
- [ ] Voided receipt number is not reused.
- [ ] Regeneration after an allowed void produces a new sequence number.
- [ ] Long receipt numbers wrap safely on tablet/mobile.

## 11. Fee Record Summary

- [ ] Filters wrap and remain usable.
- [ ] Student, Student ID, Expected, Paid, Outstanding, and Status are present.
- [ ] Totals match activated charges and valid payment allocations.
- [ ] Outstanding-only behavior returns the expected students.
- [ ] Wide columns scroll inside the table container on portrait/mobile.
- [ ] Opening a student returns to the correct Student Detail.
- [ ] Optional `YYYY-MM` billing-month filtering changes totals without changing the response shape.
- [ ] Invalid or out-of-year billing months return validation errors instead of stale data.

## 12. Category Monthly Fee Record

- [ ] Academic year, category, status, and search filters work as implemented.
- [ ] Jan-Dec columns retain readable widths.
- [ ] Paid, partial, unpaid, and no-charge states remain distinct in text and color.
- [ ] The ledger scrolls horizontally inside its container.
- [ ] The page itself does not scroll horizontally.
- [ ] Student identity remains readable while using the ledger.

## 13. Loading, Empty, and Error States

- [ ] Each main list has a readable loading state.
- [ ] Empty students, agreements, charges, payments, receipts, summaries, and ledgers are explained.
- [ ] API errors stay within the affected section where possible.
- [ ] Buttons show submitting/loading state and resist duplicate submission.
- [ ] Financial warnings remain visible until resolved.
- [ ] Dashboard API failure shows unavailable values and does not display hardcoded financial metrics.

## 13A. Shared Calendar

- [ ] Visible-range loading returns events that overlap the requested date range, including multi-day events.
- [ ] Authorized users can create, edit, and delete events in their school only.
- [ ] All-day and Malaysia-time timed events round-trip without shifting the displayed time.
- [ ] Today navigation and current-day highlighting work.
- [ ] Desktop/tablet show the seven-column month view; mobile shows readable date/event rows.
- [ ] Calendar loading, empty, validation, permission, and service-error states are explicit.

## 14. Desktop and Device Regression

Run the full flow at:

- [ ] 1440x900 desktop
- [ ] 1180x820 iPad landscape
- [ ] 820x1180 iPad portrait
- [ ] 390x844 mobile portrait
- [ ] Real iPad Safari on the same LAN

At every size:

- [ ] No page-level horizontal overflow
- [ ] No clipped primary or destructive actions
- [ ] Touch targets are usable
- [ ] Text, badges, IDs, and references wrap safely
- [ ] Desktop tables and sidebar remain intact after mobile QA

## 15. Print Acceptance

- [ ] Receipt screen is readable before print.
- [ ] Print button is reachable.
- [ ] Native browser print preview shows only the receipt scope.
- [ ] A4 margins and page breaks are acceptable.
- [ ] Drawer, sidebar, topbar, histories, and buttons do not print.

## 16. Deferred and Not Accepted by This Checklist

- Statements and reminders
- General reports and exports
- PDF generation
- Production-ready Parent Finance and complete portal workflows beyond the implemented self-service/Attendance slice
- Remaining production dashboard/invoice reporting beyond the implemented Fee Record outstanding total
- Verified production deployment, hosting, domains, edge TLS, monitoring, and backup/restore operations
- Cross-school CEO reporting and full production multi-school operations

## 17. MVP Pass Criteria

The current MVP passes when Sections 2-15 succeed for the implemented permission set and test data, with any real-device or print limitations explicitly recorded. Deferred items in Section 16 are not blockers because they are outside the approved demo scope.
