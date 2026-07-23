export type PaymentPlan = 'monthly' | 'termly' | 'yearly'
export type AgreementPaymentPlan = PaymentPlan | 'custom'
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
  payment_plan: AgreementPaymentPlan
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
