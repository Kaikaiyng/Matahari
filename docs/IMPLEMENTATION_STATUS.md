# Implementation Status

Status: `RESPONSIVE_DEMO_READY_WITH_WARNINGS`

Last verified for the responsive Admin delivery: 2026-07-22

Phase A academic/identity foundation was subsequently implemented and validated on 2026-08-12. The Parent/Student mobile-first web product now lives in the independent `app/` workspace and is separate from the responsive Admin UI. It is not yet a native/store build. See [Current Status](current-status.md), [Phase A Academic Foundation Delivery](phase-a-academic-foundation.md), and [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md).

## 1. Product State

Matahari has moved beyond scaffold status. The current repository contains a working internal Admin Finance MVP with a Laravel API, React frontend, seeded roles and sample data, finance workflows, shared school calendar, class directory, repeatable SQLite demo, temporary HTTPS demo launcher, and an iPad-first responsive pass.

The status includes warnings because real-device iPad Safari and native browser print preview still need operator verification, and several planned product modules remain intentionally deferred.

## 2. Completed Modules

- Username login, logout, current user, session restoration, roles, and permission-gated actions
- Student Management: list, search, status/fee-period filters, create, detail, and status updates
- Read-only Classes directory with active-student counts, rosters, Student Detail handoff, and roster return
- Fee Agreement creation, version history, current agreement, and superseding
- Fee Agreement billing configuration: Charge Type, Billing Pattern, Jan-Dec selection, and preview confirmation
- Fee Record charge preview and activation
- Manual and one-time charges
- Outstanding-charge payment allocation with partial amounts
- Payment history, verification, void safeguards, and allocation detail
- Receipt generation, screen view, browser print, history, void, and regeneration
- Student Fee Record totals
- Fee Record Summary with optional validated billing-month filtering
- Category Monthly Fee Record Jan-Dec ledger
- Dashboard collection metrics with Fee Record-based outstanding total, Fee Record navigation, and no hardcoded failure fallback
- Shared Calendar: school-isolated visible-range month loading; create, edit, and confirmed delete access for every initial role; all-day and Malaysia-time timed events; Appointment, Training, Meeting, School Event, and Other types; optional location, participants/person-in-charge, and notes; creator/updater audit users; Today navigation and current-day highlighting; explicit loading/empty/error states; seven-column desktop/tablet views; and compact mobile date rows

## 3. Responsive State

Browser QA covered:

- Desktop: 1440x900
- iPad landscape: 1180x820
- iPad portrait: 820x1180
- Mobile portrait: 390x844

Shared Calendar browser QA additionally covered the exact delivery viewports:

- Desktop: 1440x900
- iPad landscape: 1024x768
- iPad portrait: 768x1024
- Mobile portrait: 390x844

At each Calendar viewport, the page had no horizontal overflow. Desktop and tablet retained the seven-column month grid; mobile switched to readable date-and-event rows. Drawer checks at 768px and 390px confirmed Calendar directly below Dashboard.

Implemented behavior:

- Full desktop sidebar
- Compact labelled iPad-landscape rail
- Drawer navigation below 1024px with backdrop, Escape close, active state, and body scroll lock
- Mobile Student List records
- Single-column Student Detail and form flows on narrow screens
- Touch-friendly Fee Agreement month controls
- Contained charge, payment, receipt, summary, and monthly-ledger layouts
- Mobile Payment and Receipt history records
- Screen-safe receipt with preserved print rules
- Visible horizontal-scroll cues for wide financial ledgers
- 44px tablet/mobile interaction targets and visible focus states

## 4. Backend and API

- Framework: Laravel 13 on PHP 8.4
- Non-vendor API routes: 35
- Authentication: session cookies
- Authorization: `auth` plus permission middleware
- Repeatable demo database: SQLite
- Optional development database: MariaDB
- Automated test database: SQLite `:memory:`
- Active schema: 36 tables

Main API groups:

- Auth
- Students, classes, and status
- Fee items and Fee Agreements
- Fee Record preview, activation, manual charges, outstanding, summary, and category monthly
- Payments, verification, and voiding
- Receipts, print view, and voiding
- Legacy dashboard and invoice-generation endpoints
- Calendar visible-range list, create, update, and delete endpoints, each protected by its matching `calendar.*` permission

## 5. Verification Evidence

Fresh repository verification on 2026-07-22:

```text
Frontend Vitest: 7 files passed, 75 tests passed
Frontend lint: zero errors and zero warnings
Frontend production build: passed; 66 modules transformed
Backend PHPUnit: 116 tests passed, 721 assertions
Laravel non-vendor API routes: 35
Calendar API routes: 4, with auth and calendar.view/create/update/delete middleware
Public-demo launcher contract and runtime test scripts: PASS
```

The 2026-07-19 Calendar delivery also completed exact-head browser QA at 1440x900, 1024x768, 768x1024, and 390x844 with zero horizontal overflow and zero application console errors/warnings. Real-device and native print-preview limitations remain below.

## 6. Deferred Scope

Not implemented in the current MVP:

- Statements
- Reminders
- General reports
- Excel or other exports
- PDF generation
- Parent Portal
- Remaining production dashboard/invoice reporting beyond the implemented Fee Record outstanding total
- Stable deployment, hosting, domain, Docker, Nginx, or Cloudflare configuration (the current Quick Tunnel is temporary demo infrastructure only)
- New major school ERP modules

Some navigation entries retain demo/future-phase content. A visible navigation item does not imply its full backend module is complete.

## 7. Known Limitations

- Real iPad Safari testing remains required for final device confidence.
- Native print preview could not be automated. Receipt print CSS and print action were checked without changing the existing A4 rules.
- `frontend/src/App.tsx` remains large by design for this stabilization phase.
- Fresh MariaDB migrations need a temporary foreign-key creation workaround because an early migration references `fee_agreement_items` before that table is created.
- The portable local MariaDB/phpMyAdmin processes do not automatically start after a computer reboot.

## 8. Next Recommended Work

Before adding new modules:

1. Run the complete demo on a real iPad Safari device.
2. Confirm receipt print preview on the target browser and printer.
3. Add a database-safe migration to remove the MariaDB foreign-key ordering workaround.
4. Confirm school business rules and real receipt wording with finance staff.

Only after those stabilization checks should Statements, Reminders, Reports, Export, PDF, Parent Portal, or deployment work begin.
