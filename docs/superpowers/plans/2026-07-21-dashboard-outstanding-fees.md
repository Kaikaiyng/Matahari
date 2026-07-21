# Dashboard Outstanding Fees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the real Fee Record outstanding total on Dashboard and let every current role open Fee Record from that metric card.

**Architecture:** `DashboardController` will reuse `FeeRecordSummaryService` for the requested academic year and return its summed `total_outstanding` as the existing `metrics.outstanding_fees` field. The React Dashboard will format that field, render only that metric as an accessible interactive `StatCard`, and navigate to the existing Fee Record page. The existing `fee_record.view` permission remains in place, with the CEO role added to the current roles that receive it.

**Tech Stack:** Laravel 13, PHP 8.4, PHPUnit, React 19, TypeScript 6, Vitest, Testing Library, CSS.

## Global Constraints

- Use Fee Record charge balances, never legacy invoice balances, for the Dashboard outstanding total.
- Keep the existing Dashboard endpoint and response field; add no endpoint or schema change.
- Use academic year `2026` in the current demo Dashboard request, with current year as the backend default.
- Every current role (`super-admin`, `ceo`, `school-admin`, `finance`) must have `fee_record.view`.
- Other Dashboard metric cards remain non-interactive.
- Preserve unrelated untracked workspace files.

---

### Task 1: Align the Dashboard API and Current Role Permissions

**Files:**
- Modify: `backend/tests/Feature/ApiWorkflowTest.php`
- Modify: `backend/tests/Feature/DemoScenarioSeederTest.php`
- Modify: `backend/app/Http/Controllers/Api/DashboardController.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

**Interfaces:**
- Consumes: `FeeRecordSummaryService::summary(?int $schoolId, array $filters): array`.
- Produces: `GET /api/dashboard/school?...&academic_year=2026` with `metrics.outstanding_fees` sourced from Fee Record rows.

- [ ] **Step 1: Write failing backend tests**

Update the Dashboard workflow test to seed `DemoScenarioSeeder`, calculate the expected sum of 2026 Fee Record charges, and assert the Dashboard response matches it even after legacy invoices exist:

```php
$this->seed(DemoScenarioSeeder::class);
$expectedOutstanding = (float) FeeRecordCharge::query()
    ->where('school_id', $school->id)
    ->where('academic_year', '2026')
    ->sum('outstanding_amount_cached');
$this->assertGreaterThan(0, $expectedOutstanding);

$this->actingAs($admin)
    ->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07&academic_year=2026')
    ->assertOk()
    ->assertJsonPath('metrics.outstanding_fees', $expectedOutstanding);
