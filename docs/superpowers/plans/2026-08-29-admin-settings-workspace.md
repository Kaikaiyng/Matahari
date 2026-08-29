# Admin Settings Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the display-only Admin Settings cards with a responsive, MAW-inspired workspace backed only by existing RYLAY APIs.

**Architecture:** A dedicated Settings feature owns its section rail, Branding and Attendance forms, loading/error state and permission-aware actions. The tenant provider exposes an in-memory branding update method so successful saves immediately refresh existing consumers.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Testing Library, Oxlint, existing Laravel JSON APIs.

## Global Constraints

- Use RYLAY/MIS design tokens and 16px parent-owned spacing; do not copy MAW colors.
- Do not add backend endpoints, migrations, permissions, packages or placeholder modules.
- Do not expose Telegram, external destination, password/session or school-profile editing controls.
- Preserve backend authorization as authoritative.
- Do not stage `.idea/`.

---

### Task 1: Mutable tenant branding context

**Files:**
- Modify: `frontend/src/tenant.tsx`
- Modify: `frontend/src/tenant.test.tsx`

**Interfaces:**
- Produces: `useTenantConfiguration()` returning tenant data plus `updateBranding(branding)`.

- [ ] **Step 1: Add a failing provider update test**

```tsx
function BrandingProbe() {
  const tenant = useTenantConfiguration()
  return <button onClick={() => tenant.updateBranding({ ...tenant.branding, organization_name: 'Updated Academy' })}>{tenant.branding.organization_name}</button>
}
```

- [ ] **Step 2: Run the focused test**

Run: `cd frontend; npm.cmd test -- tenant.test.tsx`

- [ ] **Step 3: Extend the context value and update document/CSS state**

```tsx
export type TenantConfigurationContextValue = TenantConfiguration & {
  updateBranding: (branding: TenantConfiguration['branding']) => void
}
```

The provider updates React state, `--brand-primary`, `--tenant-accent` and `document.title` through one helper.

- [ ] **Step 4: Re-run the focused test**

Run the Task 1 command and expect all tenant tests to pass.

### Task 2: Settings feature workspace

**Files:**
- Create: `frontend/src/features/settings/SettingsPage.tsx`
- Create: `frontend/src/features/settings/SettingsPage.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `CurrentUser`, `DashboardResponse`, `PageKey`, `apiRequest`, `useTenantConfiguration()`.
- Produces: `SettingsPage({ user, dashboard, onNavigate })`.

- [ ] **Step 1: Add failing section, permission and save tests**

```tsx
render(<SettingsPage user={admin} dashboard={dashboard} onNavigate={navigate} />)
await userEvent.click(screen.getByRole('button', { name: /Branding/i }))
expect(screen.getByLabelText('Organization name')).toBeInTheDocument()
await userEvent.click(screen.getByRole('button', { name: /Users & Access/i }))
await userEvent.click(screen.getByRole('button', { name: 'Manage Employees' }))
expect(navigate).toHaveBeenCalledWith('employees')
```

Mock Branding `PATCH /v1/tenant/branding` and Attendance `GET/PUT /v1/admin/attendance/settings`; assert complete Attendance values are preserved when either Attendance or Notifications saves.

- [ ] **Step 2: Run the Settings test and confirm it fails**

Run: `cd frontend; npm.cmd test -- src/features/settings/SettingsPage.test.tsx`

- [ ] **Step 3: Implement the six real sections**

```tsx
type SettingsSection = 'school' | 'branding' | 'attendance' | 'notifications' | 'users' | 'account'
```

Use an icon-led 260px desktop rail, horizontal mobile rail, system-styled forms and inline loading/errors. Branding saves update tenant context; Attendance and Notifications share one fetched settings object; unauthorized views are read-only; Employees and Attendance Devices use `onNavigate`.

- [ ] **Step 4: Remove the old display-only Settings implementation**

Delete `SettingsPage`, `SettingsModule` and obsolete `.settings-grid`/module-card styles from `App.tsx` and `App.css`; import the feature and pass `setActivePage`.

- [ ] **Step 5: Run focused Settings and App tests**

Run: `cd frontend; npm.cmd test -- src/features/settings/SettingsPage.test.tsx src/tenant.test.tsx src/App.test.tsx`

### Task 3: Documentation and proportional validation

**Files:**
- Modify: `README.md`
- Modify: `docs/current-status.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Record the real Settings boundary**

Document the responsive Settings workspace, live Branding/Attendance/notification controls, deep links and intentionally omitted placeholder/external controls.

- [ ] **Step 2: Run Admin validation**

```powershell
cd frontend
npm.cmd test -- src/features/settings/SettingsPage.test.tsx src/tenant.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

- [ ] **Step 3: Review and commit intended files**

Run `git diff --check`, stage only implementation/test/docs files, keep `.idea/` untracked, commit and push the current feature branch without merging `master`.
