# Fee Agreement Editor UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized Create/Supersede Fee Agreement form with a PC-first, low-learning-curve editor that keeps common fees compact, reveals advanced settings on demand, and makes Supersede changes easy to review.

**Architecture:** Extract Fee Agreement types, pure summaries, validation, dirty-state detection, and Supersede comparison from `App.tsx` into a focused feature module. Render a controlled `FeeAgreementEditor` inside the existing `ModalFrame`, with compact `FeeItemRow` components in the main column and a sticky `AgreementReviewPanel` beside them on desktop. Keep existing form state ownership, submission endpoints, payload shape, permissions, and backend validation in `App.tsx`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, user-event, CSS.

## Global Constraints

- The product is PC-first; mobile is a functional, readable fallback.
- Do not modify the backend, database, permissions, enum values, API endpoints, or Fee Agreement payload shape.
- Create continues to post to `/students/{student}/fee-agreements`.
- Supersede continues to post to `/fee-agreements/{agreement}/supersede`.
- Monthly billing with an empty `billing_months` array continues to mean every month.
- Tuition and Misc remain mandatory and enabled.
- Existing business validation remains authoritative.
- Keep persistent labels, keyboard access, visible focus, and at least `44px` mobile touch targets.
- Do not touch the user's unrelated untracked `backend/database/on` or `frontend/test-results/` content.

## File Structure

- Create `frontend/src/features/fee-agreements/types.ts`
  - Owns Fee Agreement domain and editor draft types currently embedded in `App.tsx`.
- Create `frontend/src/features/fee-agreements/feeAgreementEditorModel.ts`
  - Owns pure totals, month summaries, compact summaries, validation, dirty detection, and Supersede comparisons.
- Create `frontend/src/features/fee-agreements/feeAgreementEditorModel.test.ts`
  - Unit-tests pure editor behavior without rendering the application.
- Create `frontend/src/features/fee-agreements/FeeItemRow.tsx`
  - Owns a compact fee summary row, advanced controls, and month customization.
- Create `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`
  - Owns Create totals and Supersede change review.
- Create `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
  - Owns agreement details, core/optional fee organization, discount disclosure, error expansion, and layout composition.
- Create `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
  - Owns PC-first editor layout and responsive fallback.
- Create `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`
  - Covers the controlled editor's user-facing behavior.
- Modify `frontend/src/App.tsx`
  - Imports the feature module, keeps API coordination, captures the initial draft, and routes all closing through dirty-state confirmation.
- Modify `frontend/src/App.test.tsx`
  - Covers Modal integration, close confirmation, validation recovery, and unchanged request payloads.
- Modify `frontend/src/App.css`
  - Removes superseded Fee Agreement editor styles while retaining Student detail, history, and shared finance styles.

---

### Task 1: Extract Fee Agreement Types and Pure Editor Model

**Files:**
- Create: `frontend/src/features/fee-agreements/types.ts`
- Create: `frontend/src/features/fee-agreements/feeAgreementEditorModel.ts`
- Create: `frontend/src/features/fee-agreements/feeAgreementEditorModel.test.ts`
- Modify: `frontend/src/App.tsx:103-205`
- Modify: `frontend/src/App.tsx:903-931`
- Modify: `frontend/src/App.tsx:1724-1763`

**Interfaces:**
- Produces: `FeeAgreement`, `FeeAgreementForm`, `FeeAgreementItemDraft`, `FeeAgreementDiscountDraft`, `FeeItem`, `PaymentPlan`, `BillingFrequency`, `FeeAgreementItemClassification`, `DiscountType`, `DiscountScope`, and `ValidationErrors`.
- Produces: `agreementTotals(form): AgreementTotals`.
- Produces: `billingMonthSummary(frequency, months): string`.
- Produces: `feeItemSummary(item): string`.
- Produces: `validateFeeAgreementBillingConfig(items): ValidationErrors`.
- Produces: `isFeeAgreementFormDirty(form, baseline): boolean`.
- Produces: `getAgreementChanges(current, draft): AgreementChange[]`.

- [ ] **Step 1: Write failing model tests**

Create `frontend/src/features/fee-agreements/feeAgreementEditorModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  agreementTotals,
  billingMonthSummary,
  getAgreementChanges,
  isFeeAgreementFormDirty,
  validateFeeAgreementBillingConfig,
} from './feeAgreementEditorModel'
import type { FeeAgreement, FeeAgreementForm } from './types'

const baseForm: FeeAgreementForm = {
  academic_year: '2026',
  payment_plan: 'monthly',
  effective_from: '2026-01-01',
  effective_to: '',
  remarks: '',
  items: [
    {
      fee_item_id: 1,
      code: 'TUITION',
      name: 'Tuition Fee',
      enabled: true,
      amount: '800',
      description: '',
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: [],
      requires_preview_confirmation: false,
    },
    {
      fee_item_id: 2,
      code: 'MISC',
      name: 'Misc Fee',
      enabled: true,
      amount: '90',
      description: '',
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: [],
      requires_preview_confirmation: false,
    },
  ],
  discount: {
    enabled: false,
    discount_label: '',
    discount_type: 'fixed_amount',
    scope: 'total_payable',
    value: '',
    remark: '',
    selected_fee_codes: [],
  },
}

const currentAgreement: FeeAgreement = {
  id: 10,
  academic_year: '2026',
  version_no: 1,
  payment_plan: 'monthly',
  effective_from: '2026-01-01',
  effective_to: null,
  is_current: true,
  status: 'active',
  remarks: null,
  items: baseForm.items.map((item, index) => ({
    id: index + 1,
    fee_item_id: item.fee_item_id,
    fee_code: item.code,
    fee_category: 'mandatory',
    description: item.description,
    amount: Number(item.amount),
    is_mandatory: true,
    classification: item.classification,
    billing_frequency: item.billing_frequency,
    billing_months: item.billing_months,
    requires_preview_confirmation: item.requires_preview_confirmation,
  })),
  discounts: [],
}

describe('feeAgreementEditorModel', () => {
  it('describes an empty monthly override as Every month', () => {
    expect(billingMonthSummary('monthly', [])).toBe('Every month')
  })

  it('formats selected months in calendar order', () => {
    expect(billingMonthSummary('custom', [6, 1, 3])).toBe('Jan, Mar, Jun')
  })

  it('calculates totals from enabled items and discount scope', () => {
    const form = structuredClone(baseForm)
    form.discount = {
      enabled: true,
      discount_label: 'Tuition rebate',
      discount_type: 'percentage',
      scope: 'tuition_only',
      value: '10',
      remark: 'Approved',
      selected_fee_codes: [],
    }

    expect(agreementTotals(form)).toEqual({
      subtotal: 890,
      discountAmount: 80,
      total: 810,
    })
  })

  it('requires months for custom billing', () => {
    const form = structuredClone(baseForm)
    form.items[0].billing_frequency = 'custom'

    expect(validateFeeAgreementBillingConfig(form.items)).toEqual({
      'items.0.billing_months': ['Choose at least one billing month.'],
    })
  })

  it('detects a changed draft without mutating the baseline', () => {
    const baseline = structuredClone(baseForm)
    const form = structuredClone(baseForm)
    form.items[0].amount = '850'

    expect(isFeeAgreementFormDirty(form, baseline)).toBe(true)
    expect(isFeeAgreementFormDirty(baseline, baseline)).toBe(false)
  })

  it('describes amount, month, added, and removed fee changes', () => {
    const form = structuredClone(baseForm)
    form.items[0].amount = '850'
    form.items[1].billing_frequency = 'custom'
    form.items[1].billing_months = [1, 2, 3, 4, 5, 6]
    form.items.push({
      fee_item_id: 3,
      code: 'TRANSPORT',
      name: 'Transport',
      enabled: true,
      amount: '120',
      description: '',
      classification: 'optional_service',
      billing_frequency: 'monthly',
      billing_months: [],
      requires_preview_confirmation: false,
    })

    const changes = getAgreementChanges(currentAgreement, form)

    expect(changes.map((change) => change.message)).toEqual([
      'Tuition Fee: RM 800 → RM 850',
      'Misc Fee months: Every month → Jan, Feb, Mar, Apr, May, Jun',
      'Transport added at RM 120',
    ])
  })
})
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/feeAgreementEditorModel.test.ts
```

