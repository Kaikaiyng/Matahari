# Shared School Calendar Design

Date: 2026-07-19
Status: Approved for specification review

## Purpose

Add a shared calendar for school operations such as appointments, training, meetings, and school events. Calendar data is isolated by school: users working in one school can only see and manage that school's events. Every authenticated role may view, create, edit, and delete calendar events within its active school context.

## Product Scope

The first release provides a lightweight month calendar inside the existing administration application.

- Add `Calendar` to the `Overview` section of the sidebar, directly below `Dashboard`.
- Show a responsive month view on desktop and iPad.
- Show a compact date-and-event presentation on narrow mobile screens.
- Allow a user to create an event by selecting a date or using an `Add event` action.
- Allow a user to open an event to view and edit its details.
- Allow event deletion only after a dedicated confirmation dialog names the event and the user explicitly confirms.
- Support all-day events and events with start and end times.
- Use event types `Appointment`, `Training`, `Meeting`, `School Event`, and `Other`, with a consistent color for each type.
- Record optional location, participants or person-in-charge text, and notes.
- Record who created and last updated an event.

Recurring events, notifications, reminders, drag-and-drop rescheduling, week/day views, invitations, attendance tracking, and external calendar synchronization are outside this release.

## School Scope and Authorization

Every calendar record has a required `school_id`. The backend derives or validates the active school context and applies it to every query and mutation.

- School-bound users use their assigned `school_id` and cannot request another school's data.
- Group-level users such as Super Admin or CEO use the application's active school context. In the current single-school interface this is the school already returned for the workspace; future multi-school selection can reuse the same API contract.
- A record identifier from another school must behave as unavailable and must never disclose event data.
- Authorization remains permission-based rather than hardcoded by role. Add `calendar.view`, `calendar.create`, `calendar.update`, and `calendar.delete`, and grant all four permissions to every initial role.

## Data Model

Create a `calendar_events` table with:

| Field | Purpose |
| --- | --- |
| `id` | Primary key |
| `school_id` | Required school ownership and query scope |
| `title` | Required event title |
| `event_type` | Appointment, training, meeting, school event, or other |
| `is_all_day` | Distinguishes all-day and timed events |
| `starts_at` | Required start date and time |
| `ends_at` | Optional end date and time; must not precede `starts_at` |
| `location` | Optional place or online location |
| `participants` | Optional free-text person-in-charge or participant names |
| `notes` | Optional internal details |
| `created_by` | User who created the event |
| `updated_by` | User who most recently changed the event |
| timestamps | Creation and update audit timestamps |

Dates are stored using the backend's application timezone rules and returned as ISO-8601 values. The frontend displays them in the user's school workspace timezone. For an all-day event, the UI emphasizes the calendar date and does not display a time.

## Backend Design

Add a focused `CalendarEvent` model, request validation, controller, and authenticated routes:

- `GET /api/calendar-events?start=YYYY-MM-DD&end=YYYY-MM-DD&school_id={id}` lists events overlapping the requested visible date range.
- `POST /api/calendar-events` creates an event in the active school.
- `PATCH /api/calendar-events/{calendarEvent}` updates an event after school-scope validation.
- `DELETE /api/calendar-events/{calendarEvent}` deletes an event after school-scope validation.

The list endpoint returns only the requested calendar range and orders events by start time and title. Validation requires a non-empty title, a supported type, a valid start value, and an end value that is equal to or later than the start. Mutation responses return the normalized event. Delete returns an empty successful response.

School isolation is enforced in backend queries and route-model resolution, not only by hiding controls in the frontend.

## Frontend Design

Implement the calendar as a focused page component rather than expanding the already large application component further.

The page contains:

- Month navigation with previous, today, and next actions.
- A seven-column month grid at tablet and desktop widths.
- Clearly distinguished days outside the current month and a highlighted current day.
- Event chips showing time when applicable, title, and type color.
- An `Add event` primary action.
- A compact mobile layout that keeps dates and event details readable without horizontal page scrolling.

The existing modal frame is reused for create and edit forms. The form includes title, type, all-day setting, start date/time, optional end date/time, location, participants/person-in-charge, and notes. The edit modal exposes `Save changes` and `Delete event` actions.

Deletion opens a second, destructive confirmation dialog. It states the event title and explains that the action cannot be undone. `Cancel` closes the confirmation without changing data. `Delete event` disables while the request is running, prevents duplicate submissions, and closes both dialogs only after the backend confirms deletion.

## Data Flow and State

1. Opening Calendar calculates the visible month range and requests events for that range.
2. Changing month requests the new visible range and shows an in-context loading state.
3. Creating or updating an event sends the form to the API and merges the returned normalized record into page state.
4. Deleting an event removes it from page state only after the API succeeds.
5. Returning to Calendar during the same session reloads authoritative backend data rather than relying on stale local state.

## Error Handling and Accessibility

- Loading, empty, success, validation, permission, and service-error states use existing application UI patterns.
- Failed create, update, or delete requests keep the relevant dialog open and preserve entered values.
- The delete confirmation uses an accessible modal dialog, places initial focus safely, supports Escape to cancel, and restores focus on close.
- Month controls and event actions have accessible names and keyboard activation.
- Event type is communicated by text as well as color.
- Forms show field-specific backend validation messages.

## Testing and Acceptance Criteria

Backend feature tests prove:

- Each role receives the four calendar permissions.
- Authenticated users can list, create, update, and delete events in their active school.
- Users cannot view or mutate another school's events.
- List queries return events in the requested visible range, including events that overlap range boundaries.
- Invalid types, missing titles, invalid dates, and end-before-start values are rejected.
- Creator and updater fields are recorded correctly.

Frontend tests prove:

- Calendar appears in the sidebar below Dashboard.
- The month view renders events and supports month navigation.
- All-day and timed events display appropriately.
- Create and edit forms submit the expected values and display validation failures.
- Delete first opens a confirmation dialog; cancel preserves the event; confirm calls the delete API and removes the event only after success.
- A failed delete keeps the event visible and reports the error.
- The compact mobile presentation remains usable without page-level horizontal overflow.

Completion requires fresh backend tests, frontend tests, lint, and production build to pass, followed by a focused visual check at desktop, iPad landscape, iPad portrait, and mobile portrait widths.
