# Admin MAW Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the Admin workspace typography sizing and shell spacing to the verified MAW Admin source values while retaining MIS branding and behavior.

**Architecture:** Refine the existing final `AdminTypography.css` layer and shell/shared component CSS rather than restructuring React components. Extend the typography contract so the MAW values and shell density cannot drift silently.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Vite

## Global Constraints

- Admin only; do not modify `app/`.
- Preserve MIS colours, routes, permissions, data, responsive behavior, and the 16px sibling-card gap.
- Use MAW source values: 24px page title, 18px section title, 15px card title, 14px body copy, 13px operational controls/tables/navigation, 12px support, 11px eyebrow/table heading, and 24px metrics.
- Use a 56px utility bar, 80px brand area, centred 1600px content maximum, and desktop content padding of 32px horizontal by 24px vertical.
- Do not add dependencies.

---

### Task 1: Extend the Visual Contract

**Files:**
- Modify: `frontend/src/adminTypographyContract.test.ts`

**Interfaces:**
- Consumes: `AdminTypography.css`, `AdminShell.css`, and `AdminUi.css` source text.
- Produces: assertions for the exact MAW typography tokens and shell spacing values.

- [ ] Change token expectations to 24/18/15/14/13/12/11/24px and add source assertions for a 56px utility header, 80px brand area, 1600px main-content cap, 32px desktop horizontal padding, and 24px desktop vertical padding.
- [ ] Run `npm.cmd test -- src/adminTypographyContract.test.ts` and confirm it fails against the old 28/20/16/30px and shell values.

### Task 2: Apply MAW Typography and Shell Density

**Files:**
- Modify: `frontend/src/AdminTypography.css`
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: existing semantic selectors and responsive breakpoints.
- Produces: MAW-sized Admin headings, controls, tables, metrics, utility bar, brand area, centred content container, page rhythm, and statistic-card padding.

- [ ] Update typography tokens and semantic rules to the exact MAW scale, including 13px form values/table cells and 24px metrics.
- [ ] Set the shell utility row to 56px, the sidebar brand row to 80px, and the main content to `width: 100%`, `max-width: 1600px`, centred with 32px/24px desktop padding.
- [ ] Preserve responsive padding at 24px/20px for tablets and 16px/20px for phones.
- [ ] Set page stacks and Dashboard major sections to a 20px vertical rhythm while preserving 16px sibling-card grid gaps and 20px statistic-card internal padding.
- [ ] Run the focused contract test and confirm it passes.

### Task 3: Verify, Document, and Commit

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/current-status.md`

**Interfaces:**
- Consumes: completed MAW density refinement.
- Produces: canonical documentation and build evidence.

- [ ] Run `npm.cmd test -- src/adminTypographyContract.test.ts src/brandingContract.test.ts src/components/AdminUi.test.tsx src/components/AdminShell.test.tsx` and confirm all selected files pass.
- [ ] Run `npm.cmd run build` and confirm TypeScript/Vite succeeds.
- [ ] Update canonical documentation with the verified MAW typography and shell density values.
- [ ] Run `git diff --check`, verify no `app/` changes, and commit only intended files with `style: match admin density to MAW`.
