# White-Label Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all school-specific runtime branding with a neutral School Admin System demo while preserving business behavior and making receipts unmistakably non-valid samples.

**Architecture:** Centralize presentation identity in a typed frontend brand configuration and one reusable Lucide-based mark. Keep tenant identity in backend seed data, change only safe receipt fallbacks, and avoid any migration that could rewrite historical finance data. Separate primary blue tokens from semantic danger colors so branding can change later without weakening destructive-state cues.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Lucide React, CSS, Vitest/Testing Library, Laravel 13, PHP 8.4, PHPUnit 12, SQLite demo seed.

## Global Constraints

- Product name: `School Admin System`.
- Fictional tenant: `Demo International School`; school code and receipt prefix: `DEMO`.
- Primary colors: `#2563EB` and `#1D4ED8`; sidebar: `#172033`; canvas: `#F4F7FB`; text: `#172033`; muted text: `#64748B`.
- Receipt notice: `SAMPLE — NOT A VALID RECEIPT` on screen and in print.
- Use the existing Lucide package; add no branding or icon dependency.
- Preserve roles, permissions, school scope, CSRF, audit, financial workflows, receipt sequencing, and historical records.
- Do not add a migration that renames schools or receipt numbers.
- Red is permitted only for semantic error, overdue, void, and destructive states; it cannot remain a general brand accent.
- Historical/internal project records may retain Matahari references; runtime, seed, active demo guidance, and generated assets may not.

---

## File Map

**Create**

- `frontend/src/branding.ts`: immutable presentation identity and copy.
- `frontend/src/components/BrandMark.tsx`: reusable accessible generic mark.
- `frontend/src/components/BrandMark.css`: mark sizing and blue-square treatment.
- `frontend/src/components/BrandMark.test.tsx`: brand contract and accessibility test.
- `frontend/src/brandingContract.test.ts`: source-level guard against reintroducing prohibited runtime branding.

**Modify**

- `frontend/src/App.tsx`: login, receipt, loader, and application-shell identity.
- `frontend/src/App.test.tsx`: login, shell, and sample-receipt acceptance.
- `frontend/src/App.css`: login/receipt styling, blue interactions, semantic danger colors, and print disclaimer.
- `frontend/src/index.css`: root palette and focus ring.
- `frontend/src/components/AdminShell.tsx`: consume `BrandMark` and remove image prop.
- `frontend/src/components/AdminShell.test.tsx`: neutral identity and prop contract.
- `frontend/src/components/AdminShell.css`: generic mark and blue active/navigation state.
- `frontend/src/components/AdminUi.tsx`: self-contained neutral session loader.
- `frontend/src/components/AdminUi.test.tsx`: session-loader identity.
- `frontend/src/components/AdminUi.css`: blue shared controls; danger variables remain red.
- `frontend/src/components/CalendarPage.css`: primary-token rename and blue selection/focus states.
- `frontend/src/features/fee-agreements/FeeAgreementEditor.css`: primary-token rename and semantic error separation.
- `frontend/index.html`: product title and favicon metadata.
- `frontend/public/favicon.svg`: replace the scaffold icon with a neutral school-building favicon.
- `backend/database/seeders/DatabaseSeeder.php`: fictional school, users, prefixes, email, address, and student numbers.
- `backend/database/seeders/DemoScenarioSeeder.php`: `DEMO` tenant/student lookups.
- `backend/app/Services/Billing/ReceiptGenerationService.php`: neutral last-resort prefix.
- Seed-dependent backend tests listed in Task 4.
- `frontend/package-lock.json`: patched transitive `undici` resolution.
- `frontend/README.md`, `docs/DEMO_REVIEW_SCRIPT.md`, `docs/current-status.md`, and `README.md`: active white-label guidance and current status.

**Delete**

- `frontend/src/assets/mis-logo.jpg`: school-owned runtime asset.

---

### Task 1: Central Brand Configuration and Generic Mark

**Files:**
- Create: `frontend/src/branding.ts`
- Create: `frontend/src/components/BrandMark.tsx`
- Create: `frontend/src/components/BrandMark.css`
- Test: `frontend/src/components/BrandMark.test.tsx`

