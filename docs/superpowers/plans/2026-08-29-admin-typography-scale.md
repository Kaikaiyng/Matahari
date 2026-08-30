# Admin Typography Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one compact, MAW-inspired typography hierarchy throughout the RYLAY Admin workspace without changing the School App or application behavior.

**Architecture:** Add a final Admin-only typography stylesheet that owns semantic size, weight, line-height, and letter-spacing rules after existing component styles. Keep the existing Plus Jakarta Sans global family and JetBrains Mono log exception, and expose the scale as Admin-scoped CSS custom properties.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Vite

## Global Constraints

- Dashboard is the canonical visual reference.
- Admin presentation only; no API, permissions, data, workflow, or `app/` changes.
- Use 28/20/16/14/13/12/11px semantic levels and 24–30px key metrics.
- Ordinary UI text uses weights 400–700; technical Application Log values retain JetBrains Mono.
- Do not add a package dependency.

---

### Task 1: Typography Contract

**Files:**
- Create: `frontend/src/adminTypographyContract.test.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: the Admin entry stylesheet import graph in `App.tsx`.
- Produces: a contract requiring `AdminTypography.css` to be imported after `App.css` and to contain the approved semantic tokens.

- [x] **Step 1: Write the failing contract test**

Create a Vitest source contract that reads `App.tsx` and `AdminTypography.css`, expects the typography import to follow `App.css`, and asserts exact token declarations for page title `28px`, section title `20px`, card title `16px`, body `14px`, label `13px`, supporting `12px`, eyebrow `11px`, and metric maximum `30px`.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/adminTypographyContract.test.ts`

Expected: FAIL because `AdminTypography.css` does not exist.

- [x] **Step 3: Add the final stylesheet import**

Add `import './AdminTypography.css'` immediately after `import './App.css'` in `frontend/src/App.tsx`.

### Task 2: Admin Semantic Typography

**Files:**
- Create: `frontend/src/AdminTypography.css`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: existing Admin semantic classes such as `.page-header`, `.eyebrow`, `.data-panel-header`, `.stat-card`, `.modal-header`, `.nav-item`, and native table/form elements.
- Produces: Admin-scoped `--admin-type-*` custom properties and final semantic typography rules.

- [x] **Step 1: Define the approved tokens**

Create tokens for `--admin-type-page-title: 28px`, `--admin-type-section-title: 20px`, `--admin-type-card-title: 16px`, `--admin-type-body: 14px`, `--admin-type-label: 13px`, `--admin-type-supporting: 12px`, `--admin-type-eyebrow: 11px`, `--admin-type-metric-min: 24px`, and `--admin-type-metric-max: 30px` on `.admin-shell`, `.session-screen`, and `.login-page-container`.

- [x] **Step 2: Apply hierarchy by semantic role**

Normalise page titles, section/dialog headings, card headings, body/form values, labels/navigation, support copy, table headers/eyebrows, metrics, badges, and empty states. Use 700 only for page/section emphasis and metrics, 600 for card titles/labels/navigation, and 400–500 for readable body/support copy.

- [x] **Step 3: Preserve responsive hierarchy**

At widths up to 640px, reduce page titles to 24px and section/dialog titles to 18px while preserving all lower levels.

- [x] **Step 4: Set the Admin body reading baseline**

In `frontend/src/index.css`, set body text to `14px`, weight `400`, and line height `1.5`; form controls continue to inherit the same family and scale.

### Task 3: Verification and Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/current-status.md`

**Interfaces:**
- Consumes: completed Admin typography implementation.
- Produces: canonical documentation and verification evidence.

- [x] **Step 1: Run focused tests**

Run: `npm.cmd test -- src/adminTypographyContract.test.ts src/brandingContract.test.ts src/components/AdminUi.test.tsx`

Expected: all selected Vitest files pass.

- [x] **Step 2: Run the Admin production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite complete successfully.

- [x] **Step 3: Update canonical documentation**

Document the exact semantic scale, Dashboard-led visual emphasis, Admin-only scope, and responsive title reductions.

- [x] **Step 4: Review and commit**

Run `git diff --check`, confirm no `app/` or unrelated files changed, stage only intended files, and commit with `style: standardize admin typography scale`.