Expected: FAIL because `feeAgreementEditorModel` and `types` do not exist.

- [ ] **Step 3: Create the shared types**

Create `frontend/src/features/fee-agreements/types.ts` with the exact Fee Agreement types currently defined in `App.tsx`:

```ts
export type PaymentPlan = 'monthly' | 'termly' | 'yearly'
export type FeeAgreementItemClassification = 'recurring' | 'optional_service' | 'one_time' | 'manual'
export type BillingFrequency = 'monthly' | 'termly' | 'yearly' | 'custom' | 'one_time'
export type DiscountType = 'percentage' | 'fixed_amount'
export type DiscountScope = 'tuition_only' | 'total_payable' | 'selected_fee_items'
export type ValidationErrors = Record<string, string[]>

export type FeeItem = {
  id: number
  code: string
  name: string
  category: string
  fee_type: string
  default_amount: number
}

export type FeeAgreementItem = {
  id: number
  fee_item_id: number
  fee_code: string
  fee_category: string
  description: string
  amount: number
  is_mandatory: boolean
  classification: FeeAgreementItemClassification | null
  billing_frequency: BillingFrequency | null
  billing_months: number[] | null
  requires_preview_confirmation: boolean
}

export type FeeAgreementDiscount = {
  id: number
  discount_label: string
  discount_type: DiscountType
  scope: DiscountScope
  value: number
  remark: string
  selected_fee_codes: string[]
}

export type FeeAgreement = {
  id: number
  academic_year: string
  version_no: number
  payment_plan: PaymentPlan
  effective_from: string
  effective_to: string | null
  is_current: boolean
  status: string
  remarks: string | null
  items: FeeAgreementItem[]
  discounts: FeeAgreementDiscount[]
}

export type FeeAgreementItemDraft = {
  fee_item_id: number
  code: string
  name: string
  enabled: boolean
  amount: string
  description: string
  classification: FeeAgreementItemClassification
  billing_frequency: BillingFrequency
  billing_months: number[]
  requires_preview_confirmation: boolean
}

export type FeeAgreementDiscountDraft = {
  enabled: boolean
  discount_label: string
  discount_type: DiscountType
  scope: DiscountScope
  value: string
  remark: string
  selected_fee_codes: string[]
}

export type FeeAgreementForm = {
  academic_year: string
  payment_plan: PaymentPlan
  effective_from: string
  effective_to: string
  remarks: string
  items: FeeAgreementItemDraft[]
  discount: FeeAgreementDiscountDraft
}
```

- [ ] **Step 4: Implement the pure model**

Create `frontend/src/features/fee-agreements/feeAgreementEditorModel.ts`:

```ts
import type {
  BillingFrequency,
  FeeAgreement,
  FeeAgreementForm,
  FeeAgreementItemDraft,
  ValidationErrors,
} from './types'

export const monthShortLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type AgreementTotals = {
  subtotal: number
  discountAmount: number
  total: number
}

export type AgreementChange = {
  key: string
  kind: 'date' | 'amount' | 'months' | 'added' | 'removed' | 'billing' | 'discount'
  message: string
}

function money(value: number) {
  return `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value)}`
}

function label(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function billingMonthSummary(frequency: BillingFrequency | null, months: number[] | null | undefined) {
  const selected = [...(months ?? [])].sort((left, right) => left - right)

  if (frequency === 'monthly' && selected.length === 0) {
    return 'Every month'
  }

  if (selected.length === 0) {
    return 'Months not set'
  }

  return selected.map((month) => monthShortLabels[month - 1]).filter(Boolean).join(', ')
}

export function feeItemSummary(item: FeeAgreementItemDraft) {
  const preview = item.requires_preview_confirmation ? 'Preview required' : 'No preview required'
  return `${label(item.billing_frequency)} · ${billingMonthSummary(item.billing_frequency, item.billing_months)} · ${preview}`
}

export function agreementTotals(form: FeeAgreementForm): AgreementTotals {
  const enabled = form.items.filter((item) => item.enabled)
  const subtotal = enabled.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const tuitionAmount = enabled
    .filter((item) => item.code === 'TUITION')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const selectedAmount = enabled
    .filter((item) => form.discount.selected_fee_codes.includes(item.code))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  let discountAmount = 0

  if (form.discount.enabled) {
    const value = Number(form.discount.value || 0)
    const base =
      form.discount.scope === 'total_payable'
        ? subtotal
        : form.discount.scope === 'selected_fee_items'
          ? selectedAmount
          : tuitionAmount
    discountAmount = form.discount.discount_type === 'percentage' ? (base * value) / 100 : value
  }

  return {
    subtotal,
    discountAmount,
    total: Math.max(subtotal - discountAmount, 0),
  }
}

export function validateFeeAgreementBillingConfig(items: FeeAgreementItemDraft[]): ValidationErrors {
  return items.reduce<ValidationErrors>((errors, item, index) => {
    if (!item.enabled) {
      return errors
    }

    const monthCount = item.billing_months.length

    if ((item.billing_frequency === 'termly' || item.billing_frequency === 'custom') && monthCount === 0) {
      errors[`items.${index}.billing_months`] = ['Choose at least one billing month.']
    }

    if ((item.billing_frequency === 'yearly' || item.billing_frequency === 'one_time') && monthCount !== 1) {
      errors[`items.${index}.billing_months`] = ['Choose exactly one billing month.']
    }

    return errors
  }, {})
}

export function isFeeAgreementFormDirty(form: FeeAgreementForm, baseline: FeeAgreementForm) {
  return JSON.stringify(form) !== JSON.stringify(baseline)
}

export function getAgreementChanges(current: FeeAgreement, draft: FeeAgreementForm): AgreementChange[] {
  const changes: AgreementChange[] = []

  if (current.effective_from !== draft.effective_from) {
    changes.push({
      key: 'effective_from',
      kind: 'date',
      message: `Effective from: ${current.effective_from} → ${draft.effective_from}`,
    })
  }

  const currentEnd = current.effective_to ?? 'Open-ended'
  const draftEnd = draft.effective_to || 'Open-ended'
  if (currentEnd !== draftEnd) {
    changes.push({ key: 'effective_to', kind: 'date', message: `Effective to: ${currentEnd} → ${draftEnd}` })
  }

  const currentItems = new Map(current.items.map((item) => [item.fee_code, item]))
  const draftItems = new Map(draft.items.filter((item) => item.enabled).map((item) => [item.code, item]))
  const codes = [...new Set([...currentItems.keys(), ...draftItems.keys()])]

  for (const code of codes) {
    const before = currentItems.get(code)
    const after = draftItems.get(code)
    const name = after?.name ?? before?.description ?? code

    if (!before && after) {
      changes.push({ key: `${code}:added`, kind: 'added', message: `${name} added at ${money(Number(after.amount || 0))}` })
      continue
    }

    if (before && !after) {
      changes.push({ key: `${code}:removed`, kind: 'removed', message: `${name} removed` })
      continue
    }

    if (!before || !after) {
      continue
    }

    if (before.amount !== Number(after.amount || 0)) {
      changes.push({
        key: `${code}:amount`,
        kind: 'amount',
        message: `${name}: ${money(before.amount)} → ${money(Number(after.amount || 0))}`,
      })
    }

    const beforeMonths = billingMonthSummary(before.billing_frequency, before.billing_months)
    const afterMonths = billingMonthSummary(after.billing_frequency, after.billing_months)
    if (beforeMonths !== afterMonths) {
      changes.push({
        key: `${code}:months`,
        kind: 'months',
        message: `${name} months: ${beforeMonths} → ${afterMonths}`,
      })
    }

    if (
      before.classification !== after.classification ||
      before.billing_frequency !== after.billing_frequency ||
      before.requires_preview_confirmation !== after.requires_preview_confirmation
    ) {
      changes.push({
        key: `${code}:billing`,
        kind: 'billing',
        message: `${name} billing settings changed`,
      })
    }
  }

  const beforeDiscount = current.discounts[0] ?? null
  const afterDiscount = draft.discount.enabled ? draft.discount : null
  if (JSON.stringify(beforeDiscount && {
    discount_label: beforeDiscount.discount_label,
    discount_type: beforeDiscount.discount_type,
    scope: beforeDiscount.scope,
    value: String(beforeDiscount.value),
    remark: beforeDiscount.remark,
    selected_fee_codes: beforeDiscount.selected_fee_codes,
  }) !== JSON.stringify(afterDiscount)) {
    changes.push({
      key: 'discount',
      kind: 'discount',
      message: afterDiscount ? `Manual discount updated to ${afterDiscount.value || '0'}` : 'Manual discount removed',
    })
  }

  return changes
}
```