**Interfaces:**
- Produces: `productBrand` with readonly `productName`, `productShortName`, `productDescriptor`, `demoOrganizationName`, `logoLabel`, and `receiptDisclaimer` strings.
- Produces: `BrandMark({ className?, size? }: { className?: string; size?: number })`.
- Consumes: the existing `School` icon from `lucide-react`.

- [ ] **Step 1: Write the failing brand test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'

describe('neutral product brand', () => {
  it('exposes the approved demo identity', () => {
    expect(productBrand).toMatchObject({
      productName: 'School Admin System',
      demoOrganizationName: 'Demo International School',
      receiptDisclaimer: 'SAMPLE — NOT A VALID RECEIPT',
    })
  })

  it('renders an accessible generic mark without a school image', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: 'School Admin System logo' })).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and verify the missing modules fail**

Run: `cd frontend; npm.cmd test -- src/components/BrandMark.test.tsx`

Expected: FAIL because `../branding` and `./BrandMark` do not exist.

- [ ] **Step 3: Add the immutable brand configuration**

```ts
export const productBrand = {
  productName: 'School Admin System',
  productShortName: 'School Admin',
  productDescriptor: 'System',
  demoOrganizationName: 'Demo International School',
  logoLabel: 'School Admin System logo',
  receiptDisclaimer: 'SAMPLE — NOT A VALID RECEIPT',
} as const
```

- [ ] **Step 4: Implement the generic mark**

```tsx
import { School } from 'lucide-react'
import { productBrand } from '../branding'
import './BrandMark.css'

export function BrandMark({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={`brand-mark ${className}`.trim()} role="img" aria-label={productBrand.logoLabel}>
      <School size={size} aria-hidden="true" />
    </span>
  )
}
```

Use `.brand-mark` as an inline grid with a `#2563EB` background, white icon, 10px radius, and no image/object-fit behavior.

- [ ] **Step 5: Run the focused test**

Run: `cd frontend; npm.cmd test -- src/components/BrandMark.test.tsx`

Expected: 2 tests pass.

- [ ] **Step 6: Commit the brand primitive**

```powershell
git add frontend/src/branding.ts frontend/src/components/BrandMark.tsx frontend/src/components/BrandMark.css frontend/src/components/BrandMark.test.tsx
git commit -m "feat: add neutral product brand primitives"
```

---

### Task 2: Replace Runtime Identity and Mark Receipts as Samples

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/components/AdminShell.tsx`
- Modify: `frontend/src/components/AdminShell.test.tsx`
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/components/AdminUi.tsx`
- Modify: `frontend/src/components/AdminUi.test.tsx`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/index.html`
- Replace: `frontend/public/favicon.svg`
- Delete: `frontend/src/assets/mis-logo.jpg`

**Interfaces:**
- Consumes: `productBrand` and `BrandMark` from Task 1.
- Changes: `AdminShellProps` removes `brandLogo: string`.
- Changes: `SessionLoader` becomes a zero-prop component.
- Preserves: all page selection, authentication, payment, receipt, print, and permission behavior.

- [ ] **Step 1: Update tests to require the neutral runtime identity**

In `AdminShell.test.tsx`, remove every `brandLogo` prop, change context fixtures to `Demo International School`, and add:

```tsx
expect(screen.getByRole('img', { name: 'School Admin System logo' })).toBeInTheDocument()
expect(screen.getByText('School Admin')).toBeInTheDocument()
expect(screen.getByText('System')).toBeInTheDocument()
```

In `AdminUi.test.tsx`, render `<SessionLoader />` and assert the generic mark. In the login test in `App.test.tsx`, assert `School Admin System` and the accessible generic mark. Add this receipt-view test using the existing API fixtures:

```tsx
it('marks the displayed receipt as a fictional sample', async () => {
  const user = userEvent.setup()
  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'View' }))

  expect(screen.getByRole('heading', { name: 'Demo International School' })).toBeInTheDocument()
  expect(screen.getByRole('note')).toHaveTextContent('SAMPLE — NOT A VALID RECEIPT')
})
```

- [ ] **Step 2: Run the three focused test files and verify failure**

Run:

```powershell
cd frontend
npm.cmd test -- src/App.test.tsx src/components/AdminShell.test.tsx src/components/AdminUi.test.tsx
```

Expected: FAIL because the components still render Matahari/MIS image identity and no receipt disclaimer.

- [ ] **Step 3: Integrate the brand into shell and session components**

Replace the `brandLogo` image block in `AdminShell.tsx` with:

```tsx
<BrandMark className="admin-brand-mark" size={27} />
<div>
  <strong>{productBrand.productShortName}</strong>
  <span>{productBrand.productDescriptor}</span>
