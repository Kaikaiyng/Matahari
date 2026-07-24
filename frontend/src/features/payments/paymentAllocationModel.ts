export type FeeRecordCategory = 'SF+MF' | 'TR' | 'MP' | 'HS' | 'HT' | 'PAYMENT' | 'OTHERS'

export type OutstandingChargeCell = {
  id: number
  student_id: number
  fee_agreement_id: number
  fee_agreement_item_id: number | null
  fee_item_id: number | null
  academic_year: string
  billing_month: string
  fee_record_category: string
  fee_code: string | null
  description: string
  expected_amount: number
  paid_amount: number
  outstanding_amount: number
  billing_status: string
  collection_status: string
  charge_origin: string
  source_type: string | null
}

export type PaymentAllocationDraft = {
  key: string
  allocation_type: 'charge' | 'manual'
  fee_record_charge_id: number | null
  fee_item_id: number | null
  fee_agreement_item_id: number | null
  fee_code: string | null
  billing_month: string | null
  fee_record_category: string | null
  outstanding_amount: number | null
  description: string
  amount: string
}

export type OneTimeChargeDraft = {
  academic_year: string
  billing_month: string
  fee_record_category: FeeRecordCategory
  description: string
  expected_amount: string
  remark: string
}

export const feeRecordCategoryOptions: Array<{ value: FeeRecordCategory; label: string }> = [
  { value: 'SF+MF', label: 'SF+MF' },
  { value: 'TR', label: 'TR' },
  { value: 'MP', label: 'MP' },
  { value: 'HS', label: 'HS' },
  { value: 'HT', label: 'HT' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OTHERS', label: 'Others' },
]

let allocationDraftSequence = 0

function draftKey() {
  allocationDraftSequence += 1
  return `payment-allocation-${allocationDraftSequence}`
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

export function createOneTimeChargeDraft(
  academicYear: string,
  monthNumber = new Date().getMonth() + 1,
): OneTimeChargeDraft {
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
