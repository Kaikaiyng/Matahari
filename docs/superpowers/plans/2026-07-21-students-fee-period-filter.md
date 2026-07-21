# Students Fee Period Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Students fee progress as paid versus total fees and let staff switch the card and student rows between annual and monthly Fee Record totals.

**Architecture:** Extend the existing Fee Record summary endpoint with an optional, validated `billing_month` filter while preserving its response schema. The Students page owns one fee-period selection and uses one summary response for both the aggregate card and per-student table values, preventing the two displays from drifting.

**Tech Stack:** Laravel 12, PHP 8.4, Eloquent, PHPUnit, React 19, TypeScript, Vite, Vitest, Testing Library, existing Admin UI CSS.

## Global Constraints

- Default period is `All Year (2026)` and omits `billing_month` from the request.
- Monthly values use Fee Record charge cells, not invoices or raw payment totals.
- The card copy is exactly `Paid / Total Fees`; values are `total_paid / total_expected`.
- Month selection affects both the card and the student table's `Fee Amount` and `Outstanding` columns.
- The existing response fields and permissions remain unchanged.
- Do not add dependencies or an academic-year picker.
- Reuse the current Students toolbar visual language and mobile stacking behaviour.

---

## File Map

- Modify `backend/app/Http/Controllers/Api/FeeRecordController.php`: validate and pass the optional month filter.
- Modify `backend/app/Services/Billing/FeeRecordSummaryService.php`: scope loaded and qualifying charges to the selected month.
- Modify `backend/tests/Feature/FeeRecordSummaryApiTest.php`: prove monthly aggregation and validation.
- Modify `frontend/src/App.tsx`: own fee-period state, request monthly summaries, render the integrated select, and switch the card to paid/expected.
- Modify `frontend/src/App.test.tsx`: prove annual defaults and synchronized monthly UI values.
- Modify `frontend/src/components/AdminUi.css`: give the period select a stable desktop width while retaining existing mobile rules.

---

### Task 1: Add Optional Billing-Month Filtering to Fee Record Summary

**Files:**
- Modify: `backend/tests/Feature/FeeRecordSummaryApiTest.php`
- Modify: `backend/app/Http/Controllers/Api/FeeRecordController.php`
- Modify: `backend/app/Services/Billing/FeeRecordSummaryService.php`

**Interfaces:**
- Consumes: `GET /api/fee-record/summary?academic_year=YYYY`.
- Produces: the same endpoint with optional `billing_month=YYYY-MM`; the JSON row schema is unchanged.

- [ ] **Step 1: Write failing API tests for a selected month and invalid period combinations**

Add these tests to `FeeRecordSummaryApiTest`:

```php
public function test_summary_filters_charge_totals_by_billing_month(): void
{
    [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
    $student = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');

    $this->charge($school, $student, '2026-01', 'TUITION', 'mandatory', 1000, 400);
    $this->charge($school, $student, '2026-02', 'TRANSPORT', 'optional', 200, 0);

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-01')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.total_expected', 1000)
        ->assertJsonPath('data.0.total_paid', 400)
        ->assertJsonPath('data.0.total_outstanding', 600)
        ->assertJsonPath('data.0.outstanding_months', ['2026-01']);

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-03')
        ->assertOk()
        ->assertJsonCount(0, 'data');
}

public function test_summary_rejects_invalid_or_mismatched_billing_months(): void
{
    [$school, $admin] = $this->schoolAndUser(['fee_record.view']);

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=July')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('billing_month');

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2025-07')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('billing_month');
}

public function test_month_filter_preserves_school_and_student_status_scope(): void
{
    [$school, $admin] = $this->schoolAndUser(['fee_record.view']);
    $active = $this->student($school, 'MIS-2026-001', 'Alyssa Tan');
    $withdrawn = $this->student($school, 'MIS-2026-002', 'Daniel Lim', status: 'withdraw');
    $otherSchool = School::query()->create([
        'code' => 'OTHER',
        'name' => 'Other School',
        'receipt_prefix' => 'OTH',
        'invoice_prefix' => 'OTH-INV',
        'status' => 'active',
    ]);
    $outsideScope = $this->student($otherSchool, 'OTH-2026-001', 'Outside Student');

    $this->charge($school, $active, '2026-07', 'TUITION', 'mandatory', 500, 300);
    $this->charge($school, $withdrawn, '2026-07', 'TUITION', 'mandatory', 600, 0);
    $this->charge($otherSchool, $outsideScope, '2026-07', 'TUITION', 'mandatory', 700, 0);

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-07')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.student_no', 'MIS-2026-001');

    $this->actingAs($admin)
        ->getJson('/api/fee-record/summary?academic_year=2026&billing_month=2026-07&student_status=withdraw')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.student_no', 'MIS-2026-002');
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run from `backend` in PowerShell:

```powershell
$keyLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -like 'APP_KEY=*' } | Select-Object -First 1
$env:APP_KEY = $keyLine.Substring(8)
php artisan test tests/Feature/FeeRecordSummaryApiTest.php
```

Expected: the selected-month total still includes both months and the invalid `billing_month` requests are not rejected.

- [ ] **Step 3: Validate and normalize the optional query parameter**

In `FeeRecordController::summary`, add `billing_month` validation and reject a valid-looking month whose year differs from `academic_year`:

```php
'billing_month' => ['nullable', 'string', 'date_format:Y-m'],
```

After validation:

```php
$academicYear = $data['academic_year'] ?? now()->format('Y');
$billingMonth = $data['billing_month'] ?? null;

