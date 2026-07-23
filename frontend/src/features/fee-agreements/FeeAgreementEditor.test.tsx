import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
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
  items: initialForm.items
    .filter((item) => item.enabled)
    .map((item, index) => ({
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

function EditorHarness({
  mode = 'create',
  form: suppliedForm = initialForm,
  agreement = null,
}: {
  mode?: 'create' | 'supersede'
  form?: FeeAgreementForm
  agreement?: FeeAgreement | null
}) {
  const [form, setForm] = useState(() => structuredClone(suppliedForm))

  return (
    <FeeAgreementEditor
      mode={mode}
      form={form}
      errors={undefined}
      currentAgreement={agreement}
      onChange={setForm}
    />
  )
}

describe('FeeAgreementEditor', () => {
  it('shows agreement details, compact core fees, and a persistent summary', () => {
    render(<EditorHarness />)

    expect(screen.getByLabelText('Academic Year')).toHaveValue('2026')
    expect(screen.getByRole('heading', { name: 'Core fees' })).toBeInTheDocument()
    expect(screen.getByText('Tuition Fee')).toBeInTheDocument()
    expect(screen.getByText('Misc Fee')).toBeInTheDocument()
    const review = screen.getByRole('complementary', { name: 'Agreement Summary' })
    expect(review).toBeInTheDocument()
    expect(within(review).getByText('Preview total').closest('div')).toHaveTextContent('RM 890')
  })

  it('updates the summary total when a common amount changes', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.clear(screen.getByLabelText('Tuition Fee amount'))
    await user.type(screen.getByLabelText('Tuition Fee amount'), '850')

    const review = screen.getByRole('complementary', { name: 'Agreement Summary' })
    expect(within(review).getByText('Preview total').closest('div')).toHaveTextContent('RM 940')
  })

  it('uses Supersede context and omits Academic Year editing', () => {
    render(<EditorHarness mode="supersede" agreement={currentAgreement} />)

    expect(screen.queryByLabelText('Academic Year')).not.toBeInTheDocument()
    expect(screen.getByText('Creating a new version from v1')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Changes from v1' })).toBeInTheDocument()
  })
})
