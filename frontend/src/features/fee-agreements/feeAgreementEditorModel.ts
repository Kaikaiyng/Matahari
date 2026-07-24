import type {
  BillingFrequency,
  FeeAgreement,
  FeeAgreementForm,
  FeeAgreementItemDraft,
  ValidationErrors,
} from './types'

export const monthShortLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

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

function formatMoney(value: number) {
  return `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value)}`
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function billingMonthSummary(
  frequency: BillingFrequency | null,
  months: number[] | null | undefined,
) {
  const selected = [...(months ?? [])].sort((left, right) => left - right)

  if (frequency === 'monthly' && selected.length === 0) {
    return 'Every month'
  }

  if (selected.length === 0) {
    return 'Months not set'
  }

  return selected
    .map((month) => monthShortLabels[month - 1])
    .filter(Boolean)
    .join(', ')
}

export function feeItemSummary(item: FeeAgreementItemDraft) {
  const preview = item.requires_preview_confirmation ? 'Preview required' : 'No preview required'

  return `${formatLabel(item.billing_frequency)} · ${billingMonthSummary(item.billing_frequency, item.billing_months)} · ${preview}`
}

export function agreementTotals(form: FeeAgreementForm): AgreementTotals {
  const enabledItems = form.items.filter((item) => item.enabled)
  const subtotal = enabledItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const tuitionAmount = enabledItems
    .filter((item) => item.code === 'TUITION')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const selectedAmount = enabledItems
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

  if (current.payment_plan !== draft.payment_plan) {
    changes.push({
      key: 'payment_plan',
      kind: 'billing',
      message: `Payment plan: ${formatLabel(current.payment_plan)} → ${formatLabel(draft.payment_plan)}`,
    })
  }

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
    changes.push({
      key: 'effective_to',
      kind: 'date',
      message: `Effective to: ${currentEnd} → ${draftEnd}`,
    })
  }

  const currentItems = new Map(current.items.map((item) => [item.fee_code, item]))
  const draftItems = new Map(
    draft.items.filter((item) => item.enabled).map((item) => [item.code, item]),
  )
  const codes = [...new Set([...currentItems.keys(), ...draftItems.keys()])]

  for (const code of codes) {
    const before = currentItems.get(code)
    const after = draftItems.get(code)
    const name = after?.name ?? before?.description ?? code

    if (!before && after) {
      changes.push({
        key: `${code}:added`,
        kind: 'added',
        message: `${name} added at ${formatMoney(Number(after.amount || 0))}`,
      })
      continue
    }

    if (before && !after) {
      changes.push({
        key: `${code}:removed`,
        kind: 'removed',
        message: `${name} removed`,
      })
      continue
    }

    if (!before || !after) {
      continue
    }

    if (before.amount !== Number(after.amount || 0)) {
      changes.push({
        key: `${code}:amount`,
        kind: 'amount',
        message: `${name}: ${formatMoney(before.amount)} → ${formatMoney(Number(after.amount || 0))}`,
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

    if (before.classification !== after.classification) {
      changes.push({
        key: `${code}:classification`,
        kind: 'billing',
        message: `${name} charge type: ${formatLabel(before.classification ?? 'recurring')} → ${formatLabel(after.classification)}`,
      })
    }

    if (before.billing_frequency !== after.billing_frequency) {
      changes.push({
        key: `${code}:frequency`,
        kind: 'billing',
        message: `${name} billing pattern: ${formatLabel(before.billing_frequency ?? 'monthly')} → ${formatLabel(after.billing_frequency)}`,
      })
    }

    if (before.requires_preview_confirmation !== after.requires_preview_confirmation) {
      changes.push({
        key: `${code}:preview`,
        kind: 'billing',
        message: `${name} preview confirmation: ${before.requires_preview_confirmation ? 'Required' : 'Not required'} → ${after.requires_preview_confirmation ? 'Required' : 'Not required'}`,
      })
    }
  }

  const beforeDiscount = current.discounts[0]
    ? {
        discount_label: current.discounts[0].discount_label,
        discount_type: current.discounts[0].discount_type,
        scope: current.discounts[0].scope,
        value: String(current.discounts[0].value),
        remark: current.discounts[0].remark,
        selected_fee_codes: current.discounts[0].selected_fee_codes,
      }
    : null
  const afterDiscount = draft.discount.enabled ? draft.discount : null

  if (JSON.stringify(beforeDiscount) !== JSON.stringify(afterDiscount)) {
    changes.push({
      key: 'discount',
      kind: 'discount',
      message: afterDiscount
        ? `Manual discount updated to ${afterDiscount.value || '0'}`
        : 'Manual discount removed',
    })
  }

  return changes
}
