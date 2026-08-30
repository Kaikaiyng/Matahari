# Personal Admin UI Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the owner-approved latest MAW Admin visual and motion pattern consistently across the complete RYLAY Admin Panel with Matahari branding.

**Architecture:** Translate MAW's implemented design into RYLAY's existing shared React/CSS primitives, then migrate the shell and domain pages onto those primitives. Keep RYLAY routes, data, permissions and business workflows unchanged; do not add Tailwind, MUI or automotive implementation code.

**Tech Stack:** React 19, TypeScript 6, Vite 8, existing CSS and Lucide icons, Vitest/Testing Library, Oxlint.

## Global Constraints

- `frontend/` only; do not modify `app/` or backend behaviour.
- Latest `MewahAutoWork/MewahAutoWork/MAW_AdminPanel` component/style source is the visual authority.
- MIS logo and runtime brand tokens replace MAW branding; semantic colours remain semantic.
- Use existing packages and existing RYLAY APIs and permissions.
- Parent layouts own the required 16px sibling-card gap.
- Preserve `prefers-reduced-motion` support.
- Make ordered local commits and do not push before owner visual confirmation.

---

### Task 1: Foundation tokens, typography and motion

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/AdminTypography.css`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/components/OperationalPage.css`
- Test: `frontend/src/adminTypographyContract.test.ts`
- Test: `frontend/src/components/AdminUi.test.tsx`

**Interfaces:**
- Produces CSS variables `--admin-primary`, `--admin-primary-hover`, `--admin-focus-ring`, `--admin-surface`, `--admin-inset`, `--admin-border`, `--admin-shadow`, `--admin-shadow-hover`, `--admin-radius`, `--admin-gap`, `--admin-motion-fast`, `--admin-motion-standard`, and `--admin-motion-expand`.
- Existing `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `ModalFrame`, `StatusBadge`, and input controls consume these variables.

- [ ] Extend typography and component tests to assert the approved MAW scale, 16px gap, card radius, brand focus token and reduced-motion contract.
- [ ] Run `npm.cmd test -- --run src/adminTypographyContract.test.ts src/components/AdminUi.test.tsx` and confirm the new assertions fail before implementation.
- [ ] Add the Matahari-adapted neutral surfaces, card depth, form focus and exact 140/200/240/260/300ms motion tokens; update shared primitives to use them.
- [ ] Add 240ms popover entrance, 260ms open/190ms close, short dialog fade-scale, restrained card lift and reduced-motion overrides.
- [ ] Rerun the focused tests and commit as `style: establish personal admin UI foundation`.

### Task 2: MAW shell and navigation motion

**Files:**
- Modify: `frontend/src/components/AdminShell.tsx`
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/components/AdminNotificationPopover.tsx`
- Test: `frontend/src/components/AdminShell.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes foundation variables from Task 1.
- Produces the existing `AdminShell` API with unchanged route/navigation callbacks and a MAW-style desktop sidebar, utility bar and responsive drawer.

- [ ] Add tests for active navigation, persisted collapse state, group `aria-expanded`, notification reachability and reduced-motion-safe class hooks.
- [ ] Run the two focused test files and confirm the new expectations fail.
- [ ] Match the MAW 256px sidebar, 80px brand region, 56px utility bar, aligned 18px icons, 13px labels, compact child links and Matahari active treatment.
- [ ] Apply exact 200ms sidebar/content translation, 100ms label fade, 300ms group/chevron animation and 150ms notification entrance without changing permission filtering.
- [ ] Preserve tablet/phone drawer behaviour, rerun the focused tests and commit as `style: align admin shell with personal pattern`.

### Task 3: Shared controls, selectors and dialogs

**Files:**
- Modify: `frontend/src/components/AdminUi.tsx`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/components/SystemDateTimePicker.tsx`
- Modify: `frontend/src/components/SystemDateTimePicker.css`
- Test: `frontend/src/components/AdminUi.test.tsx`