```

Add a seeded-role assertion:

```php
foreach (['super-admin', 'ceo', 'school-admin', 'finance'] as $roleSlug) {
    $this->assertTrue(
        Role::query()->where('slug', $roleSlug)->firstOrFail()
            ->permissions()->where('slug', 'fee_record.view')->exists(),
    );
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run the two PHPUnit test files with the repository's PHP 8.4 executable and required extensions.

Expected: the Dashboard assertion fails because it returns legacy invoice outstanding, and the role assertion fails because CEO lacks `fee_record.view`.

- [ ] **Step 3: Implement the minimal backend change**

Validate the optional academic year, call the existing service, and replace only the metric source:

```php
public function school(Request $request, FeeRecordSummaryService $feeRecordSummaryService): JsonResponse
{
    $data = $request->validate([
        'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}$/'],
    ]);
    $academicYear = $data['academic_year'] ?? now()->format('Y');
    $feeRecordRows = $feeRecordSummaryService->summary($school->id, [
        'academic_year' => $academicYear,
        'student_status' => 'active',
    ]);

    // metrics.outstanding_fees
    collect($feeRecordRows)->sum('total_outstanding');
}
```

Add `'fee_record.view'` to the CEO permission list in `DatabaseSeeder`.

- [ ] **Step 4: Run the focused backend tests and verify GREEN**

Expected: both files pass with no failures.

- [ ] **Step 5: Commit the backend behavior**

```bash
git add backend/app/Http/Controllers/Api/DashboardController.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/ApiWorkflowTest.php backend/tests/Feature/DemoScenarioSeederTest.php
git commit -m "fix: use fee record outstanding on dashboard"
```

### Task 2: Render and Navigate the Interactive Dashboard Metric

**Files:**
- Modify: `frontend/src/components/AdminUi.test.tsx`
- Modify: `frontend/src/components/AdminUi.tsx`
- Modify: `frontend/src/components/AdminUi.css`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Extends: `StatCardProps` with optional `onClick?: () => void` and `actionLabel?: string`.
- Consumes: `dashboard.metrics.outstanding_fees` and `setActivePage('fee-record')`.

- [ ] **Step 1: Write failing frontend tests**

Add a shared component test that renders an interactive metric and verifies click delivery:

```tsx
const onClick = vi.fn()
render(<StatCard label="Outstanding Fees" value="RM 800" onClick={onClick} actionLabel="Open Fee Record" />)
await user.click(screen.getByRole('button', { name: 'Open Fee Record' }))
expect(onClick).toHaveBeenCalledOnce()
```

Set the Dashboard fixture's `outstanding_fees` to `800`, then verify the integration:

```tsx
expect(await screen.findByText('RM 800')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Open Fee Record' }))
expect(await screen.findByRole('heading', { name: 'Fee Record Summary' })).toBeInTheDocument()
expect(screen.queryByText('View Fee Record')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused frontend tests and verify RED**

Run: `npm.cmd test -- --run src/components/AdminUi.test.tsx src/App.test.tsx`

Expected: TypeScript/test failure because `StatCard` does not accept interaction props and Dashboard still renders `View Fee Record`.

- [ ] **Step 3: Implement the minimal frontend change**

Render a native button only when `onClick` exists, otherwise retain the existing article. Add `.stat-card.interactive` reset, hover, and `:focus-visible` rules. Change the Dashboard metric to:

```tsx
{
  label: 'Outstanding Fees',
  value: canViewFeeRecord ? formatCurrency(dashboard.metrics.outstanding_fees) : 'No access',
  tone: 'warning',
  icon: <AlertTriangle size={20} />,
  onClick: canViewFeeRecord ? () => setActivePage('fee-record') : undefined,
  actionLabel: canViewFeeRecord ? 'Open Fee Record' : undefined,
}
```

Pass the authenticated user into `DashboardPage`, forward interaction props to `StatCard`, and add `academic_year=2026` to the Dashboard request.

- [ ] **Step 4: Run focused frontend tests and verify GREEN**

Expected: both files pass with no warnings.

- [ ] **Step 5: Commit the frontend behavior**

```bash
git add frontend/src/components/AdminUi.test.tsx frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.css frontend/src/App.test.tsx frontend/src/App.tsx
git commit -m "feat: open fee record from dashboard total"
```

### Task 3: Verify and Refresh the Demo

**Files:**
- Runtime update only: existing SQLite permissions and frontend build output.

- [ ] **Step 1: Run complete static and automated verification**

Run frontend lint, production build, all Vitest tests, and all PHPUnit tests. Expected: exit code 0 for each suite.

- [ ] **Step 2: Update the existing demo database safely**

Attach the existing `fee_record.view` permission to the existing CEO role without deleting or recreating operational data, then verify all four role-permission mappings through a read-only query.

- [ ] **Step 3: Verify the live Dashboard**

Use the existing public demo URL, log in as `admin`, verify the Outstanding Fees card shows an `RM` total, activate it, confirm Fee Record opens, and confirm the browser console has no new errors.

- [ ] **Step 4: Record final evidence**

Run `git status --short`, `git log -5 --oneline`, and confirm the existing public tunnel processes remain healthy.