</div>
```

Remove `brandLogo` from `AdminShellProps`. Replace `SessionLoader({ logoSrc, brand })` with a zero-prop component that renders `BrandMark` and `productBrand.productName`.

- [ ] **Step 4: Replace App identity surfaces**

Remove the `misLogo` import. In `LoginScreen`, render `BrandMark` and `productBrand.productName`. Render `<SessionLoader />` during session checking and remove `brandLogo` from `<AdminShell>`.

Replace the receipt header with:

```tsx
<div className="receipt-brand">
  <BrandMark className="receipt-brand-mark" size={34} />
  <div>
    <p className="eyebrow">Sample Receipt</p>
    <h2>{productBrand.demoOrganizationName}</h2>
    <span>Payment made is not refundable.</span>
  </div>
</div>
<p className="receipt-demo-notice" role="note">
  {productBrand.receiptDisclaimer}
</p>
```

Change the two static parent addresses from `Matahari family contact` to `Fictional demo contact`.

- [ ] **Step 5: Update identity-specific layout CSS**

Replace image selectors such as `.admin-brand img`, `.session-card img`, and `.receipt-brand img` with mark-specific selectors. Style `.receipt-demo-notice` with a high-contrast dashed border, uppercase text, and `break-inside: avoid`; do not hide it in `@media print`.

- [ ] **Step 6: Replace title/favicon and remove the asset**

Set `<title>School Admin System</title>` in `frontend/index.html`. Replace `frontend/public/favicon.svg` with a simple blue square containing a white school-building glyph. Delete `frontend/src/assets/mis-logo.jpg` through the patch.

- [ ] **Step 7: Run focused tests and build**

Run:

```powershell
cd frontend
npm.cmd test -- src/App.test.tsx src/components/AdminShell.test.tsx src/components/AdminUi.test.tsx
npm.cmd run build
```

Expected: focused tests pass and the built asset list contains no `mis-logo` file.

- [ ] **Step 8: Commit runtime white-labelling**

```powershell
git add frontend/index.html frontend/public/favicon.svg frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/App.css frontend/src/components/AdminShell.tsx frontend/src/components/AdminShell.test.tsx frontend/src/components/AdminShell.css frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.test.tsx frontend/src/components/AdminUi.css frontend/src/assets/mis-logo.jpg
git commit -m "feat: white-label runtime identity and receipts"
```

---

### Task 3: Replace Matahari Brand Colors and Add a Regression Guard

**Files:**
- Create: `frontend/src/brandingContract.test.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/components/AdminShell.css`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/components/CalendarPage.css`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`

**Interfaces:**
- Produces CSS variables `--brand-primary`, `--brand-primary-dark`, `--brand-primary-soft`, `--danger`, `--danger-dark`, and `--danger-soft`.
- Removes runtime tokens `--brand-red` and `--brand-red-dark`.
- Preserves component class names and responsive breakpoints.

- [ ] **Step 1: Add a failing source-level brand contract**

Create a Vitest test that recursively reads `.ts`, `.tsx`, `.css`, `.html`, and `.svg` runtime files under `frontend/src`, plus `frontend/index.html` and `frontend/public/favicon.svg`. Exclude files containing `.test.`. Assert that the concatenated runtime source does not match:

```ts
const prohibited = [
  /Matahari/i,
  /MIS logo/i,
  /mis-logo/i,
  /--brand-red/i,
  /#(?:ee2f37|d82730|b31923)/i,
]
```

The failure message must include the relative file and matched token without printing binary content.

- [ ] **Step 2: Run the contract and verify current CSS failures**

Run: `cd frontend; npm.cmd test -- src/brandingContract.test.ts`

Expected: FAIL on the old red tokens/values and any remaining runtime school branding.

- [ ] **Step 3: Define the new root palette**

Use this exact token block in `frontend/src/index.css`:

```css
:root {
  --brand-primary: #2563eb;
  --brand-primary-dark: #1d4ed8;
  --brand-primary-soft: #eff6ff;
  --danger: #b42318;
  --danger-dark: #7a271a;
  --danger-soft: #fef3f2;
  --sidebar: #172033;
  --canvas: #f4f7fb;
  --surface: #ffffff;
  --text: #172033;
  --muted: #64748b;
  --border: #dfe5ee;
  --border-strong: #cbd5e1;
}
```

Use `var(--brand-primary-dark)` for the global focus ring.

- [ ] **Step 4: Convert interactive colors to blue**

Across the listed CSS files:

- primary buttons, links, selected navigation, focus rings, progress bars, checkboxes, and neutral icons use `--brand-primary`/`--brand-primary-dark`;
- selected backgrounds use `--brand-primary-soft`, `rgb(37 99 235 / 14%)`, or `rgb(37 99 235 / 24%)` for the existing active-state background and border strengths;
- primary-button shadow uses `rgb(37 99 235 / 24%)`;
- sidebar remains `#172033`.

