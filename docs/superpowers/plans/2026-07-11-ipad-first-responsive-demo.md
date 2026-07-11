# Matahari iPad-First Responsive Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the existing Matahari Admin Finance frontend demo-ready on desktop, iPad landscape, iPad portrait, and mobile portrait without changing finance business logic.

**Architecture:** Keep the current single-page React structure and add one focused responsive-navigation state to `App.tsx`. Use CSS containment and breakpoint-specific presentation for tables, forms, and finance sections; reuse existing DOM and actions wherever possible by adding semantic classes and `data-label` attributes rather than duplicating business logic.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Lucide React, CSS, Laravel JSON API, Codex in-app Browser.

## Global Constraints

- Preserve all existing backend payload keys, enum values, permissions, and finance behavior.
- Do not add backend logic, routes, state-management libraries, component libraries, deployment configuration, PDF generation, or new modules.
- Breakpoints are `1181px+`, `1024–1180px`, `768–1023px`, and below `768px`.
- The document must not scroll horizontally at 1440x900, 1180x820, 820x1180, or 390x844.
- Only deliberate table and ledger containers may scroll horizontally.
- Touch targets are at least 44px on tablet/mobile.
- Preserve the existing palette, typography, 8px radius language, print scope, and A4 print rules.
- Display `Classification` as `Charge Type` and `Billing Frequency` as `Billing Pattern`; keep payload keys and the `manual` enum unchanged.
- Do not hide critical financial status, void state, warnings, or actions.

## File Map

- Modify `frontend/src/App.tsx`: responsive navigation state and markup, semantic table classes, mobile data labels, scroll cues, and clearer Fee Agreement display labels.
- Modify `frontend/src/App.css`: all layout, drawer, touch, table/card, form, receipt-screen, ledger, and breakpoint behavior.
- Modify `frontend/src/index.css`: root containment, control typography, safe text behavior, and global focus-visible foundation.
- Keep `frontend/src/api.ts` unchanged: API contracts are outside this pass.
- Keep backend files unchanged unless browser QA proves a genuine frontend-blocking backend defect.

---

### Task 1: Responsive Shell and Drawer Navigation

**Files:**
- Modify: `frontend/src/App.tsx:1-32,4432-4617`
- Modify: `frontend/src/App.css:1-180,1552-1686`
- Modify: `frontend/src/index.css:1-24`

**Interfaces:**
- Consumes: existing `PageKey`, `navItems`, `activePage`, `setActivePage`, and Lucide icons.
- Produces: `isNavOpen: boolean`, `closeNavigation(): void`, `selectPage(page: PageKey): void`, `.menu-button`, `.sidebar-backdrop`, `.sidebar.open`, and `body.nav-open`.

- [x] **Step 1: Record the failing responsive baseline**

Run the existing app and evaluate at 820x1180 and 390x844:

```js
({
  bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
  sidebarPosition: getComputedStyle(document.querySelector('.sidebar')).position,
  navButton: Boolean(document.querySelector('.menu-button')),
  topbarHeight: document.querySelector('.topbar').getBoundingClientRect().height,
})
```

Expected before implementation: `navButton` is `false`, the narrow sidebar is `sticky`, and the 820px topbar is approximately 322px tall.

- [x] **Step 2: Add drawer state, Escape handling, and body scroll locking**

Add `Menu` and `X` to the Lucide import. Inside `App`, add:

```tsx
const [isNavOpen, setIsNavOpen] = useState(false)

const closeNavigation = () => setIsNavOpen(false)

const selectPage = (page: PageKey) => {
  setActivePage(page)
  closeNavigation()
}

useEffect(() => {
  document.body.classList.toggle('nav-open', isNavOpen)

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeNavigation()
    }
  }

  window.addEventListener('keydown', handleEscape)

  return () => {
    document.body.classList.remove('nav-open')
    window.removeEventListener('keydown', handleEscape)
  }
}, [isNavOpen])
```

Update `handleLogout` to call `closeNavigation()` after returning to Dashboard.

- [x] **Step 3: Add semantic drawer controls without changing navigation data**

Before the sidebar, add:

```tsx
<button
  className="sidebar-backdrop"
  aria-label="Close navigation"
  tabIndex={isNavOpen ? 0 : -1}
  onClick={closeNavigation}
/>
```

Change the sidebar and navigation controls to:

```tsx
<aside className={isNavOpen ? 'sidebar open' : 'sidebar'} id="main-navigation">
  <div className="sidebar-heading">
    <div className="brand">
      <img src={misLogo} alt="MIS logo" />
      <div>
        <strong>MIS</strong>
        <span>School ERP</span>
      </div>
    </div>
    <button className="icon-button drawer-close" aria-label="Close navigation" onClick={closeNavigation}>
      <X size={20} />
    </button>
  </div>
  <nav className="nav-list" aria-label="Main navigation">
    {navItems.map((item) => {
      const Icon = item.icon
      return (
        <button
          aria-current={activePage === item.key ? 'page' : undefined}
          aria-label={item.label}
          className={activePage === item.key ? 'nav-item active' : 'nav-item'}
          key={item.label}
          onClick={() => selectPage(item.key)}
        >
          <Icon size={18} />
          <span>{item.label}</span>
        </button>
      )
    })}
  </nav>
</aside>
```