if ($billingMonth && ! str_starts_with($billingMonth, $academicYear.'-')) {
    throw ValidationException::withMessages([
        'billing_month' => 'The billing month must belong to the selected academic year.',
    ]);
}
```

Import `Illuminate\Validation\ValidationException`, use `$academicYear` in the filter array, and add:

```php
'billing_month' => $billingMonth,
```

- [ ] **Step 4: Scope the summary charge relation and qualifying students to the selected month**

In `FeeRecordSummaryService::summary`, read the filter:

```php
$billingMonth = $filters['billing_month'] ?? null;
```

Update both charge-query locations so they share the same period rules:

```php
->with(['class', 'feeRecordCharges' => function ($query) use ($academicYear, $billingMonth): void {
    $query->where('academic_year', $academicYear)
        ->when($billingMonth, fn ($monthQuery, string $month) => $monthQuery->where('billing_month', $month))
        ->orderBy('billing_month')
        ->orderBy('fee_record_category')
        ->orderBy('id');
}])
```

```php
->whereHas('feeRecordCharges', function (Builder $query) use ($academicYear, $billingMonth): void {
    $query->where('academic_year', $academicYear)
        ->when($billingMonth, fn (Builder $monthQuery, string $month) => $monthQuery->where('billing_month', $month));
})
```

- [ ] **Step 5: Run the focused backend tests and confirm GREEN**

Run from `backend` in PowerShell:

```powershell
$keyLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -like 'APP_KEY=*' } | Select-Object -First 1
$env:APP_KEY = $keyLine.Substring(8)
php artisan test tests/Feature/FeeRecordSummaryApiTest.php
```

Expected: all `FeeRecordSummaryApiTest` tests pass, including annual totals, monthly totals, empty month, malformed month, and mismatched year.

- [ ] **Step 6: Commit the backend slice**

```powershell
git add backend/app/Http/Controllers/Api/FeeRecordController.php backend/app/Services/Billing/FeeRecordSummaryService.php backend/tests/Feature/FeeRecordSummaryApiTest.php
git diff --cached --check
git commit -m "feat: filter fee record summary by month"
```

---

### Task 2: Add the Integrated Students Fee-Period Filter

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AdminUi.css`

**Interfaces:**
- Consumes: `GET /api/fee-record/summary?academic_year=2026` and its optional `billing_month=2026-MM` parameter from Task 1.
- Produces: an accessible `Fee Period` select whose value is `''` for all year or `YYYY-MM` for one month.

- [ ] **Step 1: Teach the API mock to return distinct annual and July summaries**

Add this fixture after `feeRecordSummary` in `frontend/src/App.test.tsx`:

```tsx
const julyFeeRecordSummary = {
  ...feeRecordSummary,
  total_expected: 500,
  total_paid: 300,
  total_outstanding: 200,
  outstanding_months: ['2026-07'],
}
```

