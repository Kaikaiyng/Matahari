# Dashboard Outstanding Fees Design

**Date:** 2026-07-21
**Status:** Approved direction; awaiting written-spec review

## Goal

Replace the Dashboard's `View Fee Record` placeholder with the real Fee Record outstanding total, formatted as Malaysian Ringgit. Make the card keyboard- and pointer-accessible so selecting it opens the existing Fee Record page.

## Data Source Decision

The existing Dashboard API calculates `outstanding_fees` from legacy invoices. The active finance workflow uses Fee Record charges, so displaying that legacy value could disagree with the Fee Record screen.

Three approaches were considered:

1. **Recommended: calculate the Dashboard metric through `FeeRecordSummaryService`.** This keeps one Dashboard request, uses the same charge balances as Fee Record, and prevents the frontend from duplicating aggregation logic.
2. Fetch `/fee-record/summary` separately in the frontend and sum its rows. This reuses the public API but adds another Dashboard request and loading/error state.
3. Display the existing legacy invoice metric. This is smallest but knowingly presents a different accounting source, so it is rejected.

The Dashboard API will therefore accept an optional four-digit `academic_year` (defaulting to the current year) and return the sum of `total_outstanding` from Fee Record summary rows for that year. The current demo Dashboard request will explicitly use academic year `2026`, matching the existing Fee Record default. The frontend will format that value with the existing `formatCurrency` helper.

## Interaction

- The card label remains `Outstanding Fees`.
- The value becomes the real total, such as `RM 3,850` or `RM 0`.
- Selecting the card opens the existing `Fee Record` page.
- The interactive card uses native button semantics, visible focus styling, and an accessible name.
- All four currently defined roles (`super-admin`, `ceo`, `school-admin`, and `finance`) can see the total and open Fee Record.
- The existing `fee_record.view` permission remains the authorization mechanism so future restricted roles can still be introduced deliberately.
- Other Dashboard cards remain non-interactive.

## Scope and Error Handling

- No database schema changes.
- No new endpoint.
- No changes to Fee Record charge calculation rules.
- Existing Dashboard fallback behavior remains unchanged if the Dashboard request fails.
- `super-admin`, `school-admin`, and `finance` already have `fee_record.view`; the `ceo` role will receive it so every current role has access.
- Fresh databases receive the role permission through `DatabaseSeeder`, and the existing demo database is updated without deleting operational data.

## Testing

- A backend feature test proves the Dashboard metric comes from Fee Record charge balances rather than legacy invoice balances.
- A permission test proves all four current roles include `fee_record.view`.
- A frontend test proves the formatted amount is visible and activating the card opens Fee Record.
- Existing frontend and backend suites, lint, build, and the live demo are verified after implementation.