At the start of the topbar, place:

```tsx
<button
  className="icon-button menu-button"
  aria-controls="main-navigation"
  aria-expanded={isNavOpen}
  aria-label="Open navigation"
  onClick={() => setIsNavOpen(true)}
>
  <Menu size={20} />
</button>
```

- [x] **Step 4: Replace the two existing media queries with intentional shell ranges**

Implement these exact structural rules in `App.css`, then retain screen-specific rules under the matching range:

```css
.menu-button,
.drawer-close,
.sidebar-backdrop {
  display: none;
}

body.nav-open {
  overflow: hidden;
}

@media screen and (min-width: 1024px) and (max-width: 1180px) {
  .app-shell {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .sidebar {
    padding: 18px 10px;
  }

  .brand {
    justify-content: center;
  }

  .brand div {
    display: none;
  }

  .nav-item {
    min-height: 52px;
    height: auto;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    padding: 6px 4px;
  }

  .nav-item span {
    display: block;
    max-width: 68px;
    font-size: 10px;
    line-height: 1.15;
    text-align: center;
  }
}

@media screen and (max-width: 1023px) {
  .app-shell {
    display: block;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    width: min(288px, calc(100vw - 48px));
    padding: 18px 14px;
    transform: translateX(-100%);
    transition: transform 160ms ease;
    overflow-y: auto;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: block;
    border: 0;
    background: rgba(19, 20, 24, 0.48);
    opacity: 0;
    pointer-events: none;
  }

  body.nav-open .sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .sidebar-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .drawer-close,
  .menu-button {
    display: grid;
    flex: 0 0 44px;
  }

  .nav-list {
    display: grid;
    overflow: visible;
  }

  .nav-item {
    min-height: 48px;
    height: auto;
    width: 100%;
    justify-content: flex-start;
  }

  .nav-item span {
    display: inline;
  }
}
```

Use `@media (prefers-reduced-motion: reduce)` to remove the drawer transition.

- [x] **Step 5: Add root containment and focus rules**

Update `index.css` with:

```css
html,
body,
#root {
  width: 100%;
  max-width: 100%;
  min-width: 320px;
}

body {
  margin: 0;
  overflow-x: hidden;
}

button,
input,
select,
textarea {
  font: inherit;
}

:where(button, input, select, textarea, [tabindex]):focus-visible {
  outline: 3px solid rgba(216, 39, 48, 0.28);
  outline-offset: 2px;
}
```

Add `min-width: 0; max-width: 100%` to `.main`, `.page-stack`, `.panel`, `.student-detail`, `.fee-agreement-section`, `.fee-record-charge-section`, `.payment-section`, `.payment-form`, and `.receipt-workspace`.

- [x] **Step 6: Verify shell behavior and commit**

At 1180x820 verify the compact labeled rail. At 820x1180 and 390x844 verify the drawer opens, Escape closes it, selecting Students closes it, body scroll is locked while open, active page is visible, and the topbar is under 150px.

Run:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
git diff --check -- src/App.tsx src/App.css src/index.css
```

Expected: all commands exit 0.

Commit:

```powershell
git add frontend/src/App.tsx frontend/src/App.css frontend/src/index.css
git commit -m "feat: add responsive admin navigation"
```

---

### Task 2: Login, Header, Controls, and Touch Foundation

**Files:**
- Modify: `frontend/src/App.css:77-180,760-900,1600-1686`

**Interfaces:**
- Consumes: Task 1 drawer controls and breakpoint ranges.
- Produces: compact `.topbar`, viewport-safe `.login-card`, 44px controls, wrapping `.toolbar-actions`, and safe text behavior.

- [x] **Step 1: Record failing measurements**

At 390x844 evaluate:

```js
Array.from(document.querySelectorAll('button, input, select')).slice(0, 30).map((element) => ({
  label: element.getAttribute('aria-label') || element.textContent.trim(),
  height: element.getBoundingClientRect().height,
}))
```

Expected before implementation: table actions and month controls include heights below 44px.

- [x] **Step 2: Implement compact tablet/mobile topbar**

Under `max-width: 1023px`, use:

```css
.main {
  padding: 18px;
}

