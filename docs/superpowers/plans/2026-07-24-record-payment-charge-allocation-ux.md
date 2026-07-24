# Record Payment Charge Allocation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Record Payment guide users toward real outstanding fees, allow a missing one-time charge to be created and selected in place, and demote unclassified payments to a guarded advanced option.

**Architecture:** Keep API requests and modal lifecycle state in `App.tsx`, move payment-allocation types and pure draft helpers into a small model module, and render the outstanding/selected/advanced allocation workflow through a focused `PaymentAllocationEditor` component. Reuse the existing manual Fee Record charge endpoint; after the server creates a charge, convert the returned charge to a normal charge allocation and refresh the outstanding list.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, existing Laravel Fee Record API, existing CSS design system.

## Global Constraints

- Keep the implementation desktop-first with responsive fallback.
- Do not add a Uniform catalogue, Uniform variants, CCA catalogue, stock, enrolment, schedules, or pricing rules.
- Keep Uniform, CCA, Books, and other first-version one-time charges generic through existing category, description, amount, and remark fields.
- Do not change payment verification, receipt behavior, Fee Agreement behavior, backend schema, or API allocation values.
- Use `One-time charge`, `Outstanding fees`, `Payment allocation`, and `Unclassified payment` in user-facing copy.
- Keep internal API values `charge` and `manual` unchanged.
- Do not present a one-time charge as selected until the server confirms creation.
- Only users with `fee_record.manage` may see or use the inline one-time-charge action.
- Only one incomplete unclassified allocation may exist at a time.

---

## File Structure

- Create `frontend/src/features/payments/paymentAllocationModel.ts` for payment allocation and one-time-charge draft types plus pure conversion/guard helpers.
- Create `frontend/src/features/payments/paymentAllocationModel.test.ts` for deterministic helper tests.
- Create `frontend/src/features/payments/PaymentAllocationEditor.tsx` for the complete outstanding-fee, selected-allocation, one-time-charge, and advanced-option UI.
- Create `frontend/src/features/payments/PaymentAllocationEditor.test.tsx` for component interaction and copy tests.
- Modify `frontend/src/App.tsx` to own API state, create one-time charges, automatically select successful charges, and wire the editor.
- Modify `frontend/src/App.test.tsx` to test the real Record Payment integration and request payload.
- Modify `frontend/src/App.css` for compact desktop allocation rows, inline one-time-charge layout, advanced disclosure, and narrow-screen stacking.
- No backend files change.

---

### Task 1: Payment allocation model and guardrails

**Files:**
- Create: `frontend/src/features/payments/paymentAllocationModel.ts`
- Create: `frontend/src/features/payments/paymentAllocationModel.test.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Existing Fee Record charge fields returned by `/students/{student}/fee-record/outstanding` and `/manual-charges`.
- Produces:
  - `OutstandingChargeCell`
  - `PaymentAllocationDraft`
  - `OneTimeChargeDraft`
  - `FeeRecordCategory`
  - `feeRecordCategoryOptions`
  - `createChargeAllocation(charge: OutstandingChargeCell): PaymentAllocationDraft`
  - `createUnclassifiedAllocation(): PaymentAllocationDraft`
  - `createOneTimeChargeDraft(academicYear: string, monthNumber?: number): OneTimeChargeDraft`
  - `hasIncompleteUnclassifiedAllocation(allocations: PaymentAllocationDraft[]): boolean`

- [ ] **Step 1: Write failing model tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  createChargeAllocation,
  createOneTimeChargeDraft,
  createUnclassifiedAllocation,
  hasIncompleteUnclassifiedAllocation,
  type OutstandingChargeCell,
} from './paymentAllocationModel'

const uniformCharge: OutstandingChargeCell = {
  id: 41,
  student_id: 1,
  fee_agreement_id: 20,
  fee_agreement_item_id: null,
  fee_item_id: null,
  academic_year: '2026',
  billing_month: '2026-07',
  fee_record_category: 'OTHERS',
  fee_code: null,
  description: 'Uniform – Sports T-shirt',
  expected_amount: 80,
  paid_amount: 0,
  outstanding_amount: 80,
  billing_status: 'billable',
  collection_status: 'unpaid',
  charge_origin: 'manual',
  source_type: 'manual_charge',
}

describe('payment allocation model', () => {
  it('converts a Fee Record charge into a selected charge allocation', () => {
    expect(createChargeAllocation(uniformCharge)).toMatchObject({
      allocation_type: 'charge',
      fee_record_charge_id: 41,
      billing_month: '2026-07',
      fee_record_category: 'OTHERS',
      description: 'Uniform – Sports T-shirt',
      amount: '80',
    })
  })

  it('creates a one-time charge draft inside the selected year', () => {
    expect(createOneTimeChargeDraft('2027', 3)).toEqual({
      academic_year: '2027',
      billing_month: '2027-03',
      fee_record_category: 'OTHERS',
      description: '',
      expected_amount: '',
      remark: '',
    })
  })

  it('detects an incomplete unclassified allocation', () => {
    const allocation = createUnclassifiedAllocation()
    expect(hasIncompleteUnclassifiedAllocation([allocation])).toBe(true)
    expect(
      hasIncompleteUnclassifiedAllocation([{ ...allocation, description: 'Legacy receipt', amount: '25' }]),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the model test and verify it fails**

Run:

```powershell
Set-Location frontend
npx vitest run src/features/payments/paymentAllocationModel.test.ts
```

Expected: FAIL because `paymentAllocationModel.ts` does not exist.

- [ ] **Step 3: Implement the model**

Move the existing `FeeRecordCategory`, `OutstandingChargeCell`, and `PaymentAllocationDraft` shapes from `App.tsx`, rename `ManualFeeRecordChargeForm` to `OneTimeChargeDraft`, move the current category options into the exported `feeRecordCategoryOptions` array, and implement:

```ts
let nextDraftId = 0