- [ ] **Step 5: Import the shared types and model in App**

Delete the duplicate Fee Agreement type declarations, local `agreementPreview`, and local `validateFeeAgreementBillingConfig` from `App.tsx`. Import:

```ts
import {
  agreementTotals,
  validateFeeAgreementBillingConfig,
} from './features/fee-agreements/feeAgreementEditorModel'
import type {
  BillingFrequency,
  DiscountScope,
  DiscountType,
  FeeAgreement,
  FeeAgreementDiscountDraft,
  FeeAgreementForm,
  FeeAgreementItemClassification,
  FeeAgreementItemDraft,
  FeeItem,
  PaymentPlan,
  ValidationErrors,
} from './features/fee-agreements/types'
```

Replace the existing `agreementPreview(feeAgreementForm)` call with `agreementTotals(feeAgreementForm)`.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/feeAgreementEditorModel.test.ts
npm run build
```

Expected: model tests PASS and the TypeScript production build succeeds.

- [ ] **Step 7: Commit Task 1**

```powershell
git add frontend/src/App.tsx frontend/src/features/fee-agreements/types.ts frontend/src/features/fee-agreements/feeAgreementEditorModel.ts frontend/src/features/fee-agreements/feeAgreementEditorModel.test.ts
git commit -m "refactor: extract fee agreement editor model"
```

---

### Task 2: Build the PC-First Editor Shell and Review Panel

**Files:**
- Create: `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`
- Create: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Create: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Create: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`

**Interfaces:**
- Consumes: `agreementTotals`, `getAgreementChanges`, Fee Agreement shared types.
- Produces: controlled `FeeAgreementEditor` with `mode`, `form`, `errors`, `currentAgreement`, and `onChange`.
- Produces: `AgreementReviewPanel` with Create summary or Supersede comparison.

- [ ] **Step 1: Write failing shell tests**

Create `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx` with a reusable controlled harness:

```tsx
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FeeAgreementEditor } from './FeeAgreementEditor'
import type { FeeAgreement, FeeAgreementForm } from './types'

const initialForm: FeeAgreementForm = {
  academic_year: '2026',
  payment_plan: 'monthly',
  effective_from: '2026-01-01',
  effective_to: '',
  remarks: '',
  items: [
    {
      fee_item_id: 1,
      code: 'TUITION',
      name: 'Tuition Fee',
      enabled: true,
      amount: '800',
      description: '',
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: [],
      requires_preview_confirmation: false,
    },
    {
      fee_item_id: 2,
      code: 'MISC',
      name: 'Misc Fee',
      enabled: true,
      amount: '90',
      description: '',
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: [],
      requires_preview_confirmation: false,
    },
  ],
  discount: {
    enabled: false,
    discount_label: '',
    discount_type: 'fixed_amount',
    scope: 'total_payable',
    value: '',
    remark: '',
    selected_fee_codes: [],
  },
}

const currentAgreement: FeeAgreement = {
  id: 10,
  academic_year: '2026',
  version_no: 1,
  payment_plan: 'monthly',
  effective_from: '2026-01-01',
  effective_to: null,
  is_current: true,
  status: 'active',
  remarks: null,
  items: initialForm.items.filter((item) => item.enabled).map((item, index) => ({
    id: index + 1,
    fee_item_id: item.fee_item_id,
    fee_code: item.code,
    fee_category: 'mandatory',
    description: item.name,
    amount: Number(item.amount),
    is_mandatory: true,
    classification: item.classification,
    billing_frequency: item.billing_frequency,
    billing_months: item.billing_months,
    requires_preview_confirmation: item.requires_preview_confirmation,
  })),
  discounts: [],
}

function EditorHarness() {
  const [form, setForm] = useState(initialForm)

  return (
    <FeeAgreementEditor
      mode="create"
      form={form}
      errors={undefined}
      currentAgreement={null}
      onChange={setForm}
    />
  )
}

describe('FeeAgreementEditor', () => {
  it('shows agreement details and a persistent desktop summary', () => {
    render(<EditorHarness />)

    expect(screen.getByLabelText('Academic Year')).toHaveValue('2026')
    expect(screen.getByRole('heading', { name: 'Core fees' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Agreement Summary' })).toBeInTheDocument()
    expect(screen.getByText('RM 890')).toBeInTheDocument()
  })

  it('updates the summary total when the amount changes', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.clear(screen.getByLabelText('Tuition Fee amount'))
    await user.type(screen.getByLabelText('Tuition Fee amount'), '850')

    expect(screen.getByText('RM 940')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: FAIL because `FeeAgreementEditor` does not exist.

- [ ] **Step 3: Implement AgreementReviewPanel**

Create `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`:

```tsx
import { agreementTotals, getAgreementChanges } from './feeAgreementEditorModel'
import type { FeeAgreement, FeeAgreementForm } from './types'

