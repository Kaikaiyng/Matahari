# Sidebar Reference Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Matahari the white, collapsible Mewah AutoWorks-style sidebar while preserving all current navigation, permissions, responsive behavior, and callbacks.

**Architecture:** Keep `AdminShell` as the sole shell owner. Add a local-only persistent desktop collapse state without changing `App.tsx` navigation data, and express the reference appearance through the existing component stylesheet and brand token. Mobile continues to use the independent drawer state.

**Tech Stack:** React 19, TypeScript 6, Lucide React, CSS, Vitest, Testing Library, Oxlint, Vite

## Global Constraints

- Preserve every existing navigation item, permission filter, page key, and page-selection callback.
- Expanded desktop width is 256 pixels; collapsed desktop width is 80 pixels.
- Store only the collapse preference, under `matahari-admin-sidebar-collapsed`; store no user or session data.
- Mobile retains backdrop, Escape, focus restoration, inert content, scroll lock, and close-on-navigation behavior.
- Keep school context, page title, API warning, and user identity in the utility header.
- Move the single logout control into the sidebar footer; do not duplicate logout in the header.
- Add no dependencies and change no backend, database, permission, or business behavior.

---

### Task 1: Persistent collapsible shell behavior

**Files:**
- Modify: `frontend/src/components/AdminShell.test.tsx`
- Modify: `frontend/src/components/AdminShell.tsx`

**Interfaces:**
- Consumes: existing `AdminShellProps`, `navGroups`, `onSelectPage`, and `onLogout` contracts.
- Produces: desktop `.collapsed` shell/sidebar state and the local-storage key `matahari-admin-sidebar-collapsed`.

- [ ] **Step 1: Write the failing collapse behavior test**

Add this test after the navigation/logout test:

```tsx
it('collapses the desktop sidebar and persists the preference', async () => {
  const user = userEvent.setup()
  renderShell()

  const sidebar = document.querySelector<HTMLElement>('.admin-sidebar')
  if (!sidebar) throw new Error('Sidebar was not rendered')

  const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' })
  expect(sidebar).not.toHaveClass('collapsed')

  await user.click(collapseButton)

  expect(sidebar).toHaveClass('collapsed')
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
  expect(window.localStorage.getItem('matahari-admin-sidebar-collapsed')).toBe('true')
})
```

Clear the preference in `beforeEach`:

```tsx
beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd frontend
npm.cmd test -- src/components/AdminShell.test.tsx
```

Expected: the new test fails because no `Collapse sidebar` button or `.collapsed` state exists.

- [ ] **Step 3: Add the minimal persistent collapse implementation**

In `AdminShell.tsx`, import `PanelLeftClose` and `PanelLeftOpen`, define the key, and initialize state safely:

```tsx
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'matahari-admin-sidebar-collapsed'

const [isCollapsed, setIsCollapsed] = useState(() => {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
})

const toggleCollapsed = () => {
  setIsCollapsed((current) => {
    const next = !current
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
    } catch {
      // The visual state can still change when storage is unavailable.
    }
    return next
  })
}
```

Set the shell and aside class names from the two independent states:

```tsx
<div className={isCollapsed ? 'admin-shell sidebar-collapsed' : 'admin-shell'}>
<aside
  className={`admin-sidebar${isOpen ? ' open' : ''}${isCollapsed ? ' collapsed' : ''}`}
  id="main-navigation"
  aria-hidden={isNarrowViewport && !isOpen ? true : undefined}
  inert={isNarrowViewport && !isOpen ? true : undefined}
>
  <div className="admin-brand">
    <BrandMark className="admin-brand-mark" size={27} />
    <div className="admin-brand-copy">
      <strong>{productBrand.productShortName}</strong>
      <span>{productBrand.productDescriptor}</span>
    </div>
    <button
      ref={closeRef}
      className="icon-button drawer-close"
      aria-label="Close navigation"
      onClick={() => closeDrawer()}
    >
      <X size={19} />
    </button>
  </div>
  <button
    type="button"
    className="sidebar-collapse"
    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    aria-expanded={!isCollapsed}
    onClick={toggleCollapsed}
  >
    {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
  </button>

  <nav aria-label="Main navigation">
    {navGroups.map((group) => (
      <section className="nav-group" aria-label={group.label} key={group.label}>
        <h2 className="nav-group-title">{group.label}</h2>
        {group.items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            aria-current={key === activePage ? 'page' : undefined}
            aria-label={label}
            title={isCollapsed ? label : undefined}
            className={key === activePage ? 'nav-item active' : 'nav-item'}
            onClick={() => selectPage(key)}
          >
            <Icon size={18} />
            <span className="sidebar-label">{label}</span>
          </button>
        ))}
      </section>
    ))}
  </nav>

  <footer className="sidebar-footer">
    <div className="sidebar-portal" title={isCollapsed ? 'Admin Portal' : undefined}>
      <span className="sidebar-portal-mark" aria-hidden="true">
        <School size={15} />
      </span>
      <div className="sidebar-label">
        <strong>Admin Portal</strong>
        <small>School operations</small>
      </div>
    </div>
    <button
      type="button"
      className="sidebar-logout"
      aria-label="Logout"
      title={isCollapsed ? 'Logout' : undefined}
      onClick={onLogout}
    >
      <span className="sidebar-footer-icon"><LogOut size={17} /></span>
      <span className="sidebar-label">Log out</span>
    </button>
  </footer>
</aside>
```