Replace the Fee Record summary mock branch with:

```tsx
if (url.pathname.endsWith('/fee-record/summary')) {
  const billingMonth = url.searchParams.get('billing_month')
  if (billingMonth === '2026-12') return json({ data: [] })
  return json({ data: [billingMonth === '2026-07' ? julyFeeRecordSummary : feeRecordSummary] })
}
```

- [ ] **Step 2: Write the failing Students period test**

Add this test inside `describe('demo shell', ...)`:

```tsx
it('shows annual paid progress by default and synchronizes a selected month with student rows', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Students' }))
  await screen.findByRole('heading', { name: 'Student List' })

  expect(screen.getByLabelText('Fee Period')).toHaveValue('')
  expect(screen.getByText('Paid / Total Fees')).toBeInTheDocument()
  expect(screen.getByText('RM 400 / RM 1,200')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Fee Period'), '2026-07')

  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/fee-record\/summary\?.*billing_month=2026-07/),
      expect.any(Object),
    )
  })
  expect(await screen.findByText('RM 300 / RM 500')).toBeInTheDocument()

  const studentRow = screen.getByText('Alyssa Tan').closest('tr')
  expect(studentRow).not.toBeNull()
  expect(within(studentRow!).getByText('RM 500')).toBeInTheDocument()
  expect(within(studentRow!).getByText('RM 200')).toBeInTheDocument()
})

it('shows zero fee progress and zero student balances for a month without charges', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Students' }))
  await screen.findByRole('heading', { name: 'Student List' })
  await user.selectOptions(screen.getByLabelText('Fee Period'), '2026-12')

  expect(await screen.findByText('RM 0 / RM 0')).toBeInTheDocument()
  const studentRow = screen.getByText('Alyssa Tan').closest('tr')
  expect(studentRow).not.toBeNull()
  expect(within(studentRow!).getAllByText('RM 0')).toHaveLength(2)
})
```

- [ ] **Step 3: Run the focused frontend test and confirm RED**

Run from `frontend`:

```powershell
npm.cmd test -- --run src/App.test.tsx
```

Expected: FAIL because `Fee Period` and `Paid / Total Fees` do not yet exist.

- [ ] **Step 4: Add month labels, state, request parameters, and paid aggregation**

In `frontend/src/App.tsx`, add full month labels near `monthShortLabels`:

```tsx
const monthLongLabels = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
```

Add Students-page state:

```tsx
const [studentFeePeriod, setStudentFeePeriod] = useState('')
```

Change the summary loader signature and clear stale rows before requesting:

```tsx
const loadStudentListFeeRecordSummary = async (
  academicYear = feeRecordAcademicYear,
  billingMonth = studentFeePeriod,
) => {
  if (!canViewFeeRecord) {
    setStudentListFeeRecordSummaries([])
    setStudentListFeeRecordSummaryYear('')
    return
  }

  setIsLoadingStudentListFeeRecordSummary(true)
  setStudentListFeeRecordSummaries([])

  try {
    const params = new URLSearchParams({ academic_year: academicYear })
    if (billingMonth) params.set('billing_month', billingMonth)
    const response = await apiRequest<{ data: FeeRecordSummaryRow[] }>(`/fee-record/summary?${params.toString()}`)
    setStudentListFeeRecordSummaries(response.data)
    setStudentListFeeRecordSummaryYear(academicYear)
  } catch (summaryError) {
    setStudentListFeeRecordSummaries([])
    setStudentListFeeRecordSummaryYear('')
    handleApiError(summaryError)
  } finally {
    setIsLoadingStudentListFeeRecordSummary(false)
  }
}
```

Pass `studentFeePeriod` when `loadStudents` refreshes its summary:

```tsx
await loadStudentListFeeRecordSummary(feeRecordAcademicYear, studentFeePeriod)
```

Add `totalPaid` to `studentListFeeTotals`:

```tsx
totalPaid: totals.totalPaid + (summary?.total_paid ?? 0),
```

and initialize the reducer with:

```tsx
{ totalExpected: 0, totalPaid: 0, totalOutstanding: 0 }
```

- [ ] **Step 5: Render the integrated select and correct the card semantics**

