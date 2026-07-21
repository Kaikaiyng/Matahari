# Demo Readiness Hardening Design

**Date:** 2026-07-17
**Status:** Approved through the completed live demo audit and the request to handle all findings.

## Objective

Turn the current Matahari build into a dependable demo: clean local data, no visibly unfinished destinations, clear business language, safe failure states, and usable student/payment flows on desktop, tablet, and mobile.

## Product decisions

### Navigation and presentation

- Keep the primary navigation limited to working destinations: Dashboard, Students, Parents, Fees, and Fee Record.
- Keep payment and receipt operations inside the selected student workflow, where they already work and have the required context.
- Remove prototype-only header controls and implementation language from customer-facing surfaces.
- Show a concise, non-technical service status only when the API is unavailable.

### Student workflow

- Treat the students list and a selected student's workspace as separate views on the same route.
- Opening a student replaces the list with the detail workspace and exposes a clear Back to students action.
- Opening a student from Fee Record goes directly to that student's workspace without rendering the full list first.
- Payment creation remains part of the student workspace and must fit small screens without page-level horizontal overflow.

### Fee Record

- Use business-facing labels for summary cards, filters, and cell states.
- Fix summary-card structure so amounts and labels are visually separated.
- Preserve horizontal scrolling for the ledger, keep identifying columns readable, and avoid breaking student IDs into vertical fragments.

### Error handling

- The frontend may show validation and authorization messages returned by the API.
- For server errors (HTTP 5xx), it must show a stable friendly message and never expose exception, SQL, filesystem, or stack details.
- Session expiry remains actionable and returns the user to sign-in.

### Demo data and startup

- Seed a small, realistic set of student finance states: unpaid, fully paid with receipt, partially paid, and not configured.
- Provide a reset command that is hard-pinned to the ignored local SQLite file. It must not depend on or alter the developer's MariaDB configuration.
- Run the backend with the repository's bundled PHP configuration so the SQLite extension is always available.
- Default demo mode disables debug output.

## Verification strategy

- Frontend unit/component tests cover safe API errors, visible navigation, and list/detail transitions.
- Backend feature tests cover the seeded scenario mix and issued receipt.
- Existing backend tests, frontend lint, TypeScript build, and production build remain green.
- Final browser QA covers sign-in, dashboard, student detail, payment creation entry, Fee Record, and responsive layouts at desktop, tablet, and mobile widths.

## Out of scope

- Building standalone invoice, payment, receipt, report, or settings modules.
- Reworking the underlying billing domain model.
- Modifying production or developer database configuration.
