import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { CustomSelect, FieldError, fieldErrorProps } from '../../components/AdminUi'
import type { ValidationErrors } from '../fee-agreements/types'
import {
  feeRecordCategoryOptions,
  hasIncompleteUnclassifiedAllocation,
  type OneTimeChargeDraft,
  type OutstandingChargeCell,
  type PaymentAllocationDraft,
} from './paymentAllocationModel'

export type PaymentAllocationEditorProps = {
  academicYear: string
  paymentAmount: number
  allocationTotal: number
  allocations: PaymentAllocationDraft[]
  outstandingCharges: OutstandingChargeCell[]
  isLoadingOutstandingCharges: boolean
  outstandingChargeError: string
  allocationErrors?: ValidationErrors
  canAddOneTimeCharge: boolean
  isOneTimeChargeOpen: boolean
  oneTimeCharge: OneTimeChargeDraft
  oneTimeChargeErrors?: ValidationErrors
  oneTimeChargeNotice: string
  isSavingOneTimeCharge: boolean
  onRefresh: () => void
  onToggleCharge: (charge: OutstandingChargeCell, selected: boolean) => void
  onUpdateAllocation: (
    key: string,
    field: keyof Pick<PaymentAllocationDraft, 'description' | 'amount'>,
    value: string,
  ) => void
  onRemoveAllocation: (key: string) => void
  onOpenOneTimeCharge: () => void
  onCancelOneTimeCharge: () => void
  onUpdateOneTimeCharge: (field: keyof OneTimeChargeDraft, value: string) => void
  onCreateOneTimeCharge: () => void
  onAddUnclassified: () => void
  afterAllocation: ReactNode
}

function formatCurrency(amount: number | null) {
  if (amount === null) {
    return 'Not set'
  }

  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('MYR', 'RM')
}

function formatBillingMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return month
  }

  return new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function validationMessage(errors: ValidationErrors | undefined, field: string) {
  return errors?.[field]?.[0]
}