Replace the card label/value with:

```tsx
<StatCard
  label="Paid / Total Fees"
  value={
    !canViewFeeRecord
      ? 'No access'
      : isLoadingStudentListFeeRecordSummary
        ? 'Loading...'
        : `${formatCurrency(studentListFeeTotals.totalPaid)} / ${formatCurrency(
            studentListFeeTotals.totalExpected,
          )}`
  }
/>
```

Insert this select after Student Status and before Refresh:

```tsx
<select
  className="fee-period-select"
  aria-label="Fee Period"
  value={studentFeePeriod}
  onChange={(event) => {
    const nextPeriod = event.target.value
    setStudentFeePeriod(nextPeriod)
    void loadStudentListFeeRecordSummary(feeRecordAcademicYear, nextPeriod)
  }}
>
  <option value="">All Year ({feeRecordAcademicYear})</option>
  {monthLongLabels.map((month, index) => {
    const monthNumber = String(index + 1).padStart(2, '0')
    return (
      <option key={month} value={`${feeRecordAcademicYear}-${monthNumber}`}>
        {month} {feeRecordAcademicYear}
      </option>
    )
  })}
</select>
```

The table needs no separate calculation change: its existing `summary?.total_expected` and `summary?.total_outstanding` cells will use the same filtered response map.

- [ ] **Step 6: Add the minimal desktop sizing rule**

In `frontend/src/components/AdminUi.css`, beside the filter-toolbar control styles, add:

```css
.fee-period-select {
  min-width: 176px;
}
```

Do not add a mobile override; the existing `.filter-toolbar > * { width: 100%; min-width: 0; }` rule already makes the select responsive.

- [ ] **Step 7: Run focused frontend tests and confirm GREEN**

```powershell
npm.cmd test -- --run src/App.test.tsx src/components/AdminUi.test.tsx
```

Expected: both files pass; the new test proves annual default values, correct paid/total order, API month parameter, and synchronized row values.

- [ ] **Step 8: Commit the frontend slice**

```powershell
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/components/AdminUi.css
git diff --cached --check
git commit -m "feat: filter student fee progress by month"
```

---

### Task 3: Full Verification and Demo Refresh

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Consumes: the backend filter and frontend Students UI from Tasks 1 and 2.
- Produces: a verified production build served by the existing public demo URL.

- [ ] **Step 1: Run all frontend quality gates**

From `frontend`, run:

```powershell
npm.cmd run lint
npm.cmd test -- --run
npm.cmd run build
```

Expected: lint exits 0, all Vitest files pass, and Vite creates `dist` successfully.

- [ ] **Step 2: Run the complete backend suite**

From `backend`, run:

```powershell
$keyLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -like 'APP_KEY=*' } | Select-Object -First 1
$env:APP_KEY = $keyLine.Substring(8)
php artisan test
```

Expected: all PHPUnit tests pass with zero failures.

- [ ] **Step 3: Rebuild the public-demo bundle with its API base URL**

From `frontend`, run:

```powershell
$env:VITE_API_BASE_URL = '/api'
$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:8002'
npm.cmd run build
```

Expected: production build exits 0 and the existing Vite preview begins serving the new asset hash without changing the tunnel URL.

- [ ] **Step 4: Verify the public API's annual and monthly responses**

Use one authenticated web session against the URL in `.demo-public/state.json`. Request:

```text
/api/fee-record/summary?academic_year=2026
/api/fee-record/summary?academic_year=2026&billing_month=2026-07
```

Expected: both return HTTP 200, July totals differ from annual totals where the demo has charges, and every monthly row contains only July-derived expected, paid, and outstanding values.

- [ ] **Step 5: Verify the live Students interaction**

Log in, open Students, and confirm:

```text
Default select: All Year (2026)
Card label: Paid / Total Fees
Annual card: paid total on left, expected total on right
July select: card and each Student List fee row update together
Mobile/narrow layout: Fee Period occupies the available toolbar width
```

- [ ] **Step 6: Review the final diff and repository state**

```powershell
git diff --check
git status --short
git log --oneline -5
```

Expected: no uncommitted feature files, no whitespace errors, and unrelated pre-existing untracked files remain untouched.
