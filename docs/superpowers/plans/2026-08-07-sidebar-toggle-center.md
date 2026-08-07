# Centered Sidebar Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the desktop sidebar toggle vertically and replace the panel icons with simple directional chevrons.

**Architecture:** Keep `AdminShell` state, storage, accessibility, and mobile behavior unchanged. Replace only the two icon components and the desktop CSS position, then lock both details with focused regression tests.

**Tech Stack:** React 19, TypeScript, Lucide React, CSS, Vitest, Testing Library

## Global Constraints

- Use `ChevronLeft` while the sidebar is expanded and `ChevronRight` while it is collapsed.
- Place the desktop control at `top: 50%` with `transform: translateY(-50%)`.
- Preserve the 28-pixel control, accessible names, persistence, navigation behavior, and mobile hiding rule.
- Do not push this change to GitHub.

---

### Task 1: Center and simplify the sidebar toggle

**Files:**
- Modify: `frontend/src/components/AdminShell.test.tsx`
- Modify: `frontend/src/brandingContract.test.ts`
- Modify: `frontend/src/components/AdminShell.tsx`
- Modify: `frontend/src/components/AdminShell.css`

**Interfaces:**
- Consumes: existing `isCollapsed`, `toggleCollapsed`, and `.sidebar-collapse` contracts.
- Produces: unchanged toggle behavior with `ChevronLeft` / `ChevronRight` visuals and midpoint CSS positioning.

- [x] **Step 1: Write failing icon and position tests**

Extend the collapse behavior test in `AdminShell.test.tsx`:

```tsx
expect(collapseButton.querySelector('.lucide-chevron-left')).toBeInTheDocument()

await user.click(collapseButton)

const expandButton = screen.getByRole('button', { name: 'Expand sidebar' })
expect(expandButton.querySelector('.lucide-chevron-right')).toBeInTheDocument()
```

Add this CSS contract to `brandingContract.test.ts`:

```tsx
it('centers the desktop sidebar toggle on the outer edge', () => {
  const adminShellStyles = readFileSync(resolve(frontendRoot, 'src', 'components', 'AdminShell.css'), 'utf8')

  expect(adminShellStyles).toMatch(
    /\.sidebar-collapse\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/s,
  )
})
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/components/AdminShell.test.tsx src/brandingContract.test.ts`

Expected: FAIL because the component still renders panel icons and `.sidebar-collapse` still uses `top: 82px` without the midpoint transform.

- [x] **Step 3: Implement the minimal component and CSS changes**

In `AdminShell.tsx`, replace the panel icon imports and render branches:

```tsx
import { ChevronLeft, ChevronRight, LogOut, Menu, School, X } from 'lucide-react'

{isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
```

In `.sidebar-collapse` within `AdminShell.css`, replace the fixed top position:

```css
top: 50%;
right: -14px;
transform: translateY(-50%);
```

- [x] **Step 4: Verify GREEN and local quality checks**

Run:

```powershell
npm.cmd test -- src/components/AdminShell.test.tsx src/brandingContract.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all focused tests pass; lint and build exit 0.

- [x] **Step 5: Check the local desktop page**

Open `http://127.0.0.1:5173`, confirm the toggle is centered on the sidebar edge, and exercise expand/collapse once. Confirm the mobile hiding rule is unchanged.

- [x] **Step 6: Commit locally without pushing**

```powershell
git add frontend/src/components/AdminShell.test.tsx frontend/src/brandingContract.test.ts frontend/src/components/AdminShell.tsx frontend/src/components/AdminShell.css docs/superpowers/plans/2026-08-07-sidebar-toggle-center.md
git commit -m "fix: center sidebar toggle control"
```

Expected: the feature branch contains the local commit and no `git push` command is run.