function draftKey() {
  nextDraftId += 1
  return `payment-allocation-${nextDraftId}`
}

export function createChargeAllocation(charge: OutstandingChargeCell): PaymentAllocationDraft {
  return {
    key: draftKey(),
    allocation_type: 'charge',
    fee_record_charge_id: charge.id,
    fee_item_id: charge.fee_item_id,
    fee_agreement_item_id: charge.fee_agreement_item_id,
    fee_code: charge.fee_code,
    billing_month: charge.billing_month,
    fee_record_category: charge.fee_record_category,
    outstanding_amount: charge.outstanding_amount,
    description: charge.description,
    amount: String(charge.outstanding_amount),
  }
}

export function createUnclassifiedAllocation(): PaymentAllocationDraft {
  return {
    key: draftKey(),
    allocation_type: 'manual',
    fee_record_charge_id: null,
    fee_item_id: null,
    fee_agreement_item_id: null,
    fee_code: null,
    billing_month: null,
    fee_record_category: null,
    outstanding_amount: null,
    description: '',
    amount: '',
  }
}

export function createOneTimeChargeDraft(academicYear: string, monthNumber = new Date().getMonth() + 1): OneTimeChargeDraft {
  return {
    academic_year: academicYear,
    billing_month: `${academicYear}-${String(monthNumber).padStart(2, '0')}`,
    fee_record_category: 'OTHERS',
    description: '',
    expected_amount: '',
    remark: '',
  }
}

export function hasIncompleteUnclassifiedAllocation(allocations: PaymentAllocationDraft[]) {
  return allocations.some(
    (allocation) =>
      allocation.allocation_type === 'manual' &&
      (!allocation.description.trim() || Number(allocation.amount) <= 0),
  )
}
```

Remove the equivalent local types and default allocation functions from `App.tsx` and import these definitions.

- [ ] **Step 4: Run the model tests**

Run:

```powershell
Set-Location frontend
npx vitest run src/features/payments/paymentAllocationModel.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run the existing App tests**

Run:

```powershell
Set-Location frontend
npx vitest run src/App.test.tsx
```