.topbar {
  min-height: 64px;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.topbar > div:first-of-type {
  min-width: 0;
  flex: 1 1 240px;
}

.topbar h1,
.topbar .eyebrow {
  overflow-wrap: anywhere;
}

.topbar-actions {
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.topbar .search-box,
.topbar [aria-label='Notifications'] {
  display: none;
}

.user-chip {
  max-width: 220px;
  min-width: 0;
}

.user-chip div {
  min-width: 0;
}

.user-chip strong,
.user-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Below 768px, set `.main { padding: 12px; }`, `.topbar > div:first-of-type { flex-basis: calc(100% - 56px); }`, and keep actions on one compact second row.

- [x] **Step 3: Enforce usable controls and wrapping**

Use:

```css
@media screen and (max-width: 1023px) {
  .primary-action,
  .secondary-action,
  .table-action,
  .icon-button,
  .nav-item,
  .form-field input,
  .form-field select,
  .toolbar-actions select,
  .status-editor select,
  .toggle-field {
    min-height: 44px;
  }

  .toolbar-actions,
  .payment-actions,
  .payment-subheader,
  .page-title-row,
  .panel-header {
    flex-wrap: wrap;
  }

  .toolbar-actions > *,
  .payment-actions > * {
    max-width: 100%;
  }

  .badge,
  .permission-note,
  td,
  dd,
  strong,
  small {
    overflow-wrap: anywhere;
  }
}
```

- [x] **Step 4: Harden login for mobile keyboards and short viewports**

Use:

```css
.login-screen {
  min-height: 100vh;
  min-height: 100dvh;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
}

.login-card {
  width: min(440px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}

@media screen and (max-width: 767px), screen and (max-height: 620px) {
  .login-screen {
    place-items: start center;
  }

  .login-card {
    margin-block: auto;
    padding: 18px;
  }
}
```

- [x] **Step 5: Verify login and header, then commit**

Verify login at 820x1180 and 390x844, including a failed login error and a successful login. Confirm no horizontal overflow, readable labels, visible errors, and reachable Login button.

Run build, lint, and diff check. Commit:

```powershell
git add frontend/src/App.css
git commit -m "fix: improve responsive form and header usability"
```

---

### Task 3: Student List and Student Detail Hierarchy

**Files:**
- Modify: `frontend/src/App.tsx:2207-2531`
- Modify: `frontend/src/App.css:800-946,1600-1686`

**Interfaces:**
- Consumes: existing student table, `loadStudentDetail`, `StudentSummary`, status formatting, and detail sections.
- Produces: `.student-list-table`, `.student-primary-cell`, `.student-secondary-cell`, mobile `data-label` values, and ordered detail blocks.

- [x] **Step 1: Confirm the failing mobile list**

At 390x844 verify the seven-column Student List is compressed and that the page can be scrolled horizontally when dense finance content is open.

- [x] **Step 2: Add semantic classes and data labels to the existing student table**

Change the table to `className="student-list-table"`. Add these attributes to each mapped row:

```tsx
<td className="student-primary-cell" data-label="Student Name">{student.full_name}</td>
<td data-label="Student ID">{student.student_no}</td>
<td data-label="Class">{student.class?.name ?? formatLevelGroup(student.level_group)}</td>
<td className="student-secondary-cell" data-label="Fee Amount">{canViewFeeRecord ? feeAmount : 'No access'}</td>
<td className="student-secondary-cell" data-label="Outstanding">{canViewFeeRecord ? outstandingAmount : 'No access'}</td>
<td data-label="Status">
  <span className={`badge ${statusClass(student.status)}`}>{formatStatus(student.status)}</span>
</td>
<td className="student-open-cell" data-label="Action">
  <button className="table-action" onClick={() => void loadStudentDetail(student.id)}>
    <Eye size={15} /> Open
  </button>
</td>
```

Keep the existing loading and empty rows unchanged except for adding `className="table-state-row"`.

- [x] **Step 3: Convert the student table into an operational list below 1024px**

Add:

```css
@media screen and (max-width: 1023px) {
  .student-list-table {
    min-width: 0;
  }

  .student-list-table thead {
    display: none;
  }

  .student-list-table tbody,
  .student-list-table tr,
  .student-list-table td {
    display: block;
    width: 100%;
  }

  .student-list-table tbody {
    display: grid;
    gap: 0;
  }

  .student-list-table tr {
    position: relative;
    padding: 14px 132px 14px 0;
    border-bottom: 1px solid #edf0f4;
  }

  .student-list-table td {
    border: 0;
    padding: 2px 0;
    font-size: 14px;
  }

  .student-list-table td::before {
    content: attr(data-label) ': ';
    color: #747985;
    font-size: 12px;
    font-weight: 800;
  }

  .student-list-table .student-primary-cell {
    font-size: 16px;
    font-weight: 800;
  }

  .student-list-table .student-primary-cell::before,
  .student-list-table .student-secondary-cell,
  .student-list-table .student-open-cell::before {
    display: none;
  }

  .student-list-table .student-open-cell {
    position: absolute;
    top: 50%;
    right: 0;
    width: 116px;
    transform: translateY(-50%);
  }

  .student-list-table .student-open-cell .table-action {
    width: 100%;
  }
}

@media screen and (max-width: 479px) {
  .student-list-table tr {
    padding-right: 0;
  }

  .student-list-table .student-open-cell {
    position: static;
    width: 100%;
    margin-top: 10px;
    transform: none;
  }
}
```

- [x] **Step 4: Enforce the approved detail order and narrow layout**

Keep the existing DOM section sequence. Move the `Fee Record Totals` detail block immediately after `Student Profile` if it is not already there. Keep Parent/Guardian and Status Action after totals, then Remarks. Do not move finance business components across state boundaries.

Use:

```css
@media screen and (max-width: 1023px) {
  .detail-grid,
  .summary-grid.three,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .student-detail .panel-header {
    align-items: flex-start;
  }

  .student-detail h2,
  .student-detail dd {
    overflow-wrap: anywhere;
  }

  .student-detail dl div {
    align-items: flex-start;
  }
}
```

- [x] **Step 5: Verify Student List and Detail, then commit**

Verify required fields and Open action at 820x1180 and 390x844. Open the long seeded QA student and verify the approved detail order, wrapping ID, full-width status action, and no page overflow. Recheck 1440x900 table density.

Commit after build, lint, and diff check:

```powershell
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "fix: adapt student workflows for narrow screens"
```

---

### Task 4: Fee Agreement, Charge Preview, and Manual Charge Forms

**Files:**
- Modify: `frontend/src/App.tsx:2532-3158`
- Modify: `frontend/src/App.css:947-1090,1233-1408,1552-1686`

**Interfaces:**
- Consumes: existing Fee Agreement form state, `classification`, `billing_frequency`, `billing_months`, preview state, and manual-charge state.
- Produces: clearer display labels, `.preview-charge-table`, `.fee-record-action-group`, 44px month selectors, and contained form grids.

- [x] **Step 1: Record failing form measurements**

At 820x1180 and 390x844 open Supersede Current and measure `.billing-month-options label`. Expected before implementation: approximately 34px high.

- [x] **Step 2: Rename display labels without changing form keys**

Replace only the user-facing text in both agreement item configurations:

```tsx
<label className="form-field">
  Charge Type
  <select
    value={item.classification}
    onChange={(event) =>
      updateFeeAgreementItem(
        item.fee_item_id,
        'classification',
        event.target.value as FeeAgreementItemClassification,
      )
    }
  >
    {feeAgreementClassificationOptions.map((option) => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </select>
</label>
```

```tsx
<label className="form-field">
  Billing Pattern
  <select
    value={item.billing_frequency}
    onChange={(event) =>
      updateFeeAgreementItem(
        item.fee_item_id,
        'billing_frequency',
        event.target.value as BillingFrequency,
      )
    }
  >
    {billingFrequencyOptions.map((option) => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </select>
</label>
```

Do not remove the `manual` option.

- [x] **Step 3: Make agreement controls touch-safe and readable**

Use:

```css
@media screen and (max-width: 1023px) {
  .agreement-items-grid,
  .agreement-item-row,
  .agreement-item-main,
  .agreement-item-main:has(input[placeholder]),
  .agreement-billing-config {
    grid-template-columns: 1fr;
  }

  .agreement-item-row {
    padding: 12px;
  }

  .billing-month-options {
    grid-template-columns: repeat(4, minmax(64px, 1fr));
  }

  .billing-month-options label {
    min-height: 44px;
    cursor: pointer;
  }

  .billing-month-options label.selected {
    border-color: #167a4a;
    background: #dff5e9;
    box-shadow: inset 0 0 0 1px #167a4a;
  }

  .agreement-preview {
    justify-content: flex-start;
  }
}

@media screen and (max-width: 479px) {
  .billing-month-options {
    grid-template-columns: repeat(3, minmax(72px, 1fr));
  }
}
```

- [x] **Step 4: Contain activation and Manual Charge actions**

Wrap the activation buttons in `<div className="fee-record-action-group">`. Use:

```css
.fee-record-action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media screen and (min-width: 768px) and (max-width: 1023px) {
  .manual-charge-form .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media screen and (max-width: 767px) {
  .fee-record-activation-bar,
  .manual-charge-form .form-grid {
    grid-template-columns: 1fr;
  }

  .fee-record-action-group > *,
  .manual-charge-form > .primary-action {
    width: 100%;
  }
}
```

- [x] **Step 5: Convert only preview rows to mobile record cards**

Add `className="preview-charge-table"` to each preview table and add `data-label` values `Month`, `Fee`, `Description`, `Category`, `Amount`, and `Status` to its body cells.

Below 768px use this complete preview-record presentation. Keep tablet portrait as a contained scrolling table with `min-width: 860px`.

```css
@media screen and (max-width: 767px) {
  .preview-charge-table {
    min-width: 0;
  }

  .preview-charge-table thead {
    display: none;
  }

  .preview-charge-table tbody,
  .preview-charge-table tr,
  .preview-charge-table td {
    display: block;
    width: 100%;
  }

  .preview-charge-table tbody {
    display: grid;
    gap: 10px;
  }

  .preview-charge-table tr {
    border: 1px solid #edf0f4;
    border-radius: 8px;
    padding: 12px;
  }

  .preview-charge-table td {
    display: grid;
    grid-template-columns: minmax(88px, 0.45fr) minmax(0, 1fr);
    gap: 8px;
    border: 0;
    padding: 4px 0;
  }

  .preview-charge-table td::before {
    content: attr(data-label);
    color: #747985;
    font-size: 12px;
    font-weight: 800;
  }
}
```

- [x] **Step 6: Verify agreement, preview, and manual form, then commit**

At 820x1180 and 390x844 verify labels, 44px month controls, selected/unselected distinction, wrapped actions, warning prominence, preview readability, local validation, and no page overflow. Confirm Supersede payload behavior is unchanged by inspecting the existing request body in source.

Commit after build, lint, and diff check:

```powershell
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "fix: improve responsive fee configuration flows"
```

---

### Task 5: Payment Allocation and Financial History

**Files:**
- Modify: `frontend/src/App.tsx:3159-3758`
- Modify: `frontend/src/App.css:1090-1337,1360-1430,1552-1686`

**Interfaces:**
- Consumes: existing `paymentForm`, allocation totals, grouped outstanding charges, verify/void/generate/print handlers, and receipt history.
- Produces: `.payment-history-table`, `.receipt-history-table`, `.history-state-row`, mobile `data-label` values, and `.payment-submit-area`.

- [x] **Step 1: Record the failing mobile payment baseline**

At 390x844 open Create Payment and evaluate:

```js
({
  body: [document.body.clientWidth, document.body.scrollWidth],
  payment: document.querySelector('.payment-form').getBoundingClientRect().width,
  chargeTargets: Array.from(document.querySelectorAll('.charge-cell-row')).slice(0, 4).map((row) => row.getBoundingClientRect().height),
})
```

Expected before implementation: body width pair approximately `[375, 518]` and payment form wider than its panel.

- [x] **Step 2: Contain and stack the payment form**

Use:

```css
.payment-form,
.payment-allocation-block,
.allocation-rows,
.allocation-row,
.charge-picker,
.charge-month-group,
.charge-category-group {
  min-width: 0;
  max-width: 100%;
}

@media screen and (min-width: 768px) and (max-width: 1023px) {
  .payment-form > .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media screen and (max-width: 767px) {
  .payment-section,
  .payment-form,
  .payment-allocation-block {
    padding: 12px;
  }

  .payment-form > .form-grid,
  .allocation-row,
  .allocation-row.charge {
    grid-template-columns: 1fr;
  }

  .payment-subheader {
    align-items: stretch;
    flex-direction: column;
  }

  .payment-subheader .table-action,
  .allocation-row .table-action {
    width: 100%;
  }
}
```

- [x] **Step 3: Improve charge and allocation touch usability**

Use:

```css
@media screen and (max-width: 1023px) {
  .charge-cell-row {
    min-height: 56px;
    align-items: flex-start;
    padding: 12px;
  }

  .charge-cell-row input,
  .toggle-field input,
  .checkbox-line input {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
  }

  .charge-cell-row span {
    min-width: 0;
  }

  .charge-cell-row small {
    overflow-wrap: anywhere;
  }
}
```

Wrap the balance strip and submit button in:

```tsx
<div className="payment-submit-area">
  <div className={`agreement-preview ${paymentAmountCents === allocationTotalCents ? '' : 'warning'}`}>
    <span>Payment {formatCurrency(Number(paymentForm.amount || 0))}</span>
    <span>Allocation {formatCurrency(paymentAllocationTotal)}</span>
    <strong>{paymentAmountCents === allocationTotalCents ? 'Balanced' : 'Mismatch'}</strong>
  </div>
  <button className="primary-action" disabled={isSavingPayment}>
    {isSavingPayment ? 'Saving...' : 'Record Payment'}
  </button>
</div>
```

On mobile make `.payment-submit-area` sticky at `bottom: 0`, add `padding-bottom: max(8px, env(safe-area-inset-bottom))`, a white background, and a top border. Confirm it does not cover the last allocation row; if it does, add matching bottom padding to `.payment-form`.

- [x] **Step 4: Add mobile labels to Payment History without duplicating actions**

Add `className="payment-history-table"` to the payment table. Add these body-cell labels: `Payment Date`, `Received Date`, `Method`, `Amount`, `Status`, `Reference`, `Receipt`, `Recorded By`, `Verified By`, and `Actions`. Add `className="history-state-row"` to loading and empty rows, and `className="payment-allocation-summary"` to allocation detail rows.

Below 768px use the following record presentation for both history tables. Preserve the allocation detail row immediately after its payment card.

```css
@media screen and (max-width: 767px) {
  .payment-history-table,
  .receipt-history-table {
    min-width: 0;
  }

  .payment-history-table thead,
  .receipt-history-table thead {
    display: none;
  }

  .payment-history-table tbody,
  .payment-history-table tr,
  .payment-history-table td,
  .receipt-history-table tbody,
  .receipt-history-table tr,
  .receipt-history-table td {
    display: block;
    width: 100%;
  }

  .payment-history-table tbody,
  .receipt-history-table tbody {
    display: grid;
    gap: 12px;
  }

  .payment-history-table tr:not(.payment-allocation-summary):not(.history-state-row),
  .receipt-history-table tr:not(.history-state-row) {
    border: 1px solid #edf0f4;
    border-radius: 8px;
    padding: 12px;
  }

  .payment-history-table td,
  .receipt-history-table td {
    display: grid;
    grid-template-columns: minmax(104px, 0.45fr) minmax(0, 1fr);
    gap: 8px;
    border: 0;
    padding: 4px 0;
  }

  .payment-history-table td::before,
  .receipt-history-table td::before {
    content: attr(data-label);
    color: #747985;
    font-size: 12px;
    font-weight: 800;
  }

  .payment-history-table td:has(.payment-actions),
  .receipt-history-table td:has(.payment-actions) {
    display: block;
    margin-top: 8px;
  }

  .payment-history-table td:has(.payment-actions)::before,
  .receipt-history-table td:has(.payment-actions)::before,
  .payment-allocation-summary td::before,
  .history-state-row td::before {
    display: none;
  }

  .payment-allocation-summary {
    margin-top: -12px;
    border: 1px solid #edf0f4;
    border-top: 0;
    border-radius: 0 0 8px 8px;
  }

  .payment-actions .table-action {
    flex: 1 1 calc(50% - 4px);
    min-height: 44px;
  }
}
```

- [x] **Step 5: Add mobile labels to Receipt History**

Add `className="receipt-history-table"` to the receipt history table while retaining `receipt-history no-print` on the wrapper. Add body-cell labels: `Receipt No`, `Date`, `Amount`, `Status`, `Paid By`, `Issued By`, `Void Details`, and `Actions`.

The CSS block in Step 4 applies the complete mobile record presentation to `.receipt-history-table`. Add `overflow-wrap: anywhere` to receipt number and void detail cells. Keep status text and destructive actions visible.

- [x] **Step 6: Verify payment and history flows, then commit**

At 820x1180 and 390x844:

- Open Create Payment.
- Select an outstanding charge.
- Confirm partial amount input remains readable.
- Confirm selected total and payment amount remain visible.
- Create a mismatch and verify warning prominence.
- Add a manual allocation and verify its warning.
- Verify Payment History and Receipt History actions remain tappable.
- Confirm `document.body.scrollWidth === document.body.clientWidth`.

Do not submit a new payment during responsive QA unless a dedicated seeded QA record is intentionally being created.

Commit after build, lint, and diff check:

```powershell
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "fix: make payment workflows touch friendly"
```

---

### Task 6: Receipt Screen and Print Isolation

**Files:**
- Modify: `frontend/src/App.tsx:3759-3865`
- Modify: `frontend/src/App.css:1418-1551,1687-1737`

**Interfaces:**
- Consumes: existing `.receipt-print-scope`, `.receipt-sheet`, receipt data, `printReceipt`, and `@media print` rules.
- Produces: `.receipt-items-scroll`, contained receipt screen behavior, and screen-only responsive receipt rules.

- [x] **Step 1: Record the failing receipt baseline**

At 390x844 open receipt `MIS.A0006 (07/2026)` and evaluate:

```js
({
  body: [document.body.clientWidth, document.body.scrollWidth],
  receipt: [
    document.querySelector('.receipt-sheet').getBoundingClientRect().width,
    document.querySelector('.receipt-sheet').scrollWidth,
  ],
})
```

Expected before implementation: receipt width approximately 738px and page width approximately 792px.

- [x] **Step 2: Wrap only the receipt item table**

Change the items markup to:

```tsx
<div className="receipt-items">
  <h3>Being Payment For</h3>
  <div className="receipt-items-scroll">
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Fee Code</th>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {selectedReceipt.items.map((item, index) => (
          <tr key={item.id}>
            <td>{index + 1}</td>
            <td>{item.fee_code ?? 'Manual'}</td>
            <td>{item.description}</td>
            <td>{formatCurrency(item.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

- [x] **Step 3: Add screen-only responsive receipt rules**

Use:

```css
.receipt-sheet,
.receipt-brand,
.receipt-meta,
.receipt-two-column,
.receipt-two-column dl,
.receipt-two-column dl div,
.receipt-items,
.receipt-items-scroll {
  min-width: 0;
  max-width: 100%;
}

.receipt-items-scroll {
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.receipt-two-column dd,
.receipt-meta strong,
.amount-words strong {
  overflow-wrap: anywhere;
}

@media screen and (min-width: 768px) and (max-width: 1023px) {
  .receipt-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media screen and (max-width: 767px) {
  .receipt-sheet {
    width: 100%;
    padding: 16px;
  }

  .receipt-brand {
    align-items: flex-start;
  }

  .receipt-brand img {
    width: 56px;
    height: 56px;
  }

  .receipt-meta,
  .receipt-two-column {
    grid-template-columns: 1fr;
  }

  .receipt-two-column dl div {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .receipt-two-column dd {
    text-align: left;
  }

  .receipt-items-scroll table {
    min-width: 480px;
  }

  .receipt-sheet .no-print .primary-action {
    width: 100%;
  }
}
```

Do not place these rules inside `@media print`.

- [x] **Step 4: Verify screen and print, then commit**

Verify receipt screen at all four target sizes. Confirm the page does not scroll horizontally, the items table can scroll internally on mobile, IDs wrap, and Print Receipt is reachable.

Open browser print preview when supported. Confirm only `.receipt-print-scope` is visible, A4 margins remain 14mm, the receipt has no screen border/radius, and no toolbar prints.

Commit after build, lint, and diff check:

```powershell
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "fix: contain receipt screen without changing print"
```

---

### Task 7: Fee Record Summary and Category Monthly Ledgers

**Files:**
- Modify: `frontend/src/App.tsx:3961-4290`
- Modify: `frontend/src/App.css:503-662,1552-1686`

**Interfaces:**
- Consumes: existing summary/monthly filters, tables, rows, `FeeRecordMonthCellView`, and student-open behavior.
- Produces: `.table-scroll-hint`, `.fee-record-table-wrap`, and viewport-contained ledgers.

- [x] **Step 1: Record failing summary and monthly baselines**

At 390x844 evaluate both Fee Record views. Expected before implementation:

```js
({
  body: [document.body.clientWidth, document.body.scrollWidth],
  filters: document.querySelector('.fee-record-filters').getBoundingClientRect().width,
  table: [
    document.querySelector('.fee-record-ledger .table-wrap').clientWidth,
    document.querySelector('.fee-record-ledger .table-wrap').scrollWidth,
  ],
})
```

The current body is about 518px wide and the filter panel about 486px wide.

- [x] **Step 2: Add explicit horizontal-scroll cues**

Immediately before each ledger wrapper, add:

```tsx
<p className="table-scroll-hint">Swipe horizontally to see all financial columns.</p>
```

Change each wrapper to `className="table-wrap fee-record-table-wrap"`.

- [x] **Step 3: Contain filters and ledgers**

Use:

```css
.table-wrap,
.fee-record-table-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.table-scroll-hint {
  display: none;
  margin: 0;
  color: #626773;
  font-size: 13px;
  font-weight: 700;
}

@media screen and (min-width: 768px) and (max-width: 1023px) {
  .fee-record-filters,
  .fee-record-filters.has-category {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media screen and (max-width: 767px) {
  .fee-record-view-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .fee-record-filters,
  .fee-record-filters.has-category {
    width: 100%;
    grid-template-columns: 1fr;
  }

  .fee-record-filters .wide {
    grid-column: auto;
  }

  .table-scroll-hint {
    display: block;
  }

  .fee-record-ledger {
    overflow: hidden;
  }
}
```

Keep `.fee-record-ledger table { min-width: 1320px; }` and `.monthly-ledger table { min-width: 1780px; }` so financial columns remain readable.

- [x] **Step 4: Improve ledger readability without spreadsheet behavior**

Use:

```css
.fee-record-ledger th {
  white-space: nowrap;
}

.monthly-ledger th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #ffffff;
}

.monthly-ledger td {
  vertical-align: top;
}

@media screen and (max-width: 767px) {
  .month-cell {
    min-width: 120px;
    font-size: 13px;
  }
}
```

Do not add sticky Student Name/ID columns in this pass; at 390px they would consume most of the viewport and reduce month readability. The visible cue and contained scroll satisfy the small, safe scope.

- [x] **Step 5: Verify ledgers and commit**

At all four viewports verify:

- Filters wrap and remain 44px tall.
- Document width equals viewport width.
- Summary table scrolls internally and retains Student, Student ID, Expected, Paid, Outstanding, and Status.
- Category Monthly scrolls from Jan through Dec.
- Month states remain visually distinct and readable.
- Scroll hint is visible only on narrow screens.
- Student names still open Student Detail.

Commit after build, lint, and diff check:

```powershell
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "fix: contain responsive fee record ledgers"
```

---

### Task 8: Full Regression QA, Review, Push, and Merge

**Files:**
- Verify: `frontend/src/App.tsx`
- Verify: `frontend/src/App.css`
- Verify: `frontend/src/index.css`
- Verify: `docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified branch, browser evidence, final responsive status, pushed branch, and merged GitHub change.

- [x] **Step 1: Run static verification**

```powershell
cd C:\Users\chong\Documents\Matahari\frontend
npm.cmd run build
npm.cmd run lint
cd ..
git diff --check origin/master...HEAD -- frontend/src/App.tsx frontend/src/App.css frontend/src/index.css docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md docs/superpowers/plans/2026-07-11-ipad-first-responsive-demo.md
```

Expected: build exits 0, lint reports zero errors, and diff check emits no output.

- [x] **Step 2: Run the requested browser matrix**

At 1440x900, 1180x820, 820x1180, and 390x844 test:

1. Login and visible error behavior.
2. Open and close navigation; select Students.
3. Student List and filters.
4. Open long-name Student Detail and check totals/order.
5. Open Fee Agreement billing configuration and inspect month controls.
6. Preview Fee Record charges and warnings.
7. Open Manual Charge without submitting.
8. Open Payment form, select an outstanding charge, edit partial amount, create mismatch, and inspect manual-allocation warning.
9. Inspect Payment History and Receipt History actions.
10. Open the issued receipt and inspect internal item-table scroll.
11. Open Fee Record Summary and scroll its ledger.
12. Open Category Monthly and scroll Jan through Dec.
13. Return to 1440x900 and confirm the desktop sidebar, tables, forms, and receipt remain intact.

For every viewport evaluate:

```js
({
  viewport: [window.innerWidth, window.innerHeight],
  body: [document.body.clientWidth, document.body.scrollWidth],
  html: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
})
```

Expected: each width pair is equal except inside intentional `.table-wrap` elements.

Accessibility checks in the same pass:

- Tab through the menu button, drawer items, filters, month selectors, charge selectors, history actions, and Print Receipt.
- Confirm each focused control has a visible ring.
- Confirm the active navigation item exposes `aria-current="page"`.
- Confirm status and void meaning remains readable without relying only on color.
- Confirm all tablet/mobile interaction targets measure at least 44px in either width or height for their intended tap area.

- [ ] **Step 3: Check receipt print preview**

> Native print preview is not exposed by the Codex in-app browser. The print action was invoked and the unchanged A4 print CSS was reviewed; real preview remains a known limitation.

Open the issued receipt, trigger print, and inspect preview where supported. Confirm the A4 receipt remains readable and screen-only drawer, sidebar, topbar, histories, and buttons do not print.

- [x] **Step 4: Review the final diff**

Run:

```powershell
git status --short
git diff --stat origin/master...HEAD
git diff origin/master...HEAD -- frontend/src/App.tsx frontend/src/App.css frontend/src/index.css
```

Confirm unrelated untracked `.gstack/`, `docs/business-rules/`, and `frontend/test-results/` content remains unstaged and unchanged.

- [x] **Step 5: Commit the implementation plan and any final QA correction**

If the plan is not yet committed:

```powershell
git add docs/superpowers/plans/2026-07-11-ipad-first-responsive-demo.md
git commit -m "docs: add responsive demo implementation plan"
```

If QA required a final focused correction, stage only its named frontend files and commit with `fix: complete responsive demo QA`.

- [ ] **Step 6: Push the verified branch**

```powershell
git push -u origin responsive/ipad-demo-pass
```

Expected: remote branch is created and push exits 0.

- [ ] **Step 7: Create and merge the pull request**

```powershell
gh pr create --base master --head responsive/ipad-demo-pass --title "Make finance MVP responsive for iPad demos" --body "Implements the approved iPad-first responsive demo pass. Preserves backend behavior and verifies desktop, iPad landscape, iPad portrait, mobile, build, lint, and financial ledger scrolling."
gh pr checks --watch
gh pr merge --merge --delete-branch
```

Expected: required checks pass, the PR is merged into `master`, and the remote feature branch is deleted. If repository rules require a different merge method, stop and report the exact rule rather than bypassing protection.

- [ ] **Step 8: Confirm the merged result**

```powershell
git switch master
git pull --ff-only origin master
git log -3 --oneline
git status --short
```

Report the final status as one of `RESPONSIVE_DEMO_READY`, `RESPONSIVE_DEMO_READY_WITH_WARNINGS`, or `NOT_RESPONSIVE_DEMO_READY`, including real-device iPad testing as a warning when unavailable.