Remove the header logout button, but keep the user chip unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
cd frontend
npm.cmd test -- src/components/AdminShell.test.tsx
```

Expected: all `AdminShell` tests pass, including navigation/logout, collapse persistence, mobile Escape/focus restoration, service warning, and scroll reset.

- [ ] **Step 5: Commit the behavior**

```powershell
git add frontend/src/components/AdminShell.tsx frontend/src/components/AdminShell.test.tsx
git commit -m "feat: add collapsible admin sidebar"
```

### Task 2: Reference visual treatment

**Files:**
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/brandingContract.test.ts`

**Interfaces:**
- Consumes: `.admin-sidebar.collapsed`, `.sidebar-collapse`, `.sidebar-label`, `.sidebar-footer`, `.sidebar-portal`, and `.sidebar-logout` markup from Task 1.
- Produces: the 256/80 pixel reference layout and white/slate/blue presentation.

- [ ] **Step 1: Update the brand-token contract first**

Change the expected sidebar token in `brandingContract.test.ts`:

```ts
'--sidebar': '#ffffff',
```

- [ ] **Step 2: Run the branding contract and verify RED**

Run:

```powershell
cd frontend
npm.cmd test -- src/brandingContract.test.ts
```

Expected: failure showing the current `--sidebar` value is `#172033`.

- [ ] **Step 3: Implement the reference CSS**

Set `--sidebar: #ffffff` in `index.css`. Replace the corresponding shell/sidebar/navigation rules in `AdminShell.css` with:

```css
.admin-shell {
  grid-template-columns: 256px minmax(0, 1fr);
  transition: grid-template-columns 150ms ease-out;
}

.admin-shell.sidebar-collapsed {
  grid-template-columns: 80px minmax(0, 1fr);
}

.admin-sidebar {
  position: sticky;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: var(--sidebar, #ffffff);
  color: var(--text, #172033);
  border-right: 1px solid #e2e8f0;
  box-shadow: 5px 0 24px rgb(15 23 42 / 4%);
}

.admin-brand {
  min-height: 96px;
  border-bottom: 1px solid #f1f5f9;
}

.nav-item {
  min-height: 40px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.nav-item:hover {
  background: #f8fafc;
  color: #0f172a;
}

.nav-item.active {
  border-color: transparent;
  background: #eef2ff;
  color: #1e3a8a;
  box-shadow: none;
}

.admin-sidebar.collapsed .sidebar-label,
.admin-sidebar.collapsed .admin-brand-copy {
  width: 0;
  opacity: 0;
  pointer-events: none;
}
```

Add these exact rules for visually hidden group names, the edge control, the fixed footer, and collapsed alignment:

