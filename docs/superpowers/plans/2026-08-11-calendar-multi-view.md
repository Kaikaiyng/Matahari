# Calendar Multi-View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add functional Year, Month, and Week presentations to the existing school Calendar without changing its backend API or event mutation behavior.

**Architecture:** Keep `CalendarPage` as the state, request, permission, and dialog owner. Move view-specific rendering and shared calendar range calculations into a focused sibling module so all three views consume the same `CalendarEvent` model and `openEvent` callback.

**Tech Stack:** React 19, TypeScript 6, existing Lucide React icons, CSS, Vitest, Testing Library.

## Global Constraints

- Preserve existing API-backed create, view, update, and delete behavior.
- Preserve `Asia/Kuala_Lumpur` date/time display and bucketing.
- Preserve backend-enforced permission assumptions and frontend permission-aware controls.
- Add no frontend package.
- Week defaults to `07:00–19:00` and expands for visible out-of-range events.
- Final visual acceptance is performed by the user.

---

### Task 1: Specify multi-view navigation behavior

**Files:**
- Modify: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: existing `renderCalendar`, mocked API events, and `CalendarPage` accessible controls.
- Produces: behavioral contracts for selected view state, Year-to-Month navigation, week titles, and retained Add event access.

- [ ] **Step 1: Write failing view-switching tests**

Add tests equivalent to:

```tsx
it('switches between Year, Month, and Week views', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderCalendar()
  await screen.findByRole('heading', { name: 'July 2026' })

  await user.click(screen.getByRole('button', { name: 'Year' }))
  expect(screen.getByRole('button', { name: 'July 2026' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'July 2026' }))
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Week' }))
  expect(screen.getByRole('heading', { name: '13–19 July 2026' })).toBeInTheDocument()
})

it('keeps Add event permission-aware in every view', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderCalendar(['calendar.view'])
  await screen.findByRole('heading', { name: 'July 2026' })
  await user.click(screen.getByRole('button', { name: 'Week' }))
  expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused tests and confirm the new expectations fail**

Run: `npm.cmd test -- CalendarPage.test.tsx`

Expected: existing Calendar tests pass and the new tests fail because Year and Week controls do not exist.

- [ ] **Step 3: Commit the red tests with the implementation task or keep them unstaged until Task 2**

Do not create a test-only commit that leaves the branch intentionally failing.

---

### Task 2: Add shared calendar ranges and three view renderers

**Files:**
- Create: `frontend/src/components/CalendarViews.tsx`
- Modify: `frontend/src/components/CalendarPage.tsx`
- Modify: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent`, selected anchor date, Malaysia-local date helpers, permission-aware `openEvent(event)` callback.
- Produces: `CalendarView = 'year' | 'month' | 'week'`, `calendarRange(view, anchor)`, `YearCalendarView`, `MonthCalendarView`, and `WeekCalendarView`.

- [ ] **Step 1: Define the view contracts and range helpers**

Create the exported contracts:

```tsx
export type CalendarView = 'year' | 'month' | 'week'

export type CalendarViewProps = {
  anchor: Date
  events: CalendarEvent[]
  todayKey: string
  canOpenEvent: boolean
  onOpenEvent: (event: CalendarEvent) => void
}

export function calendarRange(view: CalendarView, anchor: Date): {
  start: string
  end: string
}
```

Year returns January 1 through December 31, Month returns the six-week grid, and Week returns Monday through Sunday.

- [ ] **Step 2: Implement the Year renderer**

Render 12 accessible month buttons containing seven-column mini grids. Each date with one or more matching events renders a visible marker and an accessible event-count label. Call `onSelectMonth(monthDate)` when a month is selected.

- [ ] **Step 3: Implement the Month renderer**

Render:

```tsx
<div className="calendar-month-layout">
  <aside className="calendar-upcoming" aria-label="Upcoming events">...</aside>
  <section className="calendar-month-board">...</section>
</div>
```