Expected: all existing App tests PASS, proving the extraction preserved behavior.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/App.tsx frontend/src/features/payments/paymentAllocationModel.ts frontend/src/features/payments/paymentAllocationModel.test.ts
git commit -m "refactor: extract payment allocation model"
```

---

### Task 2: Focused payment allocation editor

**Files:**
- Create: `frontend/src/features/payments/PaymentAllocationEditor.tsx`
- Create: `frontend/src/features/payments/PaymentAllocationEditor.test.tsx`

**Interfaces:**
- Consumes the Task 1 model types and these props:

```ts
type PaymentAllocationEditorProps = {
  academicYear: string
  paymentAmount: number
  allocationTotal: number
  allocations: PaymentAllocationDraft[]
  outstandingCharges: OutstandingChargeCell[]
  isLoadingOutstandingCharges: boolean
  outstandingChargeError: string
  allocationError?: string
  allocationErrors?: ValidationErrors
  canAddOneTimeCharge: boolean
  isOneTimeChargeOpen: boolean
  oneTimeCharge: OneTimeChargeDraft
  oneTimeChargeErrors?: ValidationErrors
  oneTimeChargeNotice: string
  isSavingOneTimeCharge: boolean
  onRefresh: () => void
  onToggleCharge: (charge: OutstandingChargeCell, selected: boolean) => void
  onUpdateAllocation: (key: string, field: 'description' | 'amount', value: string) => void
  onRemoveAllocation: (key: string) => void
  onOpenOneTimeCharge: () => void
  onCancelOneTimeCharge: () => void
  onUpdateOneTimeCharge: (field: keyof OneTimeChargeDraft, value: string) => void
  onCreateOneTimeCharge: () => void
  onAddUnclassified: () => void
  formatValidationError: (errors: ValidationErrors | undefined, field: string) => string
}
```

- Import `ValidationErrors` from `../fee-agreements/types`.
- Define `formatCurrency` and `formatBillingMonth` as private formatting functions inside `PaymentAllocationEditor.tsx`.
- Move the existing `groupedOutstandingCharges` memo and `selectedChargeIds` derivation from `App.tsx` into the editor.
- Produces accessible user-facing sections named `Outstanding fees`, `Payment allocation`, `Add one-time charge`, and `Advanced options`.

- [ ] **Step 1: Write failing component tests**

Render the component with one Uniform charge and assert:

```tsx
expect(screen.getByRole('heading', { name: 'Outstanding fees' })).toBeInTheDocument()
expect(screen.getByText('Uniform – Sports T-shirt')).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Add one-time charge' })).toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Record unclassified payment' })).not.toBeInTheDocument()