Do not mechanically convert semantic errors or destructive actions to blue.

- [ ] **Step 5: Convert semantic danger colors to dedicated tokens**

Use `--danger`, `--danger-dark`, and `--danger-soft` for validation messages, danger modals, void buttons, overdue values, and destructive focus states. Replace every exact legacy red hex even when semantic so the original school palette is absent.

- [ ] **Step 6: Run contract, component tests, lint, and build**

Run:

```powershell
cd frontend
npm.cmd test -- src/brandingContract.test.ts src/components/AdminShell.test.tsx src/components/AdminUi.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0 and no legacy brand token/value is reported.

- [ ] **Step 7: Commit the neutral palette**

```powershell
git add frontend/src/brandingContract.test.ts frontend/src/index.css frontend/src/App.css frontend/src/components/AdminShell.css frontend/src/components/AdminUi.css frontend/src/components/CalendarPage.css frontend/src/features/fee-agreements/FeeAgreementEditor.css
git commit -m "style: replace school red with neutral blue palette"
```

---

### Task 4: White-Label Demo Seed and Receipt Prefix

**Files:**
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/database/seeders/DemoScenarioSeeder.php`
- Modify: `backend/app/Services/Billing/ReceiptGenerationService.php`
- Modify: `backend/tests/Feature/ApiWorkflowTest.php`
- Modify: `backend/tests/Feature/AuthApiTest.php`
- Modify: `backend/tests/Feature/BillingWorkflowTest.php`
- Modify: `backend/tests/Feature/DemoScenarioSeederTest.php`
- Modify: `backend/tests/Feature/Audit/BusinessAuditIntegrationTest.php`

**Interfaces:**
- Produces seeded school code/prefix `DEMO`, invoice prefix `DEMO-INV`, and student numbers `DEMO-2026-001` through `DEMO-2026-004`.
- Keeps the receipt format `%s.%s%04d (%s)` and series `A` unchanged.
- Changes only the last-resort receipt prefix from `MIS` to `DEMO`.

- [ ] **Step 1: Change seed-dependent expectations first**

In the listed tests, replace seeded lookups/expectations only:

```text
MIS                     -> DEMO
MIS-INV                 -> DEMO-INV
MIS-2026-001..004       -> DEMO-2026-001..004
MIS.A0001 / MIS.A0002   -> DEMO.A0001 / DEMO.A0002
Matahari International School -> Demo International School
```

Do not rename independent per-test `MIS` fixtures that intentionally prove arbitrary tenant codes work.

- [ ] **Step 2: Run seed-dependent tests and verify failure**

Run:

```powershell
cd backend
$env:PHPRC = (Resolve-Path ..\tools\php).Path
php artisan test --no-ansi tests/Feature/ApiWorkflowTest.php tests/Feature/AuthApiTest.php tests/Feature/BillingWorkflowTest.php tests/Feature/DemoScenarioSeederTest.php tests/Feature/Audit/BusinessAuditIntegrationTest.php
```

Expected: FAIL because the seed still creates the `MIS` tenant and receipt numbers.

- [ ] **Step 3: Update DatabaseSeeder values**

Use:

```php
['code' => 'DEMO'],
[
    'name' => 'Demo International School',
    'receipt_prefix' => 'DEMO',
    'invoice_prefix' => 'DEMO-INV',
    'email' => 'admin@demo-school.test',
    'phone' => '+60 3-0000 0000',
    'address' => 'Fictional demo school, Malaysia',
    'status' => 'active',
]
```