export function PaymentAllocationEditor({
  academicYear,
  paymentAmount,
  allocationTotal,
  allocations,
  outstandingCharges,
  isLoadingOutstandingCharges,
  outstandingChargeError,
  allocationErrors,
  canAddOneTimeCharge,
  isOneTimeChargeOpen,
  oneTimeCharge,
  oneTimeChargeErrors,
  oneTimeChargeNotice,
  isSavingOneTimeCharge,
  onRefresh,
  onToggleCharge,
  onUpdateAllocation,
  onRemoveAllocation,
  onOpenOneTimeCharge,
  onCancelOneTimeCharge,
  onUpdateOneTimeCharge,
  onCreateOneTimeCharge,
  onAddUnclassified,
  afterAllocation,
}: PaymentAllocationEditorProps) {
  const selectedChargeIds = new Set(
    allocations
      .map((allocation) => allocation.fee_record_charge_id)
      .filter((id): id is number => id !== null),
  )
  const groupedOutstandingCharges = useMemo(() => {
    const groups = new Map<string, Map<string, OutstandingChargeCell[]>>()

    outstandingCharges.forEach((charge) => {
      if (!groups.has(charge.billing_month)) {
        groups.set(charge.billing_month, new Map())
      }

      const monthGroup = groups.get(charge.billing_month)!

      if (!monthGroup.has(charge.fee_record_category)) {
        monthGroup.set(charge.fee_record_category, [])
      }

      monthGroup.get(charge.fee_record_category)!.push(charge)
    })

    return Array.from(groups.entries()).map(([billingMonth, categories]) => ({
      billingMonth,
      categories: Array.from(categories.entries()).map(([category, charges]) => ({
        category,
        charges,
      })),
    }))
  }, [outstandingCharges])
  const allocationError = validationMessage(allocationErrors, 'allocations')
  const incompleteUnclassified = hasIncompleteUnclassifiedAllocation(allocations)

  return (
    <div className="payment-allocation-editor" data-testid="payment-allocation-editor">
      <section
        className="payment-allocation-block payment-outstanding-region"
        aria-labelledby="outstanding-fees-heading"
      >
        <div className="payment-subheader">
          <div>
            <h3 id="outstanding-fees-heading">Outstanding fees</h3>
            <p>Select the fees this payment should clear.</p>
          </div>
          <div className="payment-subheader-actions">
            <button type="button" className="table-action" onClick={onRefresh}>
              Refresh
            </button>
            {canAddOneTimeCharge && (
              <button type="button" className="secondary-action compact" onClick={onOpenOneTimeCharge}>
                Add one-time charge
              </button>
            )}
          </div>
        </div>

        {oneTimeChargeNotice && (
          <div className="inline-success" role="status">
            {oneTimeChargeNotice}
          </div>
        )}

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
                  {...fieldErrorProps(
                    'payment-one-time-billing-month-error',
                    validationMessage(oneTimeChargeErrors, 'billing_month'),
                  )}
                />
                <FieldError
                  id="payment-one-time-billing-month-error"
                  message={validationMessage(oneTimeChargeErrors, 'billing_month')}
                />
              </label>

              <label className="form-field">
                Category
                <CustomSelect
                  ariaLabel="One-time charge category"
                  value={oneTimeCharge.fee_record_category}
                  onChange={(value) => onUpdateOneTimeCharge('fee_record_category', value)}
                  options={feeRecordCategoryOptions}
                  {...fieldErrorProps(
                    'payment-one-time-fee-record-category-error',
                    validationMessage(oneTimeChargeErrors, 'fee_record_category'),
                  )}
                />
                <FieldError
                  id="payment-one-time-fee-record-category-error"
                  message={validationMessage(oneTimeChargeErrors, 'fee_record_category')}
                />
              </label>

              <label className="form-field">
                Description
                <input
                  aria-label="One-time charge description"
                  value={oneTimeCharge.description}
                  placeholder="Uniform, CCA, Books, or another fee"
                  onChange={(event) => onUpdateOneTimeCharge('description', event.target.value)}
                  {...fieldErrorProps(
                    'payment-one-time-description-error',
                    validationMessage(oneTimeChargeErrors, 'description'),
                  )}
                />
                <FieldError
                  id="payment-one-time-description-error"
                  message={validationMessage(oneTimeChargeErrors, 'description')}
                />
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
                  {...fieldErrorProps(
                    'payment-one-time-expected-amount-error',
                    validationMessage(oneTimeChargeErrors, 'expected_amount'),
                  )}
                />
                <FieldError
                  id="payment-one-time-expected-amount-error"
                  message={validationMessage(oneTimeChargeErrors, 'expected_amount')}
                />
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
              <button type="button" className="secondary-action" onClick={onCancelOneTimeCharge}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-action compact"
                disabled={isSavingOneTimeCharge}
                onClick={onCreateOneTimeCharge}
              >
                {isSavingOneTimeCharge ? 'Adding...' : 'Add and select charge'}
              </button>
            </div>
          </section>
        )}

        {allocationError && (
          <div className="inline-error" role="alert">
            {allocationError}
          </div>
        )}
        {outstandingChargeError && (
          <div className="inline-error" role="alert">
            {outstandingChargeError}
          </div>
        )}
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
                        <small>
                          {charge.fee_code ?? 'One-time charge'} / Outstanding {formatCurrency(charge.outstanding_amount)}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </section>

      <section
        className="payment-allocation-block payment-allocation-region"
        aria-labelledby="payment-allocation-heading"
      >
        <div className="payment-subheader">
          <div>
            <h3 id="payment-allocation-heading">Payment allocation</h3>
            <p>
              Allocated {formatCurrency(allocationTotal)} of {formatCurrency(paymentAmount)}
            </p>
          </div>
        </div>

        <div className="allocation-rows">
          {allocations.length === 0 && <div className="empty-state">Select an outstanding fee to continue.</div>}

          {allocations.map((allocation, index) => (
            <div className={`allocation-row ${allocation.allocation_type}`} key={allocation.key}>
              <div className="allocation-source-summary">
                <span className={`badge ${allocation.allocation_type === 'charge' ? 'paid' : 'neutral'}`}>
                  {allocation.allocation_type === 'charge' ? 'Fee' : 'Unclassified payment'}
                </span>
                <strong>{allocation.description || 'Describe this unclassified payment'}</strong>
                <small>
                  {allocation.allocation_type === 'charge'
                    ? `${allocation.billing_month} / ${allocation.fee_record_category} / Outstanding ${formatCurrency(
                        allocation.outstanding_amount,
                      )}`
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
                    {...fieldErrorProps(
                      `record-payment-allocation-${index}-description-error`,
                      validationMessage(allocationErrors, `allocations.${index}.description`),
                    )}
                  />
                  <FieldError
                    id={`record-payment-allocation-${index}-description-error`}
                    message={validationMessage(allocationErrors, `allocations.${index}.description`)}
                  />
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
                  {...fieldErrorProps(
                    `record-payment-allocation-${index}-amount-error`,
                    validationMessage(allocationErrors, `allocations.${index}.amount`),
                  )}
                />
                <FieldError
                  id={`record-payment-allocation-${index}-amount-error`}
                  message={validationMessage(allocationErrors, `allocations.${index}.amount`)}
                />
              </label>

              <button
                type="button"
                className="table-action danger-action"
                onClick={() => onRemoveAllocation(allocation.key)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="payment-post-allocation-region">{afterAllocation}</div>

      <details className="payment-advanced-options">
        <summary>Advanced options</summary>
        <div className="advanced-option-content">
          <strong>Unclassified payment</strong>
          <p>
            Use only when received money cannot be linked to a fee. This records the payment but does not reduce the
            student’s outstanding balance.
          </p>
          <button
            type="button"
            className="table-action"
            disabled={incompleteUnclassified}
            onClick={onAddUnclassified}
          >
            Record unclassified payment
          </button>
        </div>
      </details>
    </div>
  )
}
