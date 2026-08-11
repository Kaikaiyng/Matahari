# Calendar Multi-View Design

**Status:** Approved direction

**Date:** 2026-08-11

## Goal

Redesign the existing school Calendar so users can switch between Year, Month, and Week views while preserving the current API-backed event workflows, permissions, Malaysia time-zone handling, and responsive behavior.

## Scope

### Shared controls

- Provide a `Year / Month / Week` segmented view switcher.
- Keep previous, next, Today, and permission-gated Add event actions.
- Update the visible date-range title to match the selected view.
- Preserve the existing create, view, edit, and delete dialogs and API behavior.

### Year view

- Show all 12 months as compact mini calendars.
- Mark dates containing events without crowding each mini calendar with event text.
- Selecting a month switches to Month view for that month.
- Use a responsive grid that reduces columns on narrower screens.

### Month view

- Follow the supplied reference with a two-column composition: upcoming-event cards on the left and the month grid on the right.
- Use soft event-type colors, quiet grid lines, and compact event labels.
- Upcoming events are derived from the events already loaded for the visible calendar range and sorted chronologically.
- On small screens, render the upcoming list above a readable calendar/day-list presentation.

### Week view

- Follow the supplied reference with seven day columns and an hourly timeline.
- Default to `07:00–19:00`; expand the range when a visible timed event begins earlier or ends later.
- Place all-day and multi-day events in a separate row above the timed grid.
- Position timed events by their Malaysia-local start and end time, with a practical minimum visible height.
- On small screens, replace the dense grid with a chronological day-grouped agenda.

## Architecture

`CalendarPage` remains responsible for view state, navigation, event loading, permissions, mutations, dialogs, and errors. Pure presentation helpers/components in the Calendar feature render Year, Month, and Week content from shared date and event data. No third-party calendar package is added.

Changing the selected view changes the requested API date range:

- Year requests the complete visible year.
- Month requests the existing six-week month grid range.
- Week requests the selected Monday-through-Sunday range.

Existing stale-request protection remains authoritative when users switch views, dates, or schools quickly.

## Interaction and accessibility

- View controls expose their selected state with `aria-pressed`.
- Navigation and event controls keep descriptive accessible names.
- Event buttons continue to open the existing permission-aware dialog.
- Today remains visibly distinguished in every view.
- Color is not the only event indicator; event text or a marker remains present.

## Error and empty states

Loading, permission-denied, request-error, and successful-empty states remain distinguishable. Empty upcoming and week sections use compact explanatory copy without hiding the calendar structure.

## Verification

- Add focused component tests for view switching, year-to-month navigation, week range/title behavior, and the retained permission-aware actions.
- Run the Calendar component test file.
- Run the frontend production build, which includes TypeScript checking.
- Final visual acceptance is performed by the user, as requested.

## Non-goals

- No weather, advertising, sharing, email, attendee-avatar, or fake toolbar features from the references.
- No drag-and-drop, event resizing, recurrence, or new backend schema/API behavior.
- No new frontend dependency.