**Interfaces:**
- `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `ModalFrame`, `CustomSelect`, `DatePicker`, `TimePicker`, `StatusBadge`, and validation helpers retain their public props.
- `ModalFrame` renders a fixed header, scrollable body and fixed footer while preserving focus trap, Escape handling and submit-state close guards.

- [ ] Add interaction tests for searchable long Select lists, keyboard dismissal, date/time sizing parity, dialog focus management and fixed region class hooks.
- [ ] Run the focused component test and confirm new assertions fail.
- [ ] Translate the latest MAW Select/Combobox/date/time visuals, searchable option panel, selected state, chevron rotation and popover motion into existing controls.
- [ ] Translate the latest MAW Form Dialog structure and section surfaces without changing form submission APIs.
- [ ] Rerun the focused tests and commit as `style: unify admin controls and dialogs`.

### Task 4: Dashboard, Calendar, Attendance and system pages

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/components/CalendarPage.tsx`
- Modify: `frontend/src/components/CalendarPage.css`
- Modify: `frontend/src/features/attendance/AttendanceHubPage.tsx`
- Modify: `frontend/src/features/attendance/AttendanceHubPage.css`
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/features/settings/SettingsPage.css`
- Modify: `frontend/src/features/audit/AuditTrailPage.tsx`
- Modify: `frontend/src/features/audit/AuditTrailPage.css`
- Modify: `frontend/src/features/logs/ApplicationLogsPage.tsx`
- Modify: `frontend/src/features/logs/ApplicationLogsPage.css`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/CalendarPage.test.tsx`
- Test: `frontend/src/features/settings/SettingsPage.test.tsx`
- Test: `frontend/src/features/audit/AuditTrailPage.test.tsx`
- Test: `frontend/src/features/logs/ApplicationLogsPage.test.tsx`

**Interfaces:**
- Consumes shared shell and controls from Tasks 1–3.
- Keeps all existing page props, API requests and permission checks unchanged.

- [ ] Add representative assertions for the standard page-heading, metric-grid, filter-bar, table/panel and inline-expansion structures.
- [ ] Run the listed focused tests and confirm new structure expectations fail.
- [ ] Migrate Dashboard and Attendance to MAW metric/panel hierarchy with 20px major rhythm and 16px internal grids.
- [ ] Migrate Calendar and Settings to the shared filter, section, form and tab surfaces.
- [ ] Refactor Audit Trail and Application Logs onto shared operational components while preserving sanitized inline inspectors.
- [ ] Rerun the listed tests and commit as `style: migrate core admin workspaces`.

### Task 5: People, Finance, Administration and form workflows

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/components/ClassesPage.tsx`
- Modify: `frontend/src/components/ParentsPage.tsx`
- Modify: `frontend/src/components/SchedulePage.tsx`
- Modify: `frontend/src/components/StaffPage.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Modify: `frontend/src/features/fee-agreements/FeeItemRow.tsx`
- Modify: `frontend/src/features/payments/PaymentAllocationEditor.tsx`
- Modify: `frontend/src/features/moderation/UgcModerationPage.tsx`
- Modify: `frontend/src/features/moderation/UgcModerationPage.css`
- Test: `frontend/src/components/ClassesPage.test.tsx`
- Test: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`
- Test: `frontend/src/features/payments/PaymentAllocationEditor.test.tsx`
- Test: `frontend/src/features/moderation/UgcModerationPage.test.tsx`

**Interfaces:**
- Existing page, editor and mutation props remain unchanged.
- Shared dialog/control structure from Task 3 replaces page-specific browser/default presentation.

- [ ] Add representative tests for standardized list panels, action placement, form sections, selector presentation and disabled/busy states.
- [ ] Run the listed focused tests and confirm new assertions fail.
- [ ] Migrate Students, Classes, Schedule, Parents and Employees to the common page/list/filter/table pattern.
- [ ] Migrate student details, Fee Agreements, Fee Records, payments, receipts and employee ability dialogs to fixed-header/sectioned-body/fixed-footer presentation.
- [ ] Migrate Administration/moderation surfaces and remove superseded page-specific card/dialog/select rules.
- [ ] Rerun the listed tests and commit as `style: unify admin domain workflows`.

### Task 6: Documentation and proportional qualification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md`
- Modify: `docs/current-status.md`
- Modify: `docs/project-overview.md`

**Interfaces:**
- Documents the approved Personal Admin UI Pattern as the default for future Admin changes.
- Does not claim School App, backend or database validation.

- [ ] Add the permanent design rule and source-priority summary to `AGENTS.md` and canonical documentation.
- [ ] Run focused Admin tests for all changed shared and representative pages.
- [ ] Run `npm.cmd run lint` and record only existing unrelated warnings.
- [ ] Run `npm.cmd run build` for TypeScript and production bundling.
- [ ] Run `git diff --check`, inspect the complete staged diff, exclude `.idea/`, and commit as `docs: record personal admin UI pattern delivery`.
- [ ] Keep the feature branch local until owner visual confirmation; do not push intermediate commits.