Sort upcoming events by `starts_at`, show at most five, and reuse event-type classes for the cards and grid events. Preserve day-region accessible labels used by current tests.

- [ ] **Step 4: Implement the Week renderer**

Use a Monday-through-Sunday column grid. Derive the visible hour bounds as:

```tsx
const startHour = Math.min(7, ...timedEvents.map(eventStartHour))
const endHour = Math.max(19, ...timedEvents.map(eventEndHourRoundedUp))
```

Render all-day/multi-day items in a top strip. Position timed items with CSS custom properties:

```tsx
style={{
  '--event-start': String(minutesFromStart),
  '--event-duration': String(Math.max(durationMinutes, 30)),
} as React.CSSProperties}
```

Preserve event buttons for update/delete-capable users and non-interactive event cards for view-only users.

- [ ] **Step 5: Refactor CalendarPage orchestration**

Add `selectedView` state defaulting to `month`, compute the request range through `calendarRange`, and update navigation offsets by one year, month, or week. Render the shared toolbar and the matching view component. Selecting a mini month sets the anchor and changes the selected view to `month`.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- CalendarPage.test.tsx`

Expected: all Calendar tests pass.

- [ ] **Step 7: Commit the behavior**

```powershell
git add -- frontend/src/components/CalendarPage.tsx frontend/src/components/CalendarViews.tsx frontend/src/components/CalendarPage.test.tsx
git commit -m "feat: add calendar year month and week views"
```

---

### Task 3: Match the supplied visual direction responsively

**Files:**
- Modify: `frontend/src/components/CalendarPage.css`
- Modify: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: class names and CSS custom properties emitted by Task 2.
- Produces: desktop Year grid, Month split layout, Week timeline, and compact mobile agenda presentation.

- [ ] **Step 1: Add a structural regression assertion**

Add a focused assertion that Month exposes the `Upcoming events` complementary region and Week exposes the `Week schedule` region, then run `npm.cmd test -- CalendarPage.test.tsx` and confirm it fails before the matching markup/class contract exists.

- [ ] **Step 2: Implement shared toolbar and event palette styles**

Add a quiet white surface, segmented purple view switcher, subtle borders, compact navigation buttons, and event-type soft backgrounds. Keep focus-visible outlines and avoid color-only meaning.

- [ ] **Step 3: Implement Year and Month responsive layouts**

Use a four-column Year grid on wide screens, three/two columns at tablet widths, and one column on phones. Use an approximately `minmax(230px, 0.32fr) minmax(0, 1fr)` Month split on desktop, stacking the upcoming list above the month content below tablet width.

- [ ] **Step 4: Implement the Week timeline and mobile agenda**

Use a fixed hour-row height and position event cards from the CSS custom properties. At phone widths, hide the dense axis/grid and show the same event data as day-grouped agenda cards.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- CalendarPage.test.tsx`

Expected: all Calendar tests pass.

- [ ] **Step 6: Commit the presentation**

```powershell
git add -- frontend/src/components/CalendarPage.css frontend/src/components/CalendarPage.test.tsx
git commit -m "style: redesign calendar views"
```

---

### Task 4: Focused final verification

**Files:**
- Verify: `frontend/src/components/CalendarPage.tsx`
- Verify: `frontend/src/components/CalendarViews.tsx`
- Verify: `frontend/src/components/CalendarPage.css`
- Verify: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: completed Calendar implementation.
- Produces: recorded test/build evidence and a clean intended diff.

- [ ] **Step 1: Run the Calendar test file**

Run: `npm.cmd test -- CalendarPage.test.tsx`

Expected: zero failed tests.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`

Expected: TypeScript compilation and Vite production build exit 0.

- [ ] **Step 3: Review only the intended diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat origin/master...HEAD
```

Expected: no whitespace errors, and only the Calendar implementation, tests, CSS, design, and plan are included.

- [ ] **Step 4: Hand off for user visual acceptance**

Keep the already-running local frontend available at `http://127.0.0.1:5173/` and report the exact focused test/build results without claiming additional checks.