function currency(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(value).replace('MYR', 'RM')
}

export function AgreementReviewPanel({
  mode,
  form,
  currentAgreement,
  errorCount,
}: {
  mode: 'create' | 'supersede'
  form: FeeAgreementForm
  currentAgreement: FeeAgreement | null
  errorCount: number
}) {
  const totals = agreementTotals(form)
  const enabledItems = form.items.filter((item) => item.enabled)
  const changes = mode === 'supersede' && currentAgreement ? getAgreementChanges(currentAgreement, form) : []

  return (
    <aside
      className="agreement-review-panel"
      aria-label={mode === 'create' ? 'Agreement Summary' : `Changes from v${currentAgreement?.version_no ?? ''}`}
    >
      <p className="eyebrow">{mode === 'create' ? 'Agreement Summary' : `Changes from v${currentAgreement?.version_no}`}</p>
      <dl className="agreement-review-totals">
        <div><dt>Subtotal</dt><dd>{currency(totals.subtotal)}</dd></div>
        <div><dt>Discount</dt><dd>− {currency(totals.discountAmount)}</dd></div>
        <div className="agreement-review-total"><dt>Preview total</dt><dd>{currency(totals.total)}</dd></div>
      </dl>
      <div className="agreement-review-meta">
        <span>{form.effective_from}{form.effective_to ? ` to ${form.effective_to}` : ' onward'}</span>
        <span>{enabledItems.map((item) => item.name).join(', ')}</span>
      </div>
      {errorCount > 0 && <p className="agreement-review-warning">{errorCount} area{errorCount === 1 ? '' : 's'} need attention.</p>}
      {mode === 'supersede' && (
        <div className="agreement-change-list">
          {changes.length > 0 ? (
            changes.map((change) => <p key={change.key}>{change.message}</p>)
          ) : (
            <p>No fee configuration changes.</p>
          )}
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 4: Implement the controlled editor shell**

Create `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx` with:

```tsx
import { AgreementReviewPanel } from './AgreementReviewPanel'
import type { FeeAgreement, FeeAgreementForm, PaymentPlan, ValidationErrors } from './types'
import './FeeAgreementEditor.css'

const paymentPlans: Array<{ value: PaymentPlan; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
]

export function FeeAgreementEditor({
  mode,
  form,
  errors,
  currentAgreement,
  onChange,
}: {
  mode: 'create' | 'supersede'
  form: FeeAgreementForm
  errors: ValidationErrors | undefined
  currentAgreement: FeeAgreement | null
  onChange: (form: FeeAgreementForm) => void
}) {
  const update = <Key extends keyof FeeAgreementForm>(key: Key, value: FeeAgreementForm[Key]) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="fee-agreement-editor">
      <main className="fee-agreement-editor-main">
        {mode === 'supersede' && currentAgreement && (
          <div className="agreement-version-context">
            <strong>Creating a new version from v{currentAgreement.version_no}</strong>
            <span>The current agreement stays in version history.</span>
          </div>
        )}
        <section className="agreement-editor-section" aria-labelledby="agreement-details-title">
          <div className="agreement-section-heading">
            <div>
              <p className="eyebrow">Agreement</p>
              <h3 id="agreement-details-title">Details</h3>
            </div>
          </div>
          <div className="agreement-details-grid">
            {mode === 'create' && (
              <label className="form-field">
                Academic Year
                <input value={form.academic_year} onChange={(event) => update('academic_year', event.target.value)} />
                {errors?.academic_year?.[0] && <small>{errors.academic_year[0]}</small>}
              </label>
            )}
            <label className="form-field">
              Payment Plan
              <select value={form.payment_plan} onChange={(event) => update('payment_plan', event.target.value as PaymentPlan)}>
                {paymentPlans.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="form-field">
              Effective From
              <input type="date" value={form.effective_from} onChange={(event) => update('effective_from', event.target.value)} />
              {errors?.effective_from?.[0] && <small>{errors.effective_from[0]}</small>}
            </label>
            <label className="form-field">
              Effective To
              <input type="date" value={form.effective_to} onChange={(event) => update('effective_to', event.target.value)} />
            </label>
            <label className="form-field agreement-remarks-field">
              Agreement Remarks
              <textarea rows={2} value={form.remarks} onChange={(event) => update('remarks', event.target.value)} />
            </label>
          </div>
        </section>
        <section className="agreement-editor-section" aria-labelledby="core-fees-title">
          <div className="agreement-section-heading">
            <div><p className="eyebrow">Required</p><h3 id="core-fees-title">Core fees</h3></div>
            <span>Review the amount; open a fee only for advanced settings.</span>
          </div>
          <div data-testid="core-fee-rows">
            {form.items.filter((item) => ['TUITION', 'MISC'].includes(item.code)).map((item) => (
              <label className="fee-row-shell" key={item.fee_item_id}>
                <span>{item.name}</span>
                <span className="fee-row-summary-copy">Monthly · Every month · No preview required</span>
                <input
                  aria-label={`${item.name} amount`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.amount}
                  onChange={(event) => onChange({
                    ...form,
                    items: form.items.map((candidate) =>
                      candidate.fee_item_id === item.fee_item_id ? { ...candidate, amount: event.target.value } : candidate,
                    ),
                  })}
                />
              </label>
            ))}
          </div>
        </section>
      </main>
      <AgreementReviewPanel
        mode={mode}
        form={form}
        currentAgreement={currentAgreement}
        errorCount={Object.keys(errors ?? {}).length}
      />
    </div>
  )
}
```

The temporary shell fee row is deliberately minimal for Task 2 and is replaced by `FeeItemRow` in Task 3. It is not shipped as the final implementation.

- [ ] **Step 5: Add the PC-first shell CSS**

Create `frontend/src/features/fee-agreements/FeeAgreementEditor.css`:

```css
.fee-agreement-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;
}

.fee-agreement-editor-main,
.agreement-editor-section,
.agreement-details-grid {
  min-width: 0;
}

.fee-agreement-editor-main {
  display: grid;
  gap: 16px;
}

.agreement-editor-section,
.agreement-review-panel,
.agreement-version-context {
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #ffffff;
}

.agreement-editor-section {
  padding: 16px;
}

.agreement-section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.agreement-section-heading h3 {
  margin: 2px 0 0;
  font-size: 17px;
}

.agreement-section-heading > span {
  color: #737782;
  font-size: 13px;
}

.agreement-details-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.agreement-remarks-field {
  grid-column: 1 / -1;
}

.agreement-remarks-field textarea {
  min-height: 72px;
}

.agreement-version-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fff8e8;
  color: #704b00;
}

.agreement-version-context span {
  font-size: 13px;
}

.agreement-review-panel {
  position: sticky;
  top: 0;
  display: grid;
  gap: 16px;
  padding: 16px;
}

.agreement-review-totals {
  display: grid;
  gap: 10px;
  margin: 0;
}

.agreement-review-totals div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.agreement-review-totals dt,
.agreement-review-totals dd {
  margin: 0;
}

.agreement-review-total {
  border-top: 1px solid #e4e7ed;
  padding-top: 12px;
  font-size: 18px;
  font-weight: 900;
}

.agreement-review-meta,
.agreement-change-list {
  display: grid;
  gap: 8px;
  color: #565b66;
  font-size: 13px;
}

.agreement-change-list p,
.agreement-review-warning {
  margin: 0;
}

.agreement-review-warning {
  border-radius: 8px;
  background: #fff1d8;
  padding: 10px;
  color: #744500;
  font-weight: 800;
}

.fee-row-shell {
  display: grid;
  grid-template-columns: minmax(160px, 0.7fr) minmax(260px, 1.3fr) minmax(120px, 0.45fr);
  gap: 12px;
  align-items: center;
  border-top: 1px solid #edf0f4;
  padding: 12px 0;
}

.fee-row-shell:first-child {
  border-top: 0;
}

.fee-row-summary-copy {
  color: #737782;
  font-size: 13px;
}

@media screen and (max-width: 1100px) {
  .fee-agreement-editor {
    grid-template-columns: 1fr;
  }

  .agreement-review-panel {
    position: static;
  }
}

@media screen and (max-width: 767px) {
  .agreement-details-grid,
  .fee-row-shell {
    grid-template-columns: 1fr;
  }

  .agreement-version-context,
  .agreement-section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: both editor shell tests PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add frontend/src/features/fee-agreements/AgreementReviewPanel.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.css frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx
git commit -m "feat: add fee agreement editor shell"
```

---

### Task 3: Add Compact Fee Rows, Month Customization, and Optional Fees

**Files:**
- Create: `frontend/src/features/fee-agreements/FeeItemRow.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`

**Interfaces:**
- Consumes: `feeItemSummary`, `billingMonthSummary`, `monthShortLabels`.
- Produces: `FeeItemRow` with controlled expansion and updates.
- Produces: `BillingMonthSelector` with Every month, custom months, Select all, Clear, and Use every month.
- Produces: optional fee picker that adds disabled items without rendering them by default.

- [ ] **Step 1: Add failing interaction tests**

Append to `FeeAgreementEditor.test.tsx`:

```tsx
it('keeps advanced fee controls collapsed until Edit is selected', async () => {
  const user = userEvent.setup()
  render(<EditorHarness />)

  expect(screen.queryByLabelText('Tuition Fee Charge Type')).not.toBeInTheDocument()
  expect(screen.getByText('Monthly · Every month · No preview required')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Edit Tuition Fee' }))

  expect(screen.getByLabelText('Tuition Fee Charge Type')).toBeInTheDocument()
  expect(screen.getByLabelText('Tuition Fee Billing Pattern')).toBeInTheDocument()
})

it('reveals month controls only after Customize months', async () => {
  const user = userEvent.setup()
  render(<EditorHarness />)

  await user.click(screen.getByRole('button', { name: 'Edit Tuition Fee' }))
  expect(screen.queryByRole('checkbox', { name: 'Jan' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Customize Tuition Fee months' }))
  expect(screen.getByRole('checkbox', { name: 'Jan' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Select all Tuition Fee months' }))
  expect(screen.getByRole('checkbox', { name: 'Jan' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Dec' })).toBeChecked()

  await user.click(screen.getByRole('button', { name: 'Use every month for Tuition Fee' }))
  expect(screen.queryByRole('checkbox', { name: 'Jan' })).not.toBeInTheDocument()
  expect(screen.getByText('Monthly · Every month · No preview required')).toBeInTheDocument()
})

it('adds an optional fee only when the user chooses it', async () => {
  const user = userEvent.setup()
  render(<EditorHarness />)

  expect(screen.queryByText('Transport')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add optional fee' }))
  await user.click(screen.getByRole('button', { name: 'Add Transport' }))

  expect(screen.getByText('Transport')).toBeInTheDocument()
  expect(screen.getByLabelText('Transport Charge Type')).toBeInTheDocument()
})
```

Extend the harness form with a disabled Transport draft so the optional picker has a candidate:

```ts
{
  fee_item_id: 3,
  code: 'TRANSPORT',
  name: 'Transport',
  enabled: false,
  amount: '120',
  description: '',
  classification: 'optional_service',
  billing_frequency: 'monthly',
  billing_months: [],
  requires_preview_confirmation: false,
}
```

- [ ] **Step 2: Run the interaction tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: FAIL because Edit, month customization, and optional fee controls are absent.

- [ ] **Step 3: Implement FeeItemRow and BillingMonthSelector**

Create `frontend/src/features/fee-agreements/FeeItemRow.tsx`. The component must:

```tsx
import type { BillingFrequency, FeeAgreementItemClassification, FeeAgreementItemDraft } from './types'
import { feeItemSummary, monthShortLabels } from './feeAgreementEditorModel'

const chargeTypes: Array<{ value: FeeAgreementItemClassification; label: string }> = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'optional_service', label: 'Optional Service' },
  { value: 'one_time', label: 'One-time' },
  { value: 'manual', label: 'Manual' },
]

const billingPatterns: Array<{ value: BillingFrequency; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
  { value: 'one_time', label: 'One-time' },
]

function BillingMonthSelector({
  item,
  error,
  onChange,
}: {
  item: FeeAgreementItemDraft
  error?: string
  onChange: (item: FeeAgreementItemDraft) => void
}) {
  const isEveryMonth = item.billing_frequency === 'monthly' && item.billing_months.length === 0
  const isCustomizing = !isEveryMonth || item.billing_frequency === 'custom'

  if (!isCustomizing) {
    return (
      <div className="billing-month-summary">
        <span>Every month</span>
        <button type="button" className="link-button" onClick={() => onChange({ ...item, billing_months: [1] })} aria-label={`Customize ${item.name} months`}>
          Customize months
        </button>
      </div>
    )
  }

  const setAll = () => onChange({ ...item, billing_months: monthShortLabels.map((_, index) => index + 1) })
  const clear = () => onChange({ ...item, billing_months: [] })

  return (
    <div className="billing-month-selector">
      <div className="billing-month-actions">
        <span>Billing months</span>
        <button type="button" className="link-button" onClick={setAll} aria-label={`Select all ${item.name} months`}>Select all</button>
        <button type="button" className="link-button" onClick={clear} aria-label={`Clear ${item.name} months`}>Clear</button>
        {item.billing_frequency === 'monthly' && (
          <button type="button" className="link-button" onClick={clear} aria-label={`Use every month for ${item.name}`}>Use every month</button>
        )}
      </div>
      <div className="billing-month-options">
        {monthShortLabels.map((label, index) => {
          const month = index + 1
          const checked = item.billing_months.includes(month)
          return (
            <label className={checked ? 'selected' : ''} key={label}>
              <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                onChange={() => onChange({
                  ...item,
                  billing_months: checked
                    ? item.billing_months.filter((value) => value !== month)
                    : [...item.billing_months, month].sort((left, right) => left - right),
                })}
              />
              {label}
            </label>
          )
        })}
      </div>
      {error && <small className="field-error">{error}</small>}
    </div>
  )
}

export function FeeItemRow({
  item,
  expanded,
  mandatory,
  monthError,
  onToggle,
  onChange,
  onRemove,
}: {
  item: FeeAgreementItemDraft
  expanded: boolean
  mandatory: boolean
  monthError?: string
  onToggle: () => void
  onChange: (item: FeeAgreementItemDraft) => void
  onRemove?: () => void
}) {
  const updateBillingFrequency = (frequency: BillingFrequency) => {
    onChange({
      ...item,
      billing_frequency: frequency,
      billing_months: frequency === 'monthly' ? [] : item.billing_months,
    })
  }

  return (
    <article className={`fee-item-row ${expanded ? 'expanded' : ''}`}>
      <div className="fee-item-row-summary">
        <div className="fee-item-identity">
          <strong>{item.name}</strong>
          <span>{mandatory ? 'Required' : 'Optional'}</span>
        </div>
        <span className="fee-item-summary-copy">{feeItemSummary(item)}</span>
        <label className="fee-item-amount">
          <span>{item.name} amount</span>
          <input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => onChange({ ...item, amount: event.target.value })} aria-label={`${item.name} amount`} />
        </label>
        <div className="fee-item-row-actions">
          {!mandatory && onRemove && <button type="button" className="link-button danger" onClick={onRemove}>Remove</button>}
          <button type="button" className="secondary-action compact" aria-expanded={expanded} aria-label={`${expanded ? 'Close' : 'Edit'} ${item.name}`} onClick={onToggle}>
            {expanded ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="fee-item-advanced">
          <label className="form-field">
            Charge Type
            <select aria-label={`${item.name} Charge Type`} value={item.classification} onChange={(event) => onChange({ ...item, classification: event.target.value as FeeAgreementItemClassification })}>
              {chargeTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small>How this fee is categorized on the agreement.</small>
          </label>
          <label className="form-field">
            Billing Pattern
            <select aria-label={`${item.name} Billing Pattern`} value={item.billing_frequency} onChange={(event) => updateBillingFrequency(event.target.value as BillingFrequency)}>
              {billingPatterns.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small>How often this fee creates charges.</small>
          </label>
          <label className="checkbox-line preview-confirmation-control">
            <input type="checkbox" checked={item.requires_preview_confirmation} onChange={(event) => onChange({ ...item, requires_preview_confirmation: event.target.checked })} />
            Require confirmation before charges are created
          </label>
          <BillingMonthSelector item={item} error={monthError} onChange={onChange} />
        </div>
      )}
    </article>
  )
}
```

Before GREEN, adjust `Customize months` to set `[1]` only as the minimum visible transition; the user can then Select all or choose months. Ensure `Custom` automatically displays the selector even with no months.

- [ ] **Step 4: Replace placeholder rows and add optional picker**

In `FeeAgreementEditor.tsx`:

- Track `expandedFeeItemId` with `useState<number | null>(null)`.
- Derive core, enabled optional, and disabled optional items.
- Render `FeeItemRow` for core and enabled optional items.
- Use enabled-item indexes when mapping server error keys.
- Add an `Add optional fee` disclosure with a text filter and one `Add {name}` button per matching disabled item.
- When adding an optional item, set `enabled: true`, update the form, and set it as the expanded row.
- When removing an optional item, set `enabled: false`, clear its expanded state, and return it to the picker.

Use this single update helper:

```ts
const updateItem = (nextItem: FeeAgreementItemDraft) => {
  onChange({
    ...form,
    items: form.items.map((item) => item.fee_item_id === nextItem.fee_item_id ? nextItem : item),
  })
}
```

- [ ] **Step 5: Replace placeholder CSS with compact row styles**

Add or replace rules in `FeeAgreementEditor.css` for:

```css
.fee-item-list {
  display: grid;
  gap: 8px;
}

.fee-item-row {
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #ffffff;
}

.fee-item-row-summary {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(240px, 1.2fr) minmax(120px, 0.45fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.fee-item-identity,
.fee-item-amount,
.fee-item-row-actions,
.billing-month-summary,
.billing-month-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fee-item-identity {
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
}

.fee-item-identity span,
.fee-item-summary-copy,
.fee-item-amount span,
.fee-item-advanced .form-field small {
  color: #737782;
  font-size: 12px;
}

.fee-item-amount {
  align-items: stretch;
  flex-direction: column;
  gap: 4px;
}

.fee-item-amount input {
  min-height: 40px;
}

.fee-item-row-actions {
  justify-content: flex-end;
}

.fee-item-advanced {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border-top: 1px solid #edf0f4;
  padding: 14px;
  background: #fbfbfc;
}

.preview-confirmation-control,
.billing-month-selector {
  grid-column: 1 / -1;
}

.billing-month-summary,
.billing-month-actions {
  justify-content: space-between;
  flex-wrap: wrap;
}

.optional-fee-picker {
  display: grid;
  gap: 10px;
}

.optional-fee-results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.optional-fee-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
}

@media screen and (max-width: 900px) {
  .fee-item-row-summary,
  .fee-item-advanced,
  .optional-fee-results {
    grid-template-columns: 1fr;
  }

  .fee-item-row-actions {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: compact-row, month, and optional-fee tests PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add frontend/src/features/fee-agreements/FeeItemRow.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.css frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx
git commit -m "feat: streamline fee agreement item editing"
```

---

### Task 4: Add Discount Disclosure, Supersede Review, and Validation Recovery

**Files:**
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`

**Interfaces:**
- Consumes: `getAgreementChanges`, `ValidationErrors`.
- Produces: collapsed `No manual discount` disclosure.
- Produces: Supersede change list and effective-date context.
- Produces: automatic expansion and focus of the first section containing an error.

- [ ] **Step 1: Add failing discount, Supersede, and error-recovery tests**

Add tests that render dedicated harnesses:

```tsx
it('keeps manual discount collapsed and updates the review total when enabled', async () => {
  const user = userEvent.setup()
  render(<EditorHarness />)

  expect(screen.getByText('No manual discount')).toBeInTheDocument()
  expect(screen.queryByLabelText('Discount Value')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Configure manual discount' }))
  await user.click(screen.getByLabelText('Enable manual discount'))
  await user.type(screen.getByLabelText('Discount Value'), '40')

  expect(screen.getByText('RM 850')).toBeInTheDocument()
})

it('shows plain-language Supersede changes', async () => {
  const form = structuredClone(initialForm)
  form.items[0].amount = '850'
  render(
    <FeeAgreementEditor
      mode="supersede"
      form={form}
      errors={undefined}
      currentAgreement={currentAgreement}
      onChange={() => undefined}
    />,
  )

  expect(screen.getByRole('complementary', { name: 'Changes from v1' })).toHaveTextContent('Tuition Fee: RM 800 → RM 850')
})

it('opens and focuses the first fee with a validation error', () => {
  render(
    <FeeAgreementEditor
      mode="create"
      form={initialForm}
      errors={{ 'items.0.billing_months': ['Choose at least one billing month.'] }}
      currentAgreement={null}
      onChange={() => undefined}
    />,
  )

  expect(screen.getByLabelText('Tuition Fee Billing Pattern')).toBeInTheDocument()
  expect(screen.getByText('Choose at least one billing month.')).toBeInTheDocument()
  expect(screen.getByLabelText('Tuition Fee Billing Pattern')).toHaveFocus()
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: FAIL because discount disclosure and error-driven focus are missing.

- [ ] **Step 3: Add the controlled discount disclosure**

In `FeeAgreementEditor.tsx`, add `discountExpanded` state and a section that:

- Summarizes to `No manual discount` or the configured label/value.
- Uses a unique `Configure manual discount` button.
- Includes an `Enable manual discount` checkbox.
- Renders existing Discount Label, Discount Type, Scope, Value, Remark, and selected fee code controls only when enabled.
- Updates the complete `form.discount` object through `onChange`.
- Opens automatically when any error key begins with `discounts.`.

Use visible labels exactly as the existing workflow uses so payload semantics stay unchanged.

- [ ] **Step 4: Add validation-driven expansion and focus**

In `FeeAgreementEditor.tsx`:

```tsx
const firstErrorKey = Object.keys(errors ?? {})[0]

useEffect(() => {
  if (!firstErrorKey) {
    return
  }

  const itemMatch = /^items\.(\d+)\./.exec(firstErrorKey)
  if (itemMatch) {
    const enabledItems = form.items.filter((item) => item.enabled)
    const item = enabledItems[Number(itemMatch[1])]
    if (item) {
      setExpandedFeeItemId(item.fee_item_id)
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-fee-item-id="${item.fee_item_id}"] select`)?.focus()
      })
    }
    return
  }

  if (firstErrorKey.startsWith('discounts.')) {
    setDiscountExpanded(true)
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-discount-editor] input, [data-discount-editor] select')?.focus()
    })
  }
}, [errors, firstErrorKey, form.items])
```

Add `data-fee-item-id` to the fee row root and `data-discount-editor` to the expanded discount container. Do not move focus for normal rendering.

- [ ] **Step 5: Improve Supersede review grouping**

Update `AgreementReviewPanel` so date changes are shown in a `Coverage` subsection and fee/discount changes appear under `Fee configuration`. When no fee or discount change exists, show `No fee configuration changes.` while still displaying effective-date changes.

- [ ] **Step 6: Add discount and validation CSS**

Add focused styles:

```css
.agreement-discount-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agreement-discount-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
  border-top: 1px solid #edf0f4;
  padding-top: 14px;
}

