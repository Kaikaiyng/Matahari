import { describe, expect, it } from 'vitest'
import {
  agreementTotals,
  billingMonthSummary,
  feeItemSummary,
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

describe('feeAgreementEditorModel', () => {
  it('describes an empty monthly override as Every month', () => {
    expect(billingMonthSummary('monthly', [])).toBe('Every month')
  })

  it('formats selected months in calendar order', () => {
    expect(billingMonthSummary('custom', [6, 1, 3])).toBe('Jan, Mar, Jun')
  })

  it('builds a compact fee summary in plain language', () => {
    expect(feeItemSummary(baseForm.items[0])).toBe('Monthly · Every month · No preview required')
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

  it('requires months for custom billing using enabled-item indexes', () => {
    const form = structuredClone(baseForm)
    form.items[0].billing_frequency = 'custom'

    expect(validateFeeAgreementBillingConfig(form.items)).toEqual({
      'items.0.billing_months': ['Choose at least one billing month.'],
    })
  })

  it('requires exactly one month for one-time billing', () => {
    const form = structuredClone(baseForm)
    form.items[0].billing_frequency = 'one_time'

    expect(validateFeeAgreementBillingConfig(form.items)).toEqual({
      'items.0.billing_months': ['Choose exactly one billing month.'],
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

    expect(getAgreementChanges(currentAgreement, form).map((change) => change.message)).toEqual([
      'Tuition Fee: RM 800 → RM 850',
      'Misc Fee months: Every month → Jan, Feb, Mar, Apr, May, Jun',
      'Misc Fee billing pattern: Monthly → Custom',
      'Transport added at RM 120',
    ])
  })

  it('does not report unchanged configuration as a change', () => {
    expect(getAgreementChanges(currentAgreement, baseForm)).toEqual([])
  })

  it('calls out a legacy payment plan that must be normalized', () => {
    const legacyAgreement = {
      ...currentAgreement,
      payment_plan: 'custom',
    } as FeeAgreement

    expect(getAgreementChanges(legacyAgreement, baseForm).map((change) => change.message)).toContain(
      'Payment plan: Custom → Monthly',
    )
  })
})
