# Dashboard Demo Presentation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, truthful Dashboard landing page that works for management presentations and Admin/Finance operations using only the existing Dashboard API data.

**Architecture:** Keep `DashboardPage` in the established `App.tsx` page composition and add Dashboard-scoped semantic sections for the overview, metrics, financial snapshot, quick actions, and activity lists. Reuse existing permissions, `setActivePage`, Lucide icons, and API state; isolate all visual changes below `.dashboard-page` in `App.css`.

**Tech Stack:** React 19, TypeScript 6, Lucide React, CSS Grid/Flexbox, Vitest, Testing Library, Oxlint, Vite.

## Global Constraints

- Do not change the Dashboard API contract, backend, database, authentication, permission, or school-scope behavior.
- Never invent percentages, targets, forecasts, growth values, or historical chart series.
- Render Students, Fee Record, and Calendar quick actions only when their existing view permission is present.
- Add no package and keep all styles scoped under `.dashboard-page`.
- Preserve explicit loading, unavailable, no-access, populated, and empty states.
- Keep the work local and do not push.

---

### Task 1: Dashboard information architecture and behavior

**Files:**
- Modify: `frontend/src/App.test.tsx:450-535`
- Modify: `frontend/src/App.tsx:1-24,4388-4535`

**Interfaces:**
- Consumes: `DashboardResponse`, `CurrentUser`, `hasPermission(user, slug)`, and `setActivePage(page: PageKey): void`.
- Produces: semantic regions named `Dashboard metrics`, `Financial snapshot`, `Quick actions`, `Recent collections`, and `Outstanding accounts`.

- [ ] **Step 1: Write the failing Dashboard presentation tests**

Update the compact Dashboard test so it asserts the new overview, financial snapshot, and quick actions while preserving four metric cards:

```tsx
it('presents a management overview with operational quick actions', async () => {
  await renderAuthenticatedApp()

  expect(screen.getByRole('heading', { name: 'School overview' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Dashboard metrics' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Financial snapshot' })).toBeInTheDocument()

  const actions = screen.getByRole('region', { name: 'Quick actions' })
  expect(within(actions).getByRole('button', { name: 'Go to Students' })).toBeInTheDocument()
  expect(within(actions).getByRole('button', { name: 'Go to Fee Record' })).toBeInTheDocument()
  expect(within(actions).getByRole('button', { name: 'Go to Calendar' })).toBeInTheDocument()
  expect(document.querySelectorAll('.stat-card')).toHaveLength(4)
})
```

Extend the existing Fee Record navigation test to scope the metric action and add a quick-action callback assertion:

```tsx
const metrics = screen.getByRole('region', { name: 'Dashboard metrics' })
expect(within(metrics).getByText('RM 800')).toBeInTheDocument()
await user.click(within(metrics).getByRole('button', { name: 'Open Fee Record' }))
expect(await screen.findByRole('heading', { name: 'Admin Fee Record' })).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused tests and verify the new regions fail**

Run: `cd frontend; npm.cmd test -- App.test.tsx -t "management overview|Fee Record outstanding"`

Expected: FAIL because `Financial snapshot` and `Quick actions` do not exist yet.

- [ ] **Step 3: Implement the balanced Dashboard structure**

In `DashboardPage`, add `canViewCalendar`, `formattedDate`, truthful `todayShare`, and `meta` for each metric. Replace the current header and two-panel-only layout with:

```tsx
<header className="dashboard-hero">
  <div className="dashboard-hero-copy">
    <p className="eyebrow">Dashboard</p>
    <h2>School overview</h2>
    <p>Monitor collections, student accounts, and the work that needs attention today.</p>
  </div>
  <div className="dashboard-date" aria-label={`Today is ${formattedDate}`}>
    <CalendarDays size={20} aria-hidden="true" />
    <span>Today</span>
    <strong>{formattedDate}</strong>
  </div>
</header>

<section className="stats-grid dashboard-metrics" aria-label="Dashboard metrics">
  {metrics.map((metric) => (
    <StatCard key={metric.label} {...metric} />
  ))}
</section>

