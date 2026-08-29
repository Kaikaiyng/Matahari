# Admin Card System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Admin cards with a complete MAW-inspired visual hierarchy while preserving MIS/RYLAY branding and all existing behavior.

**Architecture:** Define presentation tokens on the Admin shell, apply them through the existing `StatCard` and `DataPanel` primitives, then normalize established domain-card selectors through a targeted compatibility layer. Keep React markup and data flows unchanged except where a class hook is required.

**Tech Stack:** React 19, TypeScript 6, CSS, Vite 8, Vitest, Testing Library, Oxlint.

## Global Constraints

- Change only `frontend/`; do not change the School App or backend.
- Preserve the existing 16px parent-owned card gap.
- Do not add packages, APIs, schema, permissions, or business behavior.
- Retain focus-visible behavior, responsive grids, semantic state colours, and reduced-motion support.
- Do not stage `.idea/`.

---

### Task 1: Shared card foundation and Dashboard hierarchy

**Files:**
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: existing `.admin-shell`, `.stat-card`, `.data-panel`, `.dashboard-*`, `.metric-card`, and `.panel` selectors.
- Produces: shell-scoped `--admin-card-*` presentation tokens and shared MAW-inspired card surfaces.

- [ ] **Step 1: Add a focused Dashboard structure assertion**

Assert that the rendered Dashboard retains four `.stat-card` elements and shared `.data-panel` regions. This protects the shared integration points while the presentation changes.

- [ ] **Step 2: Run the focused test before CSS changes**

Run: `cd frontend; npm.cmd test -- src/App.test.tsx -t "renders the live dashboard"`

Expected: PASS; the task is presentation-only and starts from existing structural coverage.

- [ ] **Step 3: Add Admin-shell card tokens**

Add shell-scoped values equivalent to:

```css
.admin-shell {
  --admin-card-radius: 14px;
  --admin-card-border: #dfe5ee;
  --admin-card-shadow: 0 2px 8px rgb(31 42 68 / 6%);
  --admin-card-shadow-hover: 0 8px 22px rgb(31 42 68 / 10%);
  --admin-card-inset: #f7f9fc;
}
```

Use these values in `.stat-card`, `.data-panel`, `.filter-toolbar`, `.panel`, `.metric-card`, and the main Dashboard card selectors. Dashboard statistic cards become compact, use soft icon tiles, and remove decorative side bars or oversized shadows.

- [ ] **Step 4: Preserve interaction and reduced motion**

Keep one-pixel hover lift only on interactive cards, use a stronger border/shadow on hover, and disable transforms/transitions under `prefers-reduced-motion: reduce`.

- [ ] **Step 5: Run Dashboard and shared Admin tests**

Run: `cd frontend; npm.cmd test -- src/App.test.tsx src/components/AdminShell.test.tsx`

Expected: all selected tests PASS.

### Task 2: Domain-card compatibility, documentation, and verification

**Files:**
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/features/attendance/AttendanceHubPage.css`
- Modify: `frontend/src/features/logs/ApplicationLogsPage.css`
- Modify: `frontend/src/features/settings/SettingsPage.css`
- Modify: `frontend/src/features/moderation/UgcModerationPage.css`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/current-status.md`

**Interfaces:**
- Consumes: Task 1 `--admin-card-*` tokens.
- Produces: consistent surfaces for Classes, Finance, Attendance, Calendar, Audit/Logs, Settings, moderation, and dialog summary cards.

- [ ] **Step 1: Normalize established domain cards**

Apply the shared radius, border, surface, shadow, inset, and hover treatment to existing selectors including `.class-card`, `.contact-card`, `.report-card`, `.schedule-entry-card`, `.parent-accordion-card`, `.attendance-overview-card`, `.attendance-class-card`, `.movement-timeline article`, `.device-list article`, `.ability-list article`, `.settings-workspace`, `.settings-readonly-field`, and `.ugc-header/.ugc-queue/.ugc-detail`.

- [ ] **Step 2: Keep hierarchy semantic**

Use soft green/amber/blue/red icon or status tiles for meaning, keep burgundy as the brand action colour, and avoid tinted full-card fills except warnings, errors, selected states, and subordinate inset content.

- [ ] **Step 3: Update canonical documentation**

Document the shared Admin card tokens, affected Admin surfaces, the unchanged App/backend boundary, and final verification evidence.

- [ ] **Step 4: Run proportional verification**

Run:

```powershell
cd frontend
npm.cmd test -- src/App.test.tsx src/components/AdminShell.test.tsx src/features/settings/SettingsPage.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: selected tests PASS; Oxlint exits 0 (existing Calendar Fast Refresh warnings may remain); TypeScript/Vite build exits 0.

- [ ] **Step 5: Review and commit only intended files**

Run `git diff --check`, review the complete diff, exclude `.idea/`, then commit with `feat: unify admin card design` and push the current feature branch without merging `master`.
