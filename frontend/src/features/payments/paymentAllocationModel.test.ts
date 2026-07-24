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
      hasIncompleteUnclassifiedAllocation([
        {
          ...allocation,
          description: 'Legacy receipt',
          amount: '25',
        },
      ]),
    ).toBe(false)
  })
})
