# Reference Admin UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh every existing Matahari School ERP frontend view with the reference admin panel's application hierarchy while preserving Matahari's red, black, white, and light-gray palette and all existing behavior.

**Architecture:** Keep API calls and domain state inside `App.tsx`, but extract a presentation-only application shell and reusable UI primitives into focused component files. Migrate page markup incrementally to those primitives, then consolidate page-specific styles and verify the authenticated, operational, financial, modal, and responsive flows.

**Tech Stack:** React 19, TypeScript 6, Vite 8, lucide-react, CSS, Vitest, Testing Library, Laravel backend tests

## Global Constraints

- Do not change backend endpoints, API payloads, permissions, business rules, routes, form fields, or financial calculations.
- Keep the existing black, red, white, and light-gray Matahari palette; do not copy the reference site's blue palette, branding, text, icons, or data.
- Add no new npm dependencies, remote fonts, analytics, persistence, router, or state-management library.
- Support desktop layouts at 1280px and above, tablet layouts, and mobile layouts down to 320px.
- Prevent viewport-level horizontal overflow; only intentionally wide table containers may scroll horizontally.
- Preserve keyboard access, accessible names, visible focus states, semantic status text, and current API error recovery.
- Treat existing user changes in the worktree as authoritative and do not stage unrelated files.

## File Structure

- Create `frontend/src/components/AdminUi.tsx`: presentation-only `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `ModalFrame`, `StatusBadge`, `InlineMessage`, and `SessionLoader` components.
- Create `frontend/src/components/AdminUi.css`: tokens and shared component styles for cards, headers, toolbars, tables, forms, modal shells, messages, and the session loader.
- Create `frontend/src/components/AdminUi.test.tsx`: accessible contracts for shared components and modal/session behavior.
- Create `frontend/src/components/AdminShell.tsx`: grouped navigation, desktop shell, mobile drawer, utility header, service state, user identity, and logout action.
- Create `frontend/src/components/AdminShell.css`: desktop and mobile shell styles.
- Create `frontend/src/components/AdminShell.test.tsx`: grouped navigation, active page, drawer, selection, and logout behavior.
- Modify `frontend/src/App.tsx`: use the extracted components, define grouped navigation, remove duplicated shell/primitive markup, and recompose existing pages without moving domain logic.
- Modify `frontend/src/App.css`: retain page-specific and finance-workspace rules, remove extracted shell/primitive rules, and align remaining page layouts with the new design.
- Modify `frontend/src/index.css`: retain global reset and focus treatment while introducing only global color variables used by component styles.
- Modify `frontend/src/App.test.tsx`: cover session checking, refreshed navigation, Dashboard composition, operational pages, modal behavior, and unchanged API flows.

---

### Task 1: Shared Admin UI Primitives

**Files:**
- Create: `frontend/src/components/AdminUi.tsx`
- Create: `frontend/src/components/AdminUi.css`
- Create: `frontend/src/components/AdminUi.test.tsx`

**Interfaces:**
- Produces: `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `ModalFrame`, `StatusBadge`, `InlineMessage`, and `SessionLoader`.
- Consumes: React `ReactNode`, `FormEventHandler`, and lucide-react icons passed as rendered nodes; no API or domain types.

- [ ] **Step 1: Write failing primitive accessibility tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DataPanel,
  FilterToolbar,
  ModalFrame,
  PageHeader,
  SessionLoader,
  StatCard,
  StatusBadge,
} from './AdminUi'