<section className="dashboard-management-grid">
  <section className="dashboard-financial-card" aria-label="Financial snapshot">
    <div className="dashboard-section-heading">
      <div><p className="eyebrow">Financial snapshot</p><h2>Collection overview</h2></div>
      <span className="dashboard-live-badge"><span /> Live data</span>
    </div>
    <strong className="dashboard-financial-total">
      {dashboard ? formatCurrency(dashboard.metrics.monthly_collection) : unavailableValue}
    </strong>
    <span className="dashboard-financial-caption">Collected this month</span>
    <div className="dashboard-progress" aria-label={dashboard ? `Today's collections are ${todayShare}% of this month's collections` : 'Collection progress unavailable'}>
      <span style={{ width: `${todayShare}%` }} />
    </div>
    <div className="dashboard-financial-details">
      <div><span>Collected today</span><strong>{dashboard ? formatCurrency(dashboard.metrics.today_collection) : unavailableValue}</strong></div>
      <div><span>Outstanding balance</span><strong>{canViewFeeRecord && dashboard ? formatCurrency(dashboard.metrics.outstanding_fees) : canViewFeeRecord ? unavailableValue : 'No access'}</strong></div>
    </div>
  </section>

  <section className="dashboard-quick-card" aria-label="Quick actions">
    <div className="dashboard-section-heading"><div><p className="eyebrow">Shortcuts</p><h2>Quick actions</h2></div></div>
    <div className="dashboard-quick-list">
      {canViewStudents && <button aria-label="Go to Students" onClick={() => setActivePage('students')}><GraduationCap /><span><strong>Students</strong><small>Profiles and enrolment</small></span><span aria-hidden="true">›</span></button>}
      {canViewFeeRecord && <button aria-label="Go to Fee Record" onClick={() => setActivePage('fee-record')}><ClipboardList /><span><strong>Fee Record</strong><small>Balances and collections</small></span><span aria-hidden="true">›</span></button>}
      {canViewCalendar && <button aria-label="Go to Calendar" onClick={() => setActivePage('calendar')}><CalendarDays /><span><strong>Calendar</strong><small>School events and meetings</small></span><span aria-hidden="true">›</span></button>}
    </div>
  </section>
</section>
```

Retain both existing activity datasets, but give rows avatar, copy, amount, and status class names so CSS can create the polished visual hierarchy. Keep all current empty/loading copy and avoid claiming that outstanding list rows reconcile with the Fee Record total.

- [ ] **Step 4: Run focused Dashboard tests**

Run: `cd frontend; npm.cmd test -- App.test.tsx -t "Dashboard|dashboard|Fee Record outstanding|management overview"`

Expected: PASS with the new regions, truthful API states, and navigation callbacks.

- [ ] **Step 5: Commit the semantic Dashboard change**

```powershell
git add -- frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: restructure dashboard for demo presentation"
```

### Task 2: Dashboard-scoped visual polish and responsive behavior

**Files:**
- Modify: `frontend/src/App.css:120-175, responsive sections near 1900-1980`

**Interfaces:**
- Consumes: the `.dashboard-*` class names and semantic structure created in Task 1.
- Produces: a desktop two-column management/activity layout, tablet-safe stacking, mobile single-column flow, and reduced-motion-safe interactive states.

- [ ] **Step 1: Add Dashboard-only visual styles**

Add styles under `.dashboard-page` for the tinted overview surface, 16-pixel Dashboard card radii, metric accent bars, tabular amounts, financial progress bar, quick-action rows, circular list avatars, status pills, and restrained hover/focus states. Use these exact layout contracts:

```css
.dashboard-page { gap: 20px; }
.dashboard-hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 26px; border: 1px solid #dce7fb; border-radius: 16px; background: linear-gradient(135deg, #f7faff 0%, #eef4ff 100%); }
.dashboard-management-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr); gap: 18px; }
.dashboard-financial-card, .dashboard-quick-card { min-width: 0; padding: 22px; border: 1px solid #e1e7f0; border-radius: 16px; background: #fff; box-shadow: 0 8px 30px rgb(37 62 108 / 7%); }
.dashboard-page .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

At `max-width: 1050px`, stack `.dashboard-management-grid`. At `max-width: 700px`, stack the hero and activity grid, use two metric columns, and make financial details one column. At `max-width: 520px`, use one metric column and compact row padding. Add `:focus-visible` outlines and disable transforms/transitions inside the existing reduced-motion media query.

- [ ] **Step 2: Run static frontend verification**

Run:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
```

Expected: Oxlint exits 0; TypeScript and Vite production build exit 0.

- [ ] **Step 3: Run the full frontend test suite**

Run: `cd frontend; npm.cmd test`

Expected: all Vitest files pass with no unhandled errors.

- [ ] **Step 4: Perform concise browser smoke checks**

At `http://127.0.0.1:5173`, inspect one desktop viewport and one narrow viewport. Confirm the hero, four metrics, financial snapshot, permission-aware quick actions, activity panels, sidebar, and centered sidebar toggle render without overlap or horizontal overflow.

- [ ] **Step 5: Review and commit the completed local change**

```powershell
git diff --check
git status --short
git diff --stat
git add -- frontend/src/App.css
git diff --cached --check
git commit -m "style: polish dashboard for demo presentation"
```

Do not push the branch.