```css
.nav-group-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sidebar-collapse {
  position: absolute;
  top: 82px;
  right: -14px;
  z-index: 2;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  background: #ffffff;
  color: #64748b;
  box-shadow: 0 2px 8px rgb(15 23 42 / 10%);
  cursor: pointer;
}

.sidebar-collapse:hover {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.admin-sidebar nav {
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  overflow-y: auto;
  padding: 14px 10px 18px;
}

.sidebar-footer {
  flex: 0 0 auto;
  padding: 12px 10px 16px;
  border-top: 1px solid #f1f5f9;
  background: #ffffff;
}

.sidebar-portal,
.sidebar-logout {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #475569;
  text-align: left;
}

.sidebar-portal-mark,
.sidebar-footer-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}

.sidebar-portal-mark {
  border: 1px solid #e2e8f0;
}

.sidebar-portal strong,
.sidebar-portal small {
  display: block;
  white-space: nowrap;
}

.sidebar-portal strong {
  font-size: 12px;
}

.sidebar-portal small {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}

.sidebar-logout {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.sidebar-footer-icon {
  background: #fef2f2;
  color: #ef4444;
}

.sidebar-logout:hover {
  background: #fef2f2;
  color: #dc2626;
}

.sidebar-label,
.admin-brand-copy {
  min-width: 0;
  overflow: hidden;
  opacity: 1;
  transform: translateX(0);
  transition:
    width 100ms ease,
    opacity 100ms ease,
    transform 100ms ease;
}

.admin-sidebar.collapsed .admin-brand {
  justify-content: center;
  padding-inline: 10px;
}

.admin-sidebar.collapsed .nav-item,
.admin-sidebar.collapsed .sidebar-portal,
.admin-sidebar.collapsed .sidebar-logout {
  justify-content: center;
  gap: 0;
  padding-inline: 0;
}

.admin-sidebar.collapsed .sidebar-label,
.admin-sidebar.collapsed .admin-brand-copy {
  width: 0;
  opacity: 0;
  transform: translateX(4px);
  pointer-events: none;
}

@media (max-width: 1023px) {
  .sidebar-collapse {
    display: none;
  }

  .admin-sidebar.collapsed {
    width: min(300px, calc(100vw - 40px));
  }

  .admin-sidebar.collapsed .admin-brand {
    justify-content: flex-start;
    padding: 20px 18px;
  }

  .admin-sidebar.collapsed .nav-item,
  .admin-sidebar.collapsed .sidebar-portal,
  .admin-sidebar.collapsed .sidebar-logout {
    justify-content: flex-start;
    gap: 12px;
  }

  .admin-sidebar.collapsed .nav-item {
    padding-inline: 18px;
  }

  .admin-sidebar.collapsed .sidebar-portal,
  .admin-sidebar.collapsed .sidebar-logout {
    padding-inline: 10px;
  }

  .admin-sidebar.collapsed .sidebar-label,
  .admin-sidebar.collapsed .admin-brand-copy {
    width: auto;
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
}
```

- [ ] **Step 4: Run focused component and brand tests**

Run:

```powershell
cd frontend
npm.cmd test -- src/components/AdminShell.test.tsx src/brandingContract.test.ts
```

Expected: both files pass.

- [ ] **Step 5: Commit the visual treatment**

```powershell
git add frontend/src/components/AdminShell.css frontend/src/index.css frontend/src/brandingContract.test.ts
git commit -m "style: match reference sidebar shell"
```

### Task 3: Documentation and release verification

**Files:**
- Modify: `docs/current-status.md`

**Interfaces:**
- Consumes: completed sidebar behavior and styles from Tasks 1–2.
- Produces: current UI evidence and a release-ready feature branch.

- [ ] **Step 1: Record the user-visible shell behavior**

Add a 2026-08-07 frontend shell note recording the white 256/80 desktop sidebar, persisted local preference, mobile drawer preservation, and unchanged permission-filtered navigation.

- [ ] **Step 2: Run the complete relevant frontend verification**

Run:

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: Vitest reports zero failures, Oxlint exits 0, and TypeScript/Vite production build exits 0.

- [ ] **Step 3: Perform browser smoke checks**

Verify at desktop and narrow widths:

- expanded sidebar is white and 256 pixels wide;
- collapsed sidebar is 80 pixels wide and retains accessible labels;
- active navigation uses a pale-blue background and dark-blue icon/text;
- logout remains available in the sidebar footer;
- the mobile drawer opens, closes, and shows full labels;
- page content, utility header, and permission-filtered menu items remain unchanged.

- [ ] **Step 4: Review and commit documentation**

```powershell
git diff --check
git status --short
git add docs/current-status.md
git commit -m "docs: record sidebar redesign validation"
```

- [ ] **Step 5: Merge and push through the approved repository workflow**

Fetch `origin/master`, confirm the feature branch is not behind, review the complete diff, merge the verified branch into local `master`, push `master`, and confirm the exact GitHub Actions run succeeds. Do not force-push or rebuild the release artifact outside the workflow.