describe('AdminUi', () => {
  it('renders page context, action, metrics, toolbar, and data region', () => {
    render(
      <>
        <PageHeader eyebrow="Student management" title="Students" description="Manage student profiles" action={<button>Add Student</button>} />
        <StatCard label="Visible Students" value="4" tone="positive" />
        <FilterToolbar ariaLabel="Student filters"><input aria-label="Search students" /></FilterToolbar>
        <DataPanel title="Student List"><table><tbody><tr><td>Alyssa Tan</td></tr></tbody></table></DataPanel>
        <StatusBadge tone="positive">Active</StatusBadge>
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Student' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student filters' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student List' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toHaveClass('status-badge', 'positive')
  })

  it('closes a modal from the explicit close and cancel controls', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ModalFrame title="Create Student" description="Add a profile" onClose={onClose} footer={<button onClick={onClose}>Cancel</button>}><label>Student Name<input /></label></ModalFrame>)

    expect(screen.getByRole('dialog', { name: 'Create Student' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close Create Student' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('explains the session bootstrap state', () => {
    render(<SessionLoader logoSrc="/mis-logo.jpg" brand="Matahari School ERP" />)
    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `cd frontend && npm test -- src/components/AdminUi.test.tsx`

Expected: FAIL because `./AdminUi` does not exist.

- [ ] **Step 3: Implement the presentation-only component contracts**

```tsx
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import './AdminUi.css'

export type UiTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</header>
}

export function StatCard({ label, value, tone = 'neutral', icon, meta }: { label: string; value: ReactNode; tone?: UiTone; icon?: ReactNode; meta?: ReactNode }) {
  return <article className={`stat-card ${tone}`}>{icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}<div className="stat-card-copy"><span>{label}</span><strong>{value}</strong>{meta && <small>{meta}</small>}</div></article>
}

export function FilterToolbar({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return <section className="filter-toolbar" aria-label={ariaLabel}>{children}</section>
}

export function DataPanel({ title, eyebrow, action, children, className = '' }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`data-panel ${className}`.trim()} aria-label={title}><header className="data-panel-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</header><div className="data-panel-body">{children}</div></section>
}

export function ModalFrame({ title, description, onClose, footer, children, className = '' }: { title: string; description?: string; onClose: () => void; footer: ReactNode; children: ReactNode; className?: string }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => { previousFocusRef.current = document.activeElement as HTMLElement | null; closeButtonRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKeyDown); return () => { window.removeEventListener('keydown', onKeyDown); previousFocusRef.current?.focus() } }, [onClose])
  return <div className="modal-backdrop" role="presentation"><section className={`modal-frame ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button ref={closeButtonRef} className="icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></button></header><div className="modal-body">{children}</div><footer>{footer}</footer></section></div>
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: UiTone; children: ReactNode }) {
  return <span className={`status-badge ${tone}`}>{children}</span>
}

export function InlineMessage({ tone, children }: { tone: 'error' | 'info' | 'success'; children: ReactNode }) {
  return <div className={`inline-message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><AlertTriangle size={17} /><span>{children}</span></div>
}

export function SessionLoader({ logoSrc, brand }: { logoSrc: string; brand: string }) {
  return <main className="session-screen"><section className="session-card"><img src={logoSrc} alt="MIS logo" /><p className="eyebrow">{brand}</p><h1>Checking your session</h1><div className="session-progress" aria-hidden="true"><span /></div><p role="status">Verifying your secure admin access...</p></section></main>
}
```

Add `AdminUi.css` with `--surface`, `--border`, `--brand-red`, 12px card radii, 40px controls, white data panels, fixed modal header/footer, `max-height: min(760px, calc(100vh - 32px))`, scrollable `.modal-body`, status tones, and a reduced-motion-safe session progress animation.

- [ ] **Step 4: Run the primitive test**

Run: `cd frontend && npm test -- src/components/AdminUi.test.tsx`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the primitive layer**

```powershell
git add -- frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.css frontend/src/components/AdminUi.test.tsx
git commit -m "feat: add shared admin UI primitives"
```

---

### Task 2: Grouped Application Shell

**Files:**
- Create: `frontend/src/components/AdminShell.tsx`
- Create: `frontend/src/components/AdminShell.css`
- Create: `frontend/src/components/AdminShell.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: `NavigationGroup<PageKey>[]`, current page key/title, school context, API state, user display data, selection/logout callbacks, and page children.
- Produces: `AdminShell<PageKey extends string>` with its own mobile drawer state, Escape handling, focus restoration, and grouped navigation rendering.

- [ ] **Step 1: Write failing shell behavior tests**

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayoutDashboard, Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { AdminShell } from './AdminShell'

const groups = [
  { label: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'People', items: [{ key: 'students', label: 'Students', icon: Users }] },
]

it('renders grouped navigation and dispatches navigation and logout', async () => {
  const user = userEvent.setup()
  const onSelectPage = vi.fn()
  const onLogout = vi.fn()
  render(<AdminShell brandLogo="/logo.jpg" activePage="dashboard" pageTitle="Dashboard" contextText="Matahari International School" navGroups={groups} apiState="live" user={{ name: 'Demo Admin', email: 'admin@mis.test' }} onSelectPage={onSelectPage} onLogout={onLogout}><p>Page content</p></AdminShell>)

  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getByText('Overview')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(screen.getByRole('button', { name: 'Logout' }))
  expect(onSelectPage).toHaveBeenCalledWith('students')
  expect(onLogout).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the focused shell test and verify it fails**

Run: `cd frontend && npm test -- src/components/AdminShell.test.tsx`

Expected: FAIL because `./AdminShell` does not exist.

- [ ] **Step 3: Implement `AdminShell` and its exact public types**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LogOut, Menu, X } from 'lucide-react'
import './AdminShell.css'

export type NavigationItem<PageKey extends string> = { key: PageKey; label: string; icon: LucideIcon }
export type NavigationGroup<PageKey extends string> = { label: string; items: NavigationItem<PageKey>[] }

export function AdminShell<PageKey extends string>({ brandLogo, activePage, pageTitle, contextText, navGroups, apiState, user, onSelectPage, onLogout, children }: { brandLogo: string; activePage: PageKey; pageTitle: string; contextText: string; navGroups: NavigationGroup<PageKey>[]; apiState: 'live' | 'demo' | 'loading'; user: { name: string; email: string }; onSelectPage: (page: PageKey) => void; onLogout: () => void; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closeDrawer = useCallback(() => setIsOpen(false), [])

  useEffect(() => { document.body.classList.toggle('nav-open', isOpen); return () => document.body.classList.remove('nav-open') }, [isOpen])
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen) { closeDrawer(); menuRef.current?.focus() } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [closeDrawer, isOpen])
  useEffect(() => { if (isOpen) closeRef.current?.focus() }, [isOpen])

  const selectPage = (page: PageKey) => { onSelectPage(page); closeDrawer() }
  const initial = user.name.trim().charAt(0).toUpperCase() || 'U'

  return <div className="admin-shell"><button className="sidebar-backdrop" aria-label="Close navigation" aria-hidden={!isOpen} tabIndex={isOpen ? 0 : -1} onClick={closeDrawer} /><aside className={isOpen ? 'admin-sidebar open' : 'admin-sidebar'} id="main-navigation"><div className="admin-brand"><img src={brandLogo} alt="MIS logo" /><div><strong>MIS</strong><span>School ERP</span></div><button ref={closeRef} className="icon-button drawer-close" aria-label="Close navigation" onClick={closeDrawer}><X size={19} /></button></div><nav aria-label="Main navigation">{navGroups.map((group) => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map(({ key, label, icon: Icon }) => <button key={key} aria-current={key === activePage ? 'page' : undefined} aria-label={label} className={key === activePage ? 'nav-item active' : 'nav-item'} onClick={() => selectPage(key)}><Icon size={18} /><span>{label}</span></button>)}</section>)}</nav></aside><div className="admin-workspace"><header className="utility-header"><button ref={menuRef} className="icon-button menu-button" aria-controls="main-navigation" aria-expanded={isOpen} aria-label="Open navigation" onClick={() => setIsOpen(true)}><Menu size={20} /></button><div><span>{contextText}</span><strong>{pageTitle}</strong></div><div className="utility-actions">{apiState === 'demo' && <span className="service-warning" role="status">Service temporarily unavailable</span>}<div className="user-chip"><span>{initial}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><button className="icon-button" aria-label="Logout" onClick={onLogout}><LogOut size={19} /></button></div></header><main className="admin-main">{children}</main></div></div>
}
```

- [ ] **Step 4: Migrate `App.tsx` to grouped navigation and the shell**

Replace the flat `navItems` definition with:

```tsx
const navGroups: NavigationGroup<PageKey>[] = [
  { label: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'People', items: [{ key: 'students', label: 'Students', icon: GraduationCap }, { key: 'parents', label: 'Parents', icon: Users }] },
  { label: 'Finance', items: [{ key: 'fees', label: 'Fees', icon: CreditCard }, { key: 'fee-record', label: 'Fee Record', icon: ClipboardList }] },
]

const navItems = navGroups.flatMap((group) => group.items)
```

Remove `isNavOpen`, `isNarrowViewport`, drawer refs, and their focus/breakpoint effects from `App`. Replace the current `.app-shell` markup with:

```tsx
return (
  <AdminShell brandLogo={misLogo} activePage={activePage} pageTitle={pageTitle} contextText={dashboard.school.name} navGroups={navGroups} apiState={apiState} user={user} onSelectPage={setActivePage} onLogout={() => void handleLogout()}>
    {renderPage()}
  </AdminShell>
)
```

Update `handleLogout` so it no longer calls the removed `closeNavigation` function.

- [ ] **Step 5: Add shell CSS and remove superseded shell CSS from `App.css`**

Use a 248px fixed desktop sidebar, 64px white utility header, `#f5f6f8` canvas, 24–32px main padding, grouped 11px uppercase navigation labels, red-tinted active items, and the existing 1023px off-canvas breakpoint. Preserve the current backdrop, inert-page intent, drawer close button, and focus styling.

- [ ] **Step 6: Run shell and application tests**

Run: `cd frontend && npm test -- src/components/AdminShell.test.tsx src/App.test.tsx`

Expected: PASS; existing navigation remains Dashboard, Students, Parents, Fees, Fee Record, now grouped under three visible labels.

- [ ] **Step 7: Commit the shell migration**

```powershell
git add -- frontend/src/components/AdminShell.tsx frontend/src/components/AdminShell.css frontend/src/components/AdminShell.test.tsx frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: refresh the admin application shell"
```

---

### Task 3: Session, Login, and Dashboard Composition

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `SessionLoader`, `PageHeader`, `StatCard`, and `DataPanel` from `AdminUi`.
- Produces: compact authenticated Dashboard composition and an explanatory session bootstrap screen.

- [ ] **Step 1: Add failing application tests for the new session and Dashboard hierarchy**

```tsx
it('shows an explanatory session check before authentication resolves', () => {
  vi.mocked(globalThis.fetch).mockImplementation(() => new Promise<Response>(() => undefined))
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
})

it('uses a compact Dashboard header and metric cards without the former hero', async () => {
  await renderAuthenticatedApp()
  expect(screen.getByRole('heading', { name: 'School overview' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open Students' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Dashboard metrics' })).toBeInTheDocument()
  expect(document.querySelector('.hero-strip')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.stat-card')).toHaveLength(4)
})
```

- [ ] **Step 2: Run the focused application tests and verify they fail**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: FAIL because the current session heading is `Checking session...`, Dashboard still uses `.hero-strip`, and metric cards use `.metric-card`.

- [ ] **Step 3: Replace session and Dashboard markup with shared primitives**

```tsx
if (authState === 'checking') {
  return <SessionLoader logoSrc={misLogo} brand="Matahari School ERP" />
}

function DashboardPage({ dashboard, setActivePage }: DashboardPageProps) {
  const metrics = [
    { label: "Today's Collection", value: formatCurrency(dashboard.metrics.today_collection), tone: 'positive' as const, icon: <CreditCard size={20} /> },
    { label: 'Monthly Collection', value: formatCurrency(dashboard.metrics.monthly_collection), tone: 'neutral' as const, icon: <BarChart3 size={20} /> },
    { label: 'Outstanding Fees', value: 'View Fee Record', tone: 'warning' as const, icon: <AlertTriangle size={20} /> },
    { label: 'Active Students', value: String(dashboard.metrics.active_students), tone: 'neutral' as const, icon: <GraduationCap size={20} /> },
  ]

  return <section className="page-stack"><PageHeader eyebrow="Overview" title="School overview" description="Review student accounts, fee agreements, collections, and outstanding balances." action={<button className="primary-action compact" onClick={() => setActivePage('students')}><GraduationCap size={18} />Open Students</button>} /><section className="stats-grid" aria-label="Dashboard metrics">{metrics.map((metric) => <StatCard key={metric.label} {...metric} />)}</section><DataPanel eyebrow="Latest activity" title="Recent collections"><div className="empty-state"><BarChart3 size={24} /><strong>No collection activity to display</strong><p>Verified payments will appear here.</p></div></DataPanel></section>
}
```

Keep the current login fields, submit logic, validation, and demo credentials. Only align the login card, controls, and messages with shared tokens.

- [ ] **Step 4: Add global color variables and Dashboard-specific layout rules**

In `index.css`, define `--brand-red: #ee2f37`, `--brand-red-dark: #b31923`, `--sidebar: #222225`, `--canvas: #f5f6f8`, `--surface: #ffffff`, `--text: #25272d`, `--muted: #737782`, and `--border: #e1e4ea`. Remove `.hero-strip` rules from `App.css`; add only the Dashboard empty-state and any page-specific two-column layout rules not owned by `AdminUi.css`.

- [ ] **Step 5: Run tests, lint, and build**

Run: `cd frontend && npm test -- src/App.test.tsx && npm run lint && npm run build`

Expected: all App tests pass, lint exits 0, and Vite produces `dist/` successfully.

- [ ] **Step 6: Commit the session and Dashboard refresh**

```powershell
git add -- frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx frontend/src/index.css
git commit -m "feat: refresh session and dashboard views"
```

---

### Task 4: Operational Pages and Data Tables

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `StatusBadge`, and `InlineMessage`.
- Produces: consistent Students, Parents, and Fees page hierarchy without changing fetching, filtering, permissions, or mutations.

- [ ] **Step 1: Add failing operational hierarchy tests**

```tsx
it('uses a dedicated filter toolbar and data panel on Students', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  expect(await screen.findByRole('region', { name: 'Student filters' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Student List' })).toBeInTheDocument()
  expect(screen.getByText('Active')).toHaveClass('status-badge', 'positive')
})

it.each([['Parents', 'Parent Directory'], ['Fees', 'Fee Catalogue']])('uses the shared page hierarchy on %s', async (destination, panelTitle) => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: destination }))
  expect(await screen.findByRole('region', { name: panelTitle })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused operational tests and verify they fail**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: FAIL because the current pages use generic `.panel`, `.toolbar-actions`, and `.badge` markup without named regions.

- [ ] **Step 3: Recompose Students list state**

Keep all existing state and callbacks. Replace the list-state markup with this hierarchy:

```tsx
<PageHeader eyebrow="People" title="Students" description="Manage profiles, enrolment status, and fee visibility." action={canCreateStudents ? <button className="primary-action compact" onClick={() => setShowCreateForm(true)}><UserPlus size={18} />Add Student</button> : <span className="permission-note">View only</span>} />
<section className="stats-grid three"><StatCard label="Visible Students" value={students.length} tone="positive" icon={<Users size={20} />} /><StatCard label="Status Filter" value={statusOptions.find((option) => option.value === statusFilter)?.label ?? 'All'} /><StatCard label="Fee / Outstanding" value={feeSummaryLabel} /></section>
<FilterToolbar ariaLabel="Student filters"><div className="toolbar-search"><Search size={18} /><input aria-label="Search students" placeholder="Search student name or ID" /></div><select aria-label="Student status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StudentFilter)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="secondary-action" onClick={() => void loadStudents()}><RefreshCw size={16} />Refresh</button></FilterToolbar>
<DataPanel eyebrow="Operational list" title="Student List"><div className="table-wrap">{studentTable}</div></DataPanel>
```

Filter the already-loaded `students` array for the new search input; do not add an API parameter. Replace each existing status `<span className="badge ...">` with `StatusBadge` while preserving `formatStatus`. Replace class-name helpers with one explicit `statusTone(status): UiTone` mapping: active, paid, verified, and issued map to `positive`; pending and partial map to `warning`; voided, withdraw, inactive, and overdue map to `danger`; every other value maps to `neutral`.

- [ ] **Step 4: Recompose Parents and Fees with the same hierarchy**

Use `PageHeader` for the page context and `DataPanel` named `Parent Directory` and `Fee Catalogue`. Preserve their existing content and actions, place controls inside `FilterToolbar` where present, and use an explicit `.empty-state` inside the data panel when their current data arrays are empty. Apply the same `PageHeader` plus `DataPanel` structure to `PrototypePage`, `ReportsPage`, and `SettingsPage` so every currently renderable supporting view shares the refreshed shell and card hierarchy.

- [ ] **Step 5: Align operational table styles**

In `App.css`, keep domain-specific column widths and responsive row cards. Remove duplicated panel/table surface declarations now owned by `AdminUi.css`. Ensure `th` uses the light-gray header surface and muted uppercase text, `td` uses 14px text and row separators, row hover does not move content, action buttons retain accessible text, and `.table-wrap` is the only horizontal scroll owner.

- [ ] **Step 6: Run operational tests and the full frontend suite**

Run: `cd frontend && npm test && npm run lint && npm run build`

Expected: all frontend tests pass; lint and build exit 0.

- [ ] **Step 7: Commit operational page consistency**

```powershell
git add -- frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx
git commit -m "feat: unify operational admin pages"
```

---

### Task 5: Financial Workspaces and Modal Forms

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `ModalFrame`, `DataPanel`, `FilterToolbar`, `StatCard`, `StatusBadge`, and existing form state/callbacks.
- Produces: modal-based create/edit flows and consistent Fee Record/financial presentation without changing form fields or calculations.

- [ ] **Step 1: Add failing modal and Fee Record tests**

```tsx
it('opens Add Student in the shared modal and closes without submitting', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(screen.getByRole('button', { name: 'Add Student' }))
  expect(screen.getByRole('dialog', { name: 'Create Student Profile' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog', { name: 'Create Student Profile' })).not.toBeInTheDocument()
})

it('uses shared summary and data regions on Fee Record', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Fee Record' }))
  expect(await screen.findByRole('region', { name: 'Fee Record filters' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Student Fee Records' })).toBeInTheDocument()
  expect(document.querySelectorAll('.stat-card').length).toBeGreaterThanOrEqual(3)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: FAIL because Add Student is currently inline and Fee Record uses generic panels.

- [ ] **Step 3: Move Add Student into `ModalFrame`**

Keep `form`, `formErrors`, `isCreating`, `updateForm`, and `submitStudent` unchanged. Render:

```tsx
{showCreateForm && canCreateStudents && <ModalFrame title="Create Student Profile" description="Add enrolment and profile details." onClose={() => setShowCreateForm(false)} footer={<><button type="button" className="secondary-action" onClick={() => setShowCreateForm(false)}>Cancel</button><button className="primary-action compact" type="submit" form="create-student-form" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Student'}</button></>}><form id="create-student-form" className="form-grid" onSubmit={submitStudent}>{studentFields}</form></ModalFrame>}
```

Do not close the modal on validation failure. Preserve the current successful-create behavior and explicitly call `setShowCreateForm(false)` only after a successful response.

- [ ] **Step 4: Apply modal framing to existing create/edit financial forms**

Wrap the existing fee-agreement editor, manual charge editor, payment recorder, payment verifier/void flow, and receipt void flow in `ModalFrame` when their existing visibility state is true. Reuse their current fields, error rendering, submit callbacks, and loading flags. Give each form a unique `id` and connect the fixed footer submit button with its `form` attribute so keyboard submission and validation remain native.

- [ ] **Step 5: Recompose Fee Record and the selected-student finance workspace**

Use `PageHeader`, at least three `StatCard` elements for expected/paid/outstanding totals, `FilterToolbar ariaLabel="Fee Record filters"`, and `DataPanel title="Student Fee Records"`. Preserve direct student opening, month/category tables, all money formatting, permission checks, receipt printing classes, and horizontal table scrolling.

- [ ] **Step 6: Add modal and finance-specific CSS**

Keep dense finance grids in `App.css`, but make `.agreement-form`, `.payment-form`, and related editors neutral content inside `.modal-body`. On desktop allow two-column field grids; below 700px use one column. Ensure modal footer actions wrap, the body has overscroll containment, print rules still hide `.no-print`, and receipt output remains unchanged.

- [ ] **Step 7: Run full frontend and backend regression suites**

Run: `cd frontend && npm test && npm run lint && npm run build`

Expected: all frontend checks pass.

Run: `cd backend && php artisan test`

Expected: all Laravel tests pass with no API or calculation regressions.

- [ ] **Step 8: Commit financial workspace styling**

```powershell
git add -- frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx
git commit -m "feat: refresh financial workspaces and forms"
```

---

### Task 6: Responsive, Accessibility, and Visual Verification

**Files:**
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/App.test.tsx`
- Modify: `docs/superpowers/specs/2026-07-17-reference-admin-ui-refresh-design.md` only if implementation reveals a real accepted-spec mismatch

**Interfaces:**
- Consumes: all refreshed components and existing representative application flows.
- Produces: verified desktop/mobile UI with no new console errors, layout overflow, or accessibility regressions.

- [ ] **Step 1: Add final structural regression assertions**

```tsx
it('keeps the five demo destinations and grouped navigation accessible', async () => {
  await renderAuthenticatedApp()
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(navigation).getAllByRole('button').map((button) => button.textContent)).toEqual(['Dashboard', 'Students', 'Parents', 'Fees', 'Fee Record'])
  expect(within(navigation).getByText('Overview')).toBeInTheDocument()
  expect(within(navigation).getByText('People')).toBeInTheDocument()
  expect(within(navigation).getByText('Finance')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run all automated checks before browser QA**

Run: `cd frontend && npm test && npm run lint && npm run build`

Expected: all tests pass, lint exits 0, and production build succeeds.

Run: `cd backend && php artisan test`

Expected: the full backend suite passes.

- [ ] **Step 3: Verify desktop layouts in the browser at 1280×720**

Start or reuse the existing demo services, log in through the authorized local demo account, and inspect Dashboard, Students, Fees, and Fee Record. Verify the 248px sidebar, 64px utility header, compact page header, white stat/data cards, toolbar grouping, status badges, table overflow ownership, and absence of the old dark hero strip. Capture screenshots for visual comparison and inspect console errors/warnings after the representative flow.

- [ ] **Step 4: Verify mobile layouts at 390×844 and the 320px minimum**

Verify the drawer opens from the utility header, focuses the close button, closes with Escape/backdrop/selection, and restores focus. Confirm page actions and toolbars stack, stat cards collapse, tables scroll only inside `.table-wrap`, modal header/footer remain visible, modal body scrolls, and no page-level horizontal scrollbar appears.

- [ ] **Step 5: Fix only evidence-backed visual or accessibility defects**

For every observed defect, add the smallest matching CSS or markup change, reload the local app, and repeat the exact affected viewport and interaction check. Do not add unrequested visual features or new dependencies during polish.

- [ ] **Step 6: Re-run completion checks after visual fixes**

Run: `cd frontend && npm test && npm run lint && npm run build`

Expected: all frontend checks pass after final CSS changes.

Run: `cd backend && php artisan test`

Expected: all backend tests pass.

- [ ] **Step 7: Commit the verified responsive refresh**

```powershell
git add -- frontend/src/components/AdminUi.css frontend/src/components/AdminShell.css frontend/src/App.css frontend/src/App.test.tsx
git commit -m "fix: polish responsive admin UI"
```

## Completion Evidence

- `npm test`, `npm run lint`, and `npm run build` pass from `frontend/`.
- `php artisan test` passes from `backend/`.
- Browser checks demonstrate the refreshed Dashboard, Students, Fees, and Fee Record at 1280×720.
- Browser checks demonstrate the drawer, stacked toolbars, table overflow, and modal behavior at 390×844 and 320px width.
- Browser console inspection shows no new errors or warnings during the representative flows.
- Git diff contains no backend behavior changes, copied reference branding, new dependencies, or unrelated user files.
