import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PaymentAllocationEditor, type PaymentAllocationEditorProps } from './PaymentAllocationEditor'
import {
  createOneTimeChargeDraft,
  createUnclassifiedAllocation,
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

function editorProps(overrides: Partial<PaymentAllocationEditorProps> = {}): PaymentAllocationEditorProps {
  return {
    academicYear: '2026',
    paymentAmount: 0,
    allocationTotal: 0,
    allocations: [],
    outstandingCharges: [uniformCharge],
    isLoadingOutstandingCharges: false,
    outstandingChargeError: '',
    canAddOneTimeCharge: true,
    isOneTimeChargeOpen: false,
    oneTimeCharge: createOneTimeChargeDraft('2026', 7),
    oneTimeChargeNotice: '',
    isSavingOneTimeCharge: false,
    onRefresh: vi.fn(),
    onToggleCharge: vi.fn(),
    onUpdateAllocation: vi.fn(),
    onRemoveAllocation: vi.fn(),
    onOpenOneTimeCharge: vi.fn(),
    onCancelOneTimeCharge: vi.fn(),
    onUpdateOneTimeCharge: vi.fn(),
    onCreateOneTimeCharge: vi.fn(),
    onAddUnclassified: vi.fn(),
    afterAllocation: <div aria-label="Balance and details">Balanced</div>,
    ...overrides,
  }
}

describe('PaymentAllocationEditor', () => {
  it('guides users toward outstanding fees and hides the exception initially', async () => {
    const user = userEvent.setup()
    render(<PaymentAllocationEditor {...editorProps()} />)

    expect(screen.getByRole('heading', { name: 'Outstanding fees' })).toBeInTheDocument()
    expect(screen.getByText('Uniform – Sports T-shirt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add one-time charge' })).toBeInTheDocument()
    const advancedOptions = screen.getByText('Advanced options').closest('details')
    expect(advancedOptions).not.toBeNull()
    expect(advancedOptions).not.toHaveAttribute('open')

    await user.click(screen.getByText('Advanced options'))

    expect(advancedOptions).toHaveAttribute('open')
    expect(screen.getByText(/does not reduce the student’s outstanding balance/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record unclassified payment' })).toBeInTheDocument()
  })

  it('hides one-time charge creation without Fee Record management permission', () => {
    render(<PaymentAllocationEditor {...editorProps({ canAddOneTimeCharge: false })} />)

    expect(screen.queryByRole('button', { name: 'Add one-time charge' })).not.toBeInTheDocument()
  })

  it('renders balance/details after allocation and before advanced options', () => {
    render(<PaymentAllocationEditor {...editorProps()} />)

    const editor = screen.getByTestId('payment-allocation-editor')
    const outstanding = within(editor)
      .getByRole('heading', { name: 'Outstanding fees' })
      .closest('section')
    const allocation = within(editor)
      .getByRole('heading', { name: 'Payment allocation' })
      .closest('section')
    const post = within(editor).getByLabelText('Balance and details')
    const advanced = within(editor).getByText('Advanced options').closest('details')

    expect(editor.children[0]).toBe(outstanding)
    expect(editor.children[1]).toBe(allocation)
    expect(editor.children[2]).toContainElement(post)
    expect(editor.children[3]).toBe(advanced)
  })

  it('keeps the one-time action available in an empty outstanding state', () => {
    render(<PaymentAllocationEditor {...editorProps({ outstandingCharges: [] })} />)

    expect(screen.getByText('No outstanding fees found for 2026.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add one-time charge' })).toBeInTheDocument()
  })

  it('reports a selected outstanding fee through the toggle callback', async () => {
    const user = userEvent.setup()
    const onToggleCharge = vi.fn()
    render(<PaymentAllocationEditor {...editorProps({ onToggleCharge })} />)

    await user.click(screen.getByRole('checkbox', { name: /Uniform – Sports T-shirt/ }))

    expect(onToggleCharge).toHaveBeenCalledWith(uniformCharge, true)
  })

  it('edits and submits the compact one-time charge form', async () => {
    const user = userEvent.setup()
    const onUpdateOneTimeCharge = vi.fn()
    const onCreateOneTimeCharge = vi.fn()
    render(
      <PaymentAllocationEditor
        {...editorProps({
          isOneTimeChargeOpen: true,
          onUpdateOneTimeCharge,
          onCreateOneTimeCharge,
        })}
      />,
    )

    await user.type(screen.getByLabelText('One-time charge description'), 'CCA – Basketball')
    await user.type(screen.getByLabelText('One-time charge amount'), '120')
    await user.click(screen.getByRole('button', { name: 'Add and select charge' }))

    expect(onUpdateOneTimeCharge).toHaveBeenCalledWith('description', 'C')
    expect(onUpdateOneTimeCharge).toHaveBeenCalledWith('expected_amount', '1')
    expect(onCreateOneTimeCharge).toHaveBeenCalledOnce()
  })

  it('prevents another unclassified row while one is incomplete', async () => {
    const user = userEvent.setup()
    const allocation = createUnclassifiedAllocation()
    const onAddUnclassified = vi.fn()
    render(
      <PaymentAllocationEditor
        {...editorProps({
          allocations: [allocation],
          onAddUnclassified,
        })}
      />,
    )

    expect(screen.getAllByText('Unclassified payment')).not.toHaveLength(0)
    expect(screen.queryByText('Manual allocation')).not.toBeInTheDocument()

    await user.click(screen.getByText('Advanced options'))
    const advancedOptions = screen.getByText('Advanced options').closest('details')
    expect(advancedOptions).not.toBeNull()
    const addButton = within(advancedOptions!).getByRole('button', { name: 'Record unclassified payment' })

    expect(addButton).toBeDisabled()
    await user.click(addButton)
    expect(onAddUnclassified).not.toHaveBeenCalled()
  })

  it('associates an allocation amount error with its field', () => {
    const allocation = createUnclassifiedAllocation()
    render(
      <PaymentAllocationEditor
        {...editorProps({
          allocations: [allocation],
          allocationErrors: {
            'allocations.0.amount': ['Allocation amount is required.'],
          },
        })}
      />,
    )

    const amount = screen.getByLabelText('Unclassified payment 1 amount')
    expect(amount).toHaveAttribute(
      'aria-describedby',
      'record-payment-allocation-0-amount-error',
    )
  })
})