.agreement-discount-editor .wide,
.discount-enable-row {
  grid-column: 1 / -1;
}

.field-error {
  color: #a51d27;
  font-weight: 800;
}

.fee-item-row:has(.field-error) {
  border-color: #d0343d;
  box-shadow: 0 0 0 2px rgb(208 52 61 / 10%);
}

@media screen and (max-width: 767px) {
  .agreement-discount-editor {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx
```

Expected: discount, Supersede, and validation recovery tests PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/AgreementReviewPanel.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.css frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx
git commit -m "feat: clarify fee agreement review and errors"
```

---

### Task 5: Integrate the Editor into Student Create and Supersede Workflows

**Files:**
- Modify: `frontend/src/App.tsx:1040-1075`
- Modify: `frontend/src/App.tsx:1769-1792`
- Modify: `frontend/src/App.tsx:1820-1885`
- Modify: `frontend/src/App.tsx:2748-3059`
- Modify: `frontend/src/App.test.tsx:590-650`
- Modify: `frontend/src/App.css:1132-1417`

**Interfaces:**
- Consumes: `FeeAgreementEditor`, `isFeeAgreementFormDirty`, `validateFeeAgreementBillingConfig`.
- Keeps: current API request construction and response handling.
- Produces: shared close handler for Cancel, close icon, Escape, and successful submission.

- [ ] **Step 1: Add failing App integration tests**

Extend `frontend/src/App.test.tsx`:

```tsx
it('uses the compact editor for Create and preserves the request payload', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

  expect(screen.getByRole('complementary', { name: 'Agreement Summary' })).toBeInTheDocument()
  expect(screen.getByText('Monthly · Every month · No preview required')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

  const request = vi.mocked(globalThis.fetch).mock.calls.find(([input, init]) =>
    String(input).endsWith('/students/1/fee-agreements') && init?.method === 'POST',
  )
  expect(request).toBeDefined()
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    academic_year: '2026',
    payment_plan: 'monthly',
    items: [
      { fee_item_id: 1, billing_frequency: 'monthly', billing_months: null },
      { fee_item_id: 2, billing_frequency: 'monthly', billing_months: null },
    ],
    discounts: [],
  })
})

it('asks before closing a dirty agreement but closes a clean agreement immediately', async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(confirm).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: 'Create Fee Agreement' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
  await user.clear(screen.getByLabelText('Tuition Fee amount'))
  await user.type(screen.getByLabelText('Tuition Fee amount'), '850')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(confirm).toHaveBeenCalledWith('Discard your unsaved Fee Agreement changes?')
  expect(screen.getByRole('dialog', { name: 'Create Fee Agreement' })).toBeInTheDocument()
})
```

Update the existing shared-modal test to expect primary labels `Create Agreement` and `Supersede Agreement`.

- [ ] **Step 2: Run the App tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/App.test.tsx -t "Fee Agreement|financial workflows|dirty agreement"
```

Expected: FAIL because the old expanded editor remains and close does not check dirty state.

- [ ] **Step 3: Capture the initial draft and centralize close behavior**

In `App.tsx`, add:

```tsx
const [initialFeeAgreementForm, setInitialFeeAgreementForm] = useState<FeeAgreementForm>(() => defaultAgreementForm([]))

const openFeeAgreementEditor = (mode: 'create' | 'supersede', nextForm: FeeAgreementForm) => {
  setFeeAgreementMode(mode)
  setFeeAgreementForm(nextForm)
  setInitialFeeAgreementForm(structuredClone(nextForm))
  setFeeAgreementErrors(undefined)
  setShowFeeAgreementForm(true)
}

const closeFeeAgreementEditor = (force = false) => {
  if (
    !force &&
    isFeeAgreementFormDirty(feeAgreementForm, initialFeeAgreementForm) &&
    !window.confirm('Discard your unsaved Fee Agreement changes?')
  ) {
    return
  }

  setShowFeeAgreementForm(false)
  setFeeAgreementErrors(undefined)
}
```

Replace `beginCreateFeeAgreement` and `beginSupersedeFeeAgreement` bodies with calls to `openFeeAgreementEditor`.

Use `closeFeeAgreementEditor()` for `ModalFrame.onClose` and Cancel. Use `closeFeeAgreementEditor(true)` after a successful API response so a saved draft never triggers discard confirmation.

- [ ] **Step 4: Replace the old form body with FeeAgreementEditor**

Import:

```ts
import { FeeAgreementEditor } from './features/fee-agreements/FeeAgreementEditor'
import { isFeeAgreementFormDirty } from './features/fee-agreements/feeAgreementEditorModel'
```

Replace the old agreement-details, item, discount, and preview JSX inside the modal with:

```tsx
<form id="fee-agreement-form" className="agreement-form" onSubmit={submitFeeAgreement}>
  {formatValidationError(feeAgreementErrors, 'items') && (
    <Message tone="error">{formatValidationError(feeAgreementErrors, 'items')}</Message>
  )}
  <FeeAgreementEditor
    mode={feeAgreementMode}
    form={feeAgreementForm}
    errors={feeAgreementErrors}
    currentAgreement={currentFeeAgreement}
    onChange={setFeeAgreementForm}
  />
</form>
```

Change the modal description:

- Create: `Set the agreement dates, review the core fees, and add optional fees only when needed.`
- Supersede: `Create a new version and review every change before it takes effect.`

Change the primary labels to `Create Agreement` and `Supersede Agreement`.

- [ ] **Step 5: Keep validation indexes aligned with enabled items**

Call:

```ts
const enabledItems = feeAgreementForm.items.filter((item) => item.enabled)
const billingErrors = validateFeeAgreementBillingConfig(enabledItems)
```

Keep request construction unchanged so empty monthly months submit as `null`. Do not move API calls into the editor.

- [ ] **Step 6: Remove superseded editor CSS**

From `App.css`, remove rules now owned by `FeeAgreementEditor.css`:

- `.agreement-form` from the grouped bordered-card rule, while keeping `.discount-editor` only if another workflow still uses it.
- `.agreement-items-grid`
- `.agreement-item-row`
- `.agreement-item-main`
- `.agreement-billing-config`
- `.billing-month-selector`
- `.billing-month-options`
- `.agreement-preview`
- their now-unused responsive overrides

Keep `.agreement-billing-summary`, `.agreement-billing-chip`, `.agreement-current`, and agreement history styles because they remain on Student detail outside the modal.

Change `.financial-modal` to:

```css
.financial-modal {
  width: min(1180px, 100%);
}
```

- [ ] **Step 7: Run focused App and editor tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/fee-agreements/feeAgreementEditorModel.test.ts src/features/fee-agreements/FeeAgreementEditor.test.tsx
npm test -- src/App.test.tsx -t "Fee Agreement|financial workflows|dirty agreement"
```

Expected: focused feature and integration tests PASS.

- [ ] **Step 8: Commit Task 5**

```powershell
git add frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx frontend/src/features/fee-agreements
git commit -m "feat: integrate streamlined fee agreement editor"
```

---

### Task 6: Verify Responsive Behavior and the Complete Frontend

**Files:**
- Modify if verification finds a defect: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Modify if verification finds a behavioral defect: the smallest directly responsible Fee Agreement component and its focused test.

**Interfaces:**
- Consumes: completed editor and Student integration.
- Produces: verified Create and Supersede workflows at desktop, narrower desktop, and mobile fallback.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

Expected:

- Vitest exits `0` with no failed tests.
- oxlint exits `0`.
- TypeScript and Vite production build exit `0`.

- [ ] **Step 2: Rebuild the public-demo assets**

The running Vite preview serves `frontend/dist`, so the successful production build from Step 1 makes the current tunnel serve the new editor without changing the tunnel URL.

Verify local preview:

```powershell
curl.exe -sS -o NUL -w '%{http_code}' --max-time 15 http://127.0.0.1:4175/
```

Expected: `200`.

- [ ] **Step 3: Verify Create on wide desktop**

At a desktop viewport around `1440 × 900`:

1. Open Students.
2. Open a student.
3. Open Create Agreement.
4. Confirm details and core fees are visible without scrolling.
5. Confirm Tuition and Misc are compact and read `Every month`.
6. Confirm the Agreement Summary remains visible beside the editor.
7. Change Tuition amount and confirm Preview total updates immediately.
8. Expand Tuition, customize months, select all, then return to Every month.
9. Add and remove one optional fee.
10. Enable and disable Manual Discount.
11. Cancel and confirm dirty-state protection appears.

Capture a screenshot for comparison with the user's original Create screenshot.

- [ ] **Step 4: Verify Supersede on wide desktop**

1. Open Supersede Current.
2. Confirm the version context banner names the current version.
3. Change one amount.
4. Change one month schedule.
5. Add an optional fee if available.
6. Confirm the right panel lists each change in plain language.
7. Confirm unchanged fee configuration is not listed.
8. Confirm the primary action reads `Supersede Agreement`.

Capture a screenshot for comparison with the user's original Supersede screenshot.

- [ ] **Step 5: Verify narrower and mobile fallback**

At approximately `1024 × 768`:

- Confirm the review panel moves below the editor.
- Confirm fee rows do not overflow horizontally.

At approximately `390 × 844`:

- Confirm the modal is near full height.
- Confirm fields and fee rows stack into one column.
- Confirm all actions and month controls are at least `44px` high.
- Confirm the footer actions remain reachable.

- [ ] **Step 6: Run console and accessibility checks**

For Create and Supersede:

- Confirm no new browser console errors.
- Tab through close, details, fee rows, months, optional fee controls, discount, Cancel, and submit.
- Confirm every interactive control has a visible focus state.
- Confirm Escape uses the same dirty-state protection as Cancel.
- Confirm the close button returns focus to the action that opened the modal.

- [ ] **Step 7: Apply only evidence-backed polish fixes**

If visual verification finds a defect:

1. Add or update the smallest focused test when behavior changes.
2. Verify the test fails for the observed defect.
3. Modify only the responsible Fee Agreement component or CSS rule.
4. Re-run the focused test and the affected viewport check.
5. Do not refactor unrelated Student or finance UI.

- [ ] **Step 8: Re-run final verification**

Run:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

Then verify:

```powershell
$url = (Get-Content -Raw '..\.demo-public\public-url.txt').Trim()
curl.exe -sS -o NUL -w '%{http_code}' --max-time 20 ($url + '/')
```

Expected: all frontend commands exit `0` and the public URL returns `200`.

- [ ] **Step 9: Commit final verified polish**

If Task 6 changed files:

```powershell
git add frontend/src/features/fee-agreements frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx
git commit -m "fix: polish fee agreement editor usability"
```

If Task 6 required no changes, do not create an empty commit.

---

## Completion Checklist

- [ ] Create and Supersede use the new editor.
- [ ] Tuition and Misc are compact by default.
- [ ] Monthly with no override reads `Every month`.
- [ ] Optional fees do not occupy the default screen.
- [ ] Manual Discount is collapsed by default.
- [ ] Supersede displays plain-language differences from the current version.
- [ ] Validation opens and focuses the relevant section.
- [ ] Dirty close confirmation covers Cancel, close, and Escape.
- [ ] Existing endpoints and payload shape are unchanged.
- [ ] Desktop is the primary layout; narrower and mobile views remain usable.
- [ ] Focused tests, full tests, lint, build, local preview, and public URL checks pass.
- [ ] User-owned untracked files remain untouched.