Rename seeded user display names to `Demo Super Admin`, `Demo School Admin`, and `Demo Finance Admin`. Rename the four seeded student numbers and their equality checks to `DEMO-2026-*`.

- [ ] **Step 4: Update demo-scenario lookups and receipt fallback**

Change `DemoScenarioSeeder` to find school `DEMO` and students `DEMO-2026-001` through `004`. In `ReceiptGenerationService`, use:

```php
$prefix = $payment->school?->receipt_prefix ?: $payment->school?->code ?: 'DEMO';
```

- [ ] **Step 5: Run focused tests and formatting**

Run:

```powershell
cd backend
php artisan test --no-ansi tests/Feature/ApiWorkflowTest.php tests/Feature/AuthApiTest.php tests/Feature/BillingWorkflowTest.php tests/Feature/DemoScenarioSeederTest.php tests/Feature/Audit/BusinessAuditIntegrationTest.php
php vendor/bin/pint --test
```

Expected: all focused tests and Pint pass.

- [ ] **Step 6: Validate a disposable fresh demo database**

Create an explicit temporary SQLite file, set `DB_CONNECTION=sqlite` and `DB_DATABASE` to that exact path, and run:

```powershell
$demoCheck = Join-Path $env:TEMP ('school-admin-white-label-' + [guid]::NewGuid().ToString('N') + '.sqlite')
New-Item -ItemType File -Path $demoCheck | Out-Null
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $demoCheck
php artisan config:clear
php artisan migrate:fresh --seed --force --no-ansi
php -r '$pdo = new PDO("sqlite:".getenv("DB_DATABASE")); $school = $pdo->query("SELECT code, name, receipt_prefix FROM schools WHERE code = ''DEMO''")->fetch(PDO::FETCH_ASSOC); $receipt = $pdo->query("SELECT receipt_no FROM receipts ORDER BY id LIMIT 1")->fetchColumn(); if ($school !== ["code" => "DEMO", "name" => "Demo International School", "receipt_prefix" => "DEMO"] || !str_starts_with((string) $receipt, "DEMO.A")) { fwrite(STDERR, "Unexpected white-label seed data\n"); exit(1); }'
Remove-Item -LiteralPath $demoCheck
```

Expected: every command exits 0. Validate the exact temporary path before removal and clear the process environment afterward.

- [ ] **Step 7: Commit demo data changes**

```powershell
git add backend/database/seeders/DatabaseSeeder.php backend/database/seeders/DemoScenarioSeeder.php backend/app/Services/Billing/ReceiptGenerationService.php backend/tests/Feature/ApiWorkflowTest.php backend/tests/Feature/AuthApiTest.php backend/tests/Feature/BillingWorkflowTest.php backend/tests/Feature/DemoScenarioSeederTest.php backend/tests/Feature/Audit/BusinessAuditIntegrationTest.php
git commit -m "chore: replace school-specific demo data"
```

---

### Task 5: Clear the New Undici Advisory

**Files:**
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Keeps direct package manifest versions unchanged.
- Updates transitive `undici` used by `jsdom` from `7.28.0` to the patched compatible `7.29.0` or newer version selected by npm within the existing range.

- [ ] **Step 1: Record the failing audit and dependency owner**

Run:

```powershell
cd frontend
npm.cmd ls undici --all
npm.cmd audit --audit-level=moderate
```

Expected before the fix: `jsdom@29.1.1 -> undici@7.28.0` and one high-severity advisory.

- [ ] **Step 2: Apply the smallest compatible audit fix**

Run: `npm.cmd audit fix`

Expected lockfile change: only the transitive `undici` resolution/integrity entry, plus unavoidable npm lock normalization if shown by the installed npm version. Do not use `--force`.

- [ ] **Step 3: Review the dependency diff**

Run: `git diff -- frontend/package.json frontend/package-lock.json`

Expected: `frontend/package.json` unchanged; no direct major-version update.

- [ ] **Step 4: Prove the lockfile and frontend remain valid**

Run:

