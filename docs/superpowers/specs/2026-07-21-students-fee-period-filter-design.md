# Students Fee Period Filter Design

**Date:** 2026-07-21

## Goal

Make the Students page communicate payment progress clearly and allow staff to view the same figures for either the whole academic year or one selected month.

## Confirmed Behaviour

- The default fee period is the whole 2026 academic year.
- The summary card is labelled `Paid / Total Fees`.
- The left value is the verified amount paid against Fee Record charges.
- The right value is the expected Fee Record charge total.
- Selecting a month updates both the summary card and every student's `Fee Amount` and `Outstanding` values in the list.
- An all-year selection restores the annual figures.
- A month with no activated charges displays zero values rather than retaining data from the previous selection.

For the current demo data, the annual summary is expected to read `RM 1,290 / RM 5,340`. The existing `RM 4,050` value is the outstanding balance and is not the amount paid.

## User Interface

Add a `Fee Period` select to the existing Students filter toolbar. It sits after the Status filter and before Refresh on desktop. It uses the existing toolbar control height, border, radius, typography, hover, and focus treatment so it looks native to the system.

Options are:

- `All Year (2026)`
- `January 2026` through `December 2026`

On narrow screens the control follows the existing responsive toolbar behaviour and expands to the available row width. No separate filter panel, custom month picker, or new visual language is introduced.

While a new period is loading, affected totals display `Loading...`. If loading fails, the page shows the existing error message treatment and clears period-specific summary rows so stale values are not presented as current data.

## API and Data Flow

Extend `GET /api/fee-record/summary` with an optional `billing_month` query parameter in `YYYY-MM` format.

- Without `billing_month`, the service preserves its current academic-year aggregation.
- With `billing_month`, the service restricts both eager-loaded charges and the qualifying `whereHas` query to that month within the requested academic year.
- Validation requires the month to belong to `academic_year`; a mismatched year returns a validation error.
- Existing school, student status, class, search, and outstanding-only scoping remains unchanged.
- The response schema remains unchanged: each row still contains `total_expected`, `total_paid`, and `total_outstanding`.

The Students page sends the selected period with its existing Fee Record summary request. It derives the top summary from the same response rows used by the table, ensuring the card and list cannot drift apart.

## Scope

This change applies only to the Students page display and the reusable Fee Record summary endpoint. It does not change Dashboard totals, Fee Record page filters, payment allocation, charge generation, receipts, or the academic-year selection elsewhere in the application.

The Students page continues to use the existing fixed 2026 academic year. A separate academic-year picker is out of scope.

## Testing

Backend tests cover:

- No month parameter returns the existing annual summary.
- A valid month returns only that month's expected, paid, and outstanding totals.
- A month with no charges returns no summary rows.
- A malformed month or a month outside the requested academic year is rejected.
- School and student-status scoping still apply with a month filter.

Frontend tests cover:

- `All Year (2026)` is selected by default.
- The card shows paid amount on the left and expected total on the right.
- Selecting a month sends the correct API parameter.
- The card and student rows update from the same monthly response.
- A zero-charge month displays zero totals.
- The period control remains accessible by its `Fee Period` label.

## Acceptance Criteria

- Annual display reads `Paid / Total Fees`, not `Fee / Outstanding`.
- Annual values use `total_paid / total_expected`.
- Month selection updates the summary card and student list together.
- Returning to All Year removes the `billing_month` parameter and restores annual data.
- The filter visually matches the current Students toolbar on desktop and mobile.