await user.click(screen.getByText('Advanced options'))
expect(screen.getByText(/does not reduce the student’s outstanding balance/i)).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Record unclassified payment' })).toBeInTheDocument()
```

Add separate tests that:

- Hide `Add one-time charge` when `canAddOneTimeCharge` is false.
- Call `onToggleCharge(uniformCharge, true)` when its checkbox is selected.
- Open the compact form, edit Description to `CCA – Basketball`, edit Amount to `120`, and call `onCreateOneTimeCharge`.
- Disable `Record unclassified payment` when `hasIncompleteUnclassifiedAllocation(allocations)` is true.
- Render unclassified rows as `Unclassified payment`, not `Manual allocation`.

- [ ] **Step 2: Run component tests and verify they fail**

Run:

```powershell
Set-Location frontend
npx vitest run src/features/payments/PaymentAllocationEditor.test.tsx
```

Expected: FAIL because `PaymentAllocationEditor.tsx` does not exist.

- [ ] **Step 3: Implement the editor**

Build one component with four clear blocks:

```tsx
<section className="payment-allocation-block" aria-labelledby="outstanding-fees-heading">
  <header className="payment-subheader">
    <div>
      <h3 id="outstanding-fees-heading">Outstanding fees</h3>
      <p>Select the fees this payment should clear.</p>
    </div>
    <div className="payment-subheader-actions">
      <button type="button" className="table-action" onClick={onRefresh}>Refresh</button>
      {canAddOneTimeCharge && (
        <button type="button" className="secondary-action compact" onClick={onOpenOneTimeCharge}>
          Add one-time charge
        </button>
      )}
    </div>
  </header>

  {isOneTimeChargeOpen && (
    <section className="one-time-charge-panel" aria-labelledby="one-time-charge-heading">
      <div>
        <h4 id="one-time-charge-heading">Add one-time charge</h4>
        <p>For Uniform, CCA, Books, or another charge not listed below.</p>
      </div>
      <div className="one-time-charge-grid">
        <label className="form-field">
          Billing month
          <input
            aria-label="One-time charge billing month"
            type="month"
            value={oneTimeCharge.billing_month}
            onChange={(event) => onUpdateOneTimeCharge('billing_month', event.target.value)}
          />
          <small>{formatValidationError(oneTimeChargeErrors, 'billing_month')}</small>
        </label>
        <label className="form-field">
          Category
          <select
            aria-label="One-time charge category"
            value={oneTimeCharge.fee_record_category}
            onChange={(event) => onUpdateOneTimeCharge('fee_record_category', event.target.value)}
          >
            {feeRecordCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <small>{formatValidationError(oneTimeChargeErrors, 'fee_record_category')}</small>
        </label>
        <label className="form-field">
          Description
          <input
            aria-label="One-time charge description"
            value={oneTimeCharge.description}
            placeholder="Uniform, CCA, Books, or another fee"
            onChange={(event) => onUpdateOneTimeCharge('description', event.target.value)}
          />
          <small>{formatValidationError(oneTimeChargeErrors, 'description')}</small>
        </label>
        <label className="form-field">
          Amount
          <input
            aria-label="One-time charge amount"
            type="number"
            min="0.01"
            step="0.01"
            value={oneTimeCharge.expected_amount}
            onChange={(event) => onUpdateOneTimeCharge('expected_amount', event.target.value)}
          />
          <small>{formatValidationError(oneTimeChargeErrors, 'expected_amount')}</small>
        </label>
        <label className="form-field wide">
          Remark <span className="optional-label">(optional)</span>
          <input
            aria-label="One-time charge remark"
            value={oneTimeCharge.remark}
            onChange={(event) => onUpdateOneTimeCharge('remark', event.target.value)}
          />
        </label>
      </div>
      <div className="one-time-charge-actions">
        <button type="button" className="secondary-action" onClick={onCancelOneTimeCharge}>Cancel</button>
        <button type="button" className="primary-action compact" disabled={isSavingOneTimeCharge} onClick={onCreateOneTimeCharge}>
          {isSavingOneTimeCharge ? 'Adding...' : 'Add and select charge'}
        </button>
      </div>
    </section>
  )}

  {allocationError && <div role="alert">{allocationError}</div>}
  {outstandingChargeError && <div role="alert">{outstandingChargeError}</div>}
  {isLoadingOutstandingCharges && <div className="empty-state">Loading outstanding fees...</div>}
  {!isLoadingOutstandingCharges && groupedOutstandingCharges.length === 0 && (
    <div className="empty-state">No outstanding fees found for {academicYear}.</div>
  )}
  <div className="charge-picker">
    {groupedOutstandingCharges.map((monthGroup) => (
      <section className="charge-month-group" key={monthGroup.billingMonth}>
        <h4>{formatBillingMonth(monthGroup.billingMonth)}</h4>
        {monthGroup.categories.map((categoryGroup) => (
          <div className="charge-category-group" key={`${monthGroup.billingMonth}-${categoryGroup.category}`}>
            <span>{categoryGroup.category}</span>
            {categoryGroup.charges.map((charge) => (
              <label className="charge-cell-row" key={charge.id}>
                <input
                  type="checkbox"
                  checked={selectedChargeIds.has(charge.id)}
                  onChange={(event) => onToggleCharge(charge, event.target.checked)}
                />
                <span>
                  <strong>{charge.description}</strong>
                  <small>{charge.fee_code ?? 'One-time charge'} / Outstanding {formatCurrency(charge.outstanding_amount)}</small>
                </span>
              </label>
            ))}
          </div>
        ))}
      </section>
    ))}
  </div>
</section>

<section className="payment-allocation-block" aria-labelledby="payment-allocation-heading">
  <header className="payment-subheader">
    <div>
      <h3 id="payment-allocation-heading">Payment allocation</h3>
      <p>Allocated {formatCurrency(allocationTotal)} of {formatCurrency(paymentAmount)}</p>
    </div>
  </header>
  <div className="allocation-rows">
    {allocations.length === 0 && (
      <div className="empty-state">Select an outstanding fee to continue.</div>
    )}
    {allocations.map((allocation, index) => (
      <div className={`allocation-row ${allocation.allocation_type}`} key={allocation.key}>
        <div className="allocation-source-summary">
          <span className={`badge ${allocation.allocation_type === 'charge' ? 'paid' : 'neutral'}`}>
            {allocation.allocation_type === 'charge' ? 'Fee' : 'Unclassified payment'}
          </span>
          <strong>{allocation.description || 'Describe this unclassified payment'}</strong>
          <small>
            {allocation.allocation_type === 'charge'
              ? `${allocation.billing_month} / ${allocation.fee_record_category} / Outstanding ${formatCurrency(allocation.outstanding_amount)}`
              : 'Not linked to a fee; outstanding balance will not change.'}
          </small>
        </div>
        {allocation.allocation_type === 'manual' && (
          <label className="form-field">
            Description
            <input
              aria-label={`Unclassified payment ${index + 1} description`}
              value={allocation.description}
              onChange={(event) => onUpdateAllocation(allocation.key, 'description', event.target.value)}
            />
            <small>{formatValidationError(allocationErrors, `allocations.${index}.description`)}</small>
          </label>
        )}
        <label className="form-field">
          Amount
          <input
            aria-label={`${allocation.description || `Unclassified payment ${index + 1}`} amount`}
            type="number"
            min="0.01"
            max={allocation.outstanding_amount ?? undefined}
            step="0.01"
            value={allocation.amount}
            onChange={(event) => onUpdateAllocation(allocation.key, 'amount', event.target.value)}
          />
          <small>{formatValidationError(allocationErrors, `allocations.${index}.amount`)}</small>
        </label>
        <button type="button" className="table-action danger-action" onClick={() => onRemoveAllocation(allocation.key)}>
          Remove
        </button>
      </div>
    ))}
  </div>
</section>

<details className="payment-advanced-options">
  <summary>Advanced options</summary>
  <div className="advanced-option-content">
    <strong>Unclassified payment</strong>
    <p>Use only when received money cannot be linked to a fee. This records the payment but does not reduce the student’s outstanding balance.</p>
    <button
      type="button"
      className="table-action"
      disabled={hasIncompleteUnclassifiedAllocation(allocations)}
      onClick={onAddUnclassified}
    >
      Record unclassified payment
    </button>
  </div>
</details>
```

Use native `<details>` so the exception remains collapsed without extra modal state. Reuse the existing month/category grouping logic and validation rendering. Do not issue API requests from the component.

- [ ] **Step 4: Run component tests**

Run:

```powershell
Set-Location frontend
npx vitest run src/features/payments/PaymentAllocationEditor.test.tsx
```

Expected: all component tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/payments/PaymentAllocationEditor.tsx frontend/src/features/payments/PaymentAllocationEditor.test.tsx
git commit -m "feat: add guided payment allocation editor"
```

---

### Task 3: One-time charge creation and automatic selection

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `PaymentAllocationEditor` from Task 2 and existing `POST /students/{studentId}/fee-record/manual-charges`.
- Produces:
  - Payment-modal state for one-time charge draft/errors/notice/open/saving.
  - `submitPaymentOneTimeCharge(): Promise<void>`.
  - Successful charge creation followed by a normal `charge` allocation.

- [ ] **Step 1: Add failing integration tests**

Add an `outstandingUniformCharge` fixture and a manual-charge response fixture. In a Record Payment test, override the API mock so:

```ts
if (url.pathname.endsWith('/students/1/fee-record/manual-charges') && init?.method === 'POST') {
  return json({ data: outstandingUniformCharge })
}
if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
  return json({ data: [outstandingUniformCharge] })
}
```

Test the complete flow:

```tsx
await user.click(screen.getByRole('button', { name: 'Create Payment' }))
const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
await user.click(within(dialog).getByRole('button', { name: 'Add one-time charge' }))
await user.type(within(dialog).getByLabelText('One-time charge description'), 'Uniform – Sports T-shirt')
await user.type(within(dialog).getByLabelText('One-time charge amount'), '80')
await user.click(within(dialog).getByRole('button', { name: 'Add and select charge' }))

await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
  expect.stringMatching(/\/students\/1\/fee-record\/manual-charges$/),
  expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      academic_year: '2026',
      billing_month: expect.stringMatching(/^2026-\d{2}$/),
      fee_record_category: 'OTHERS',
      description: 'Uniform – Sports T-shirt',
      expected_amount: 80,
      remark: null,
    }),
  }),
))

expect(await within(dialog).findByText('Charge added and selected for this payment.')).toBeInTheDocument()
expect(within(dialog).getByLabelText('Uniform – Sports T-shirt amount')).toHaveValue(80)
expect(within(dialog).getByText('Allocated RM 80 of RM 80')).toBeInTheDocument()
```

Add tests that:

- A 422 response displays `description` or `expected_amount` validation inside the one-time form and adds no allocation.
- The action is absent for a user without `fee_record.manage`.
- Clicking `Record unclassified payment` twice produces only one incomplete row.
- Changing Academic Year closes/resets the inline form and removes selected charge allocations from the old year.

- [ ] **Step 2: Run targeted integration tests and verify they fail**

Run:

```powershell
Set-Location frontend
npx vitest run src/App.test.tsx -t "one-time charge|unclassified payment|payment academic year"
```

Expected: new tests FAIL because the editor is not wired and no inline creation handler exists.

- [ ] **Step 3: Add modal state and reset behavior**

Add:

```ts
const [showPaymentOneTimeCharge, setShowPaymentOneTimeCharge] = useState(false)
const [paymentOneTimeCharge, setPaymentOneTimeCharge] = useState<OneTimeChargeDraft>(
  createOneTimeChargeDraft('2026'),
)
const [paymentOneTimeChargeErrors, setPaymentOneTimeChargeErrors] = useState<ValidationErrors>()
const [paymentOneTimeChargeNotice, setPaymentOneTimeChargeNotice] = useState('')
const [isSavingPaymentOneTimeCharge, setIsSavingPaymentOneTimeCharge] = useState(false)
```

In `beginCreatePayment`, initialize the draft from `nextForm.academic_year` and clear errors, notice, and open state. When academic year changes, close and reset this form to that year. Keep existing filtering so old-year charge allocations are removed.

- [ ] **Step 4: Implement create-and-select**

```ts
const submitPaymentOneTimeCharge = async () => {
  if (!selectedStudent || !canManageFeeRecord) return

  setIsSavingPaymentOneTimeCharge(true)
  setPaymentOneTimeChargeErrors(undefined)
  setPaymentOneTimeChargeNotice('')

  try {
    const response = await apiRequest<{ data: OutstandingChargeCell }>(
      `/students/${selectedStudent.id}/fee-record/manual-charges`,
      {
        method: 'POST',
        body: {
          academic_year: paymentForm.academic_year,
          billing_month: paymentOneTimeCharge.billing_month,
          fee_record_category: paymentOneTimeCharge.fee_record_category,
          description: paymentOneTimeCharge.description,
          expected_amount: Number(paymentOneTimeCharge.expected_amount || 0),
          remark: paymentOneTimeCharge.remark || null,
        },
      },
    )

    setPaymentForm((current) => {
      const allocation = createChargeAllocation(response.data)
      return {
        ...current,
        allocations: [...current.allocations, allocation],
        amount: String(allocationTotal(current.allocations) + response.data.outstanding_amount),
      }
    })
    setShowPaymentOneTimeCharge(false)
    setPaymentOneTimeCharge(createOneTimeChargeDraft(paymentForm.academic_year))
    setPaymentOneTimeChargeNotice('Charge added and selected for this payment.')
    await loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
  } catch (chargeError) {
    if (chargeError instanceof ApiError && chargeError.status === 422) {
      setPaymentOneTimeChargeErrors(chargeError.errors)
    }
    handleApiError(chargeError)
  } finally {
    setIsSavingPaymentOneTimeCharge(false)
  }
}
```

Replace `selectChargeAllocation` draft construction with `createChargeAllocation(charge)`. Rename `addPaymentAllocation` to `addUnclassifiedPaymentAllocation` and make it a no-op if `hasIncompleteUnclassifiedAllocation(current.allocations)` is true.

- [ ] **Step 5: Replace inline allocation markup with the editor**

Pass current App state and callbacks into `PaymentAllocationEditor`. Keep the outer payment details form, balance preview, sticky modal footer, and payment submission unchanged.

- [ ] **Step 6: Run targeted tests**

Run:

```powershell
Set-Location frontend
npx vitest run src/App.test.tsx -t "one-time charge|unclassified payment|payment academic year"
```

Expected: all targeted tests PASS.

- [ ] **Step 7: Run all frontend tests**

Run:

```powershell
Set-Location frontend
npm test
```

Expected: all frontend tests PASS.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: create charges while recording payments"
```

---

### Task 4: Desktop-first styling and visual verification

**Files:**
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: class names emitted by `PaymentAllocationEditor`.
- Produces: compact PC layout at widths at and above 1180px and stacked fallback below 1024px.

- [ ] **Step 1: Add the desktop styles**

Add exact layout rules:

```css
.payment-subheader-actions,
.one-time-charge-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.one-time-charge-panel {
  border: 1px solid #d9e6df;
  border-radius: 10px;
  background: #f7fbf9;
  padding: 14px;
  display: grid;
  gap: 12px;
}

.one-time-charge-panel h4,
.one-time-charge-panel p {
  margin: 0;
}

.one-time-charge-grid {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(150px, 0.7fr) minmax(260px, 1.4fr) minmax(140px, 0.6fr);
  gap: 10px;
  align-items: start;
}

.one-time-charge-grid .wide {
  grid-column: 1 / -1;
}

.payment-advanced-options {
  border: 1px solid #e4e7ee;
  border-radius: 8px;
  background: #fff;
}

.payment-advanced-options summary {
  cursor: pointer;
  padding: 12px 14px;
  font-weight: 700;
}

.advanced-option-content {
  border-top: 1px solid #edf0f4;
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  gap: 6px 16px;
  align-items: center;
}

.advanced-option-content p {
  margin: 0;
  color: #747985;
}

.advanced-option-content .table-action {
  grid-column: 2;
  grid-row: 1 / span 2;
}
```

Keep normal charge rows compact. Give `.allocation-row.manual` a quiet warning border/background so it reads as an exception without competing with the primary submit action.

- [ ] **Step 2: Add responsive fallback**

Inside the existing `max-width: 1023px` media query:

```css
.payment-subheader-actions,
.one-time-charge-actions {
  align-items: stretch;
  flex-direction: column;
}

.one-time-charge-grid,
.advanced-option-content {
  grid-template-columns: 1fr;
}

.advanced-option-content .table-action {
  grid-column: 1;
  grid-row: auto;
  width: 100%;
}
```

At `1024px–1180px`, reduce `.one-time-charge-grid` to two columns without changing the PC-first default.

- [ ] **Step 3: Run lint, tests, and build**

Run:

```powershell
Set-Location frontend
npm run lint
npm test
npm run build
```

Expected: lint exits 0, all tests PASS, and the Vite production build succeeds.

- [ ] **Step 4: Perform browser QA**

Use an authenticated student with Fee Record permissions and verify at desktop width:

1. Record Payment opens with `Outstanding fees` and no prominent unclassified action.
2. `Add one-time charge` stays inside the modal and uses a compact horizontal layout.
3. Creating `Uniform – Sports T-shirt` for RM80 closes the form, selects the returned charge, and sets payment/allocation totals to RM80.
4. `Advanced options` is collapsed initially.
5. Opening it clearly says the unclassified payment does not reduce outstanding.
6. Repeated clicking cannot create multiple empty unclassified rows.
7. Long descriptions do not overlap amount/remove controls.
8. Modal footer stays reachable.
9. At a narrow viewport, fields stack without horizontal scrolling.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.css
git commit -m "style: refine payment allocation workflow"
```

---

### Task 5: Final regression and handoff

**Files:**
- Verify only; modify a file only if a failing check reveals an in-scope defect.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified, user-ready Record Payment UX with no backend behavior change.

- [ ] **Step 1: Run the complete frontend verification**

```powershell
Set-Location frontend
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run focused backend accounting tests**

```powershell
Set-Location backend
php artisan test tests/Feature/FeeRecordManualChargeApiTest.php tests/Feature/FeeRecordPaymentAllocationApiTest.php
```

Expected: both test files PASS, confirming one-time charges clear only through charge allocations and unclassified allocations do not change Fee Record outstanding.

- [ ] **Step 3: Inspect the final diff**

```powershell
Set-Location ..
git diff --check
git status --short
git log --oneline -6
```

Expected:

- `git diff --check` exits 0.
- Only the user’s pre-existing untracked `backend/database/on` and `frontend/test-results/` may remain.
- The feature commits are visible in the recent log.

- [ ] **Step 4: Report the result**

Summarize:

- The new normal payment path.
- The create-and-select one-time-charge behavior.
- The new Advanced options treatment for unclassified payments.
- Permission behavior.
- Test, lint, build, backend test, and browser QA results.
- Any intentionally deferred Uniform/CCA catalogue work.
