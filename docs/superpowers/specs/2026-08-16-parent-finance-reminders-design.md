# Parent Finance and Manual Payment Reminders Design

**Status:** Approved for implementation

**Date:** 2026-08-16

## Goal

Complete the read-only Parent Finance experience by connecting the App to the authoritative Admin finance records. A parent can switch between linked children, see each child's current balance, complete payment history and receipt snapshots, and print/save receipts. Authorized Admin users can manually create an in-App payment reminder after the backend rechecks the current outstanding balance.

Online payment, automatic scheduling, email, WhatsApp, push delivery and a new receipt/PDF engine are outside this V1.

## Existing Foundation

- Parent finance endpoints already expose outstanding charges, payment history and receipt snapshots.
- Guardian access already requires an active same-school guardian-child link with `can_view_finance = true`.
- `portal_notifications` already provides recipient-scoped in-App notifications and read state.
- Admin payments and authoritative receipt snapshots already use the shared Laravel backend/database.

The implementation extends these paths rather than creating a second ledger, balance table, receipt format or notification store.

## Parent App

The Finance view filters the guardian's linked children to those with reviewed finance access. Multiple children appear as selectable cards; selecting a card reloads only that child's current-enrolment balance, payments and receipts. The view shows:

- total outstanding balance and outstanding line items;
- complete payment history, including status and linked receipt reference;
- complete issued/void receipt history;
- a receipt detail view using the immutable authoritative snapshot;
- Print / Save as PDF through the browser print dialog.

The experience remains read-only and exposes no payment initiation control.

## Manual Reminder Flow

An Admin payment workspace action posts to a dedicated student reminder endpoint. The backend:

1. resolves the active tenant and Admin surface;
2. enforces an explicit backend permission and current school scope;
3. locks/reloads the student context and derives the current academic year from the explicitly stored current enrolment;
4. recalculates outstanding charges from the authoritative Fee Record service;
5. rejects the request when there is no positive outstanding balance or no eligible guardian;
6. resolves only active same-school guardian-child links with `can_view_finance = true` and a linked active user;
7. creates one `payment_reminder` portal notification per eligible guardian;
8. writes the material audit event in the same transaction so notification creation rolls back if auditing fails.

The notification contains the child name, current balance, academic year and calculation timestamp. It contains no sibling data and no private finance line-item payload.

## Authorization and Isolation

Client-submitted tenant or guardian IDs are never accepted. Parent reads continue to authorize the requested student at the backend. Receipt detail is exposed only through the parent-child route so a guessed receipt ID cannot cross child, school or tenant boundaries. Notification reads remain restricted to the authenticated recipient and school.

Admin UI visibility is only a usability control; the reminder endpoint independently enforces surface, tenant membership, permission and school ownership.

## Error Handling

- Missing current enrolment: no year-specific balance or reminder is guessed.
- No outstanding balance: return a validation response and create nothing.
- No eligible guardian recipient: return a validation response and create nothing.
- Unauthorized/cross-school/cross-child access: fail closed without exposing whether unrelated data exists.
- Partial notification/audit failure: roll back the entire reminder operation.

## Verification

Backend tests cover receipt snapshots, cross-child denial, finance-capability denial, reminder recipient resolution, no-enrolment/no-balance/no-recipient behavior, permissions, cross-school denial, and transactional audit rollback. App tests cover child-card switching and receipt detail/print. Admin tests cover the permission-aware reminder action, success state, and exact endpoint contract.