```powershell
npm.cmd ci
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd audit --audit-level=moderate
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: both audits report 0 vulnerabilities; 143 or more tests pass; lint and build exit 0.

- [ ] **Step 5: Commit the patched lockfile**

```powershell
git add frontend/package-lock.json
git commit -m "chore: update vulnerable undici dependency"
```

---

### Task 6: Update Active Documentation and Complete Release Validation

**Files:**
- Modify: `README.md`
- Modify: `frontend/README.md`
- Modify: `docs/DEMO_REVIEW_SCRIPT.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md` only if a new command or caveat is introduced during implementation.

**Interfaces:**
- Documents the distinction between the internal Matahari repository history and the neutral external demo identity.
- Documents that existing disposable demo databases need an intentional reset; no automatic historical rewrite occurs.

- [ ] **Step 1: Update presenter-facing copy**

Use this opening in `docs/DEMO_REVIEW_SCRIPT.md`:

```text
This is an independent School Admin System workflow prototype.

The demo uses a fictional school, fictional users, and sample financial records. It is
not affiliated with or endorsed by any school, and printed receipts are not valid receipts.
```

Rename the frontend README heading to `School Admin System Frontend` and describe it as a neutral administration/finance demo. Update root/current-status documentation to explain that the runtime is white-labelled while the repository retains internal project history.

- [ ] **Step 2: Document safe reset behavior**

State explicitly that `tools\php\reset-demo-sqlite.cmd` destroys only the ignored disposable SQLite demo database, then reseeds `Demo International School` and `DEMO` identifiers. Warn that existing receipt identifiers are never rewritten automatically.

- [ ] **Step 3: Run complete backend validation**

Run:

```powershell
cd backend
$env:PHPRC = (Resolve-Path ..\tools\php).Path
php artisan test --no-ansi
php vendor/bin/pint --test
php artisan route:list --path=api --except-vendor
php artisan about --only=environment,drivers
```

Expected baseline: 218 discovered, 210 passed, 8 MariaDB-only skipped, 1,129 or more assertions; Pint and route/config loading exit 0.

- [ ] **Step 4: Run complete frontend validation**

Run:

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd audit --audit-level=moderate
```

Expected: all tests, lint, and build pass; both audits report 0 vulnerabilities; build output contains no school-logo asset.

- [ ] **Step 5: Run runtime/demo brand scans**

Run case-insensitive searches over `frontend/src`, `frontend/index.html`, `frontend/public`, `backend/database/seeders`, `backend/app/Services/Billing/ReceiptGenerationService.php`, `docs/DEMO_REVIEW_SCRIPT.md`, and `frontend/README.md` for the prohibited names, prefixes, token names, and legacy red hex values from the design spec.

Expected: zero unexplained matches. Test fixtures and explicitly historical/internal documents are outside this acceptance scan.

- [ ] **Step 6: Perform local visual smoke tests**

Start the backend and frontend against a freshly reset disposable demo database:

```powershell
tools\php\reset-demo-sqlite.cmd
tools\php\serve-demo-backend.cmd
```

In a second terminal:

```powershell
cd frontend
npm.cmd run dev -- --host 127.0.0.1
```

Open the printed Vite URL. Check login, loading, sidebar, dashboard, Student Detail, Calendar, Audit Trail, receipt view, and browser print preview at `1440x900`, `1180x820`, `820x1180`, and `390x844`. Confirm the sample receipt notice remains visible in print preview and no `MIS`/Matahari branding appears. Stop only the exact server processes started for this check.

- [ ] **Step 7: Validate documentation and Git cleanliness**

Check relative Markdown links, balanced fences, Mermaid blocks touched by the change, diff whitespace, staged secret patterns, generated artifacts, and exact staged paths. Confirm the main worktree's unrelated `.codex-bin/`, `backend/database/on`, and `frontend/test-results/` files remain untouched.

- [ ] **Step 8: Commit documentation**

```powershell
git add README.md frontend/README.md docs/DEMO_REVIEW_SCRIPT.md docs/current-status.md docs/testing-and-release.md
git commit -m "docs: explain neutral white-label demo"
```

- [ ] **Step 9: Review, push, and merge through a pull request**

Fetch `origin/master`, confirm it remains an ancestor, review the complete diff, push `codex/white-label-demo`, create a non-draft PR with exact validation results and limitations, and merge only when GitHub reports the branch clean/mergeable and no required check or review is missing. Delete the remote feature branch after verified merge and verify the final remote `master` contains the branch head.
