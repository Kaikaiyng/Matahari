# Change Log — 2026-08-12

**Product:** Matahari International School Administration & Finance System
**Status:** Development demo; not production-ready

## Included

- Restored approved MIS branding, logo assets, school code, prefixes, and disposable demo identities.
- Added explicit Teacher, Parent, and Student demo accounts plus reviewed demo academic relationships.
- Added an experimental `/portal` Parent/Student web shell, personal notification centre, student self/enrolment reads, and guarded guardian-child reads.
- Added an MIS class-grouped demo parent directory and a secured teacher-account listing/creation screen.
- Refreshed login, navigation icons, responsive layout, and consistent parent-owned 16-pixel spacing.

## Safety Corrections During Review

- Demo persona buttons fill only usernames; they do not expose or inject passwords.
- Portal role switching is limited to roles actually held by the authenticated account.
- The payment notice interaction is explicitly a non-persisting preview and never reports a real payment as created.
- Staff creation uses `foundation_accounts.manage`, creates only Teacher accounts, requires a temporary password of at least 12 characters, enforces school scope, and uses the existing transactional audit service.
- Notification reads are restricted to the authenticated same-school recipient.
- Attendance, feedback, and timetable cards are visibly labelled as demo previews.

## Product Boundaries

- There is no native app, token authentication, Firebase, Capacitor, push delivery, Quiz, or AI implementation.
- Parent Finance is not production-complete. Current finance access is read-only and capability-gated; the payment-method screen persists nothing.
- Demo academic dates and guardian activation exist only in the explicit disposable seeder. No migration guesses or activates live records.

## Validation

Final command counts and any MariaDB limitations are recorded in `docs/current-status.md` after release validation. Do not use earlier draft claims such as “17/17” or “234/234” as evidence.
