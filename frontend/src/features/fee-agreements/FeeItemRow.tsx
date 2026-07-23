import { useEffect, useState } from 'react'
import { feeItemSummary, monthShortLabels } from './feeAgreementEditorModel'
import type {
  BillingFrequency,
  FeeAgreementItemClassification,
  FeeAgreementItemDraft,
} from './types'

const chargeTypes: Array<{ value: FeeAgreementItemClassification; label: string }> = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'optional_service', label: 'Optional service' },
  { value: 'one_time', label: 'One-time charge' },
  { value: 'manual', label: 'Manual charge' },
]

const billingPatterns: Array<{ value: BillingFrequency; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom months' },
  { value: 'one_time', label: 'One time' },
]

const everyMonth = monthShortLabels.map((_, index) => index + 1)

function BillingMonthSelector({
  item,
  error,
  onChange,
}: {
  item: FeeAgreementItemDraft
  error?: string
  onChange: (months: number[]) => void
}) {
  const [isCustomizing, setIsCustomizing] = useState(
    item.billing_frequency !== 'monthly' || item.billing_months.length > 0,
  )

  useEffect(() => {
    if (item.billing_frequency !== 'monthly' || item.billing_months.length > 0) {
      setIsCustomizing(true)
    }
  }, [item.billing_frequency, item.billing_months.length])

  if (!isCustomizing && item.billing_frequency === 'monthly') {
    return (
      <div className="billing-month-default">
        <div>
          <strong>Billing months</strong>
          <span>Every month</span>
        </div>
        <button
          type="button"
          className="text-button"
          aria-label={`Customize ${item.name} months`}
          onClick={() => setIsCustomizing(true)}
        >
          Customize
        </button>
      </div>
    )
  }

  const toggleMonth = (month: number) => {
    onChange(
      item.billing_months.includes(month)
        ? item.billing_months.filter((value) => value !== month)
        : [...item.billing_months, month].sort((left, right) => left - right),
    )
  }

  return (
    <fieldset className="billing-month-selector">
      <legend>Billing months</legend>
      <div className="billing-month-toolbar">
        <button
          type="button"
          className="text-button"
          aria-label={`Select all ${item.name} months`}
          onClick={() => onChange(everyMonth)}
        >
          Select all
        </button>
        <button
          type="button"
          className="text-button"
          aria-label={`Clear ${item.name} months`}
          onClick={() => onChange([])}
        >
          Clear
        </button>
        {item.billing_frequency === 'monthly' && (
          <button
            type="button"
            className="text-button"
            aria-label={`Use every month for ${item.name}`}
            onClick={() => {
              onChange([])
              setIsCustomizing(false)
            }}
          >
            Use every month
          </button>
        )}
      </div>
      <div className="billing-month-options">
        {monthShortLabels.map((label, index) => {
          const month = index + 1
          return (
            <label key={label} className="billing-month-option">
              <input
                type="checkbox"
                checked={item.billing_months.includes(month)}
                onChange={() => toggleMonth(month)}
              />
              <span>{label}</span>
            </label>
          )
        })}
      </div>
      {error && <p className="fee-item-error">{error}</p>}
    </fieldset>
  )
}

export function FeeItemRow({
  item,
  expanded,
  optional,
  monthError,
  onToggle,
  onChange,
  onRemove,
}: {
  item: FeeAgreementItemDraft
  expanded: boolean
  optional?: boolean
  monthError?: string
  onToggle: () => void
  onChange: (item: FeeAgreementItemDraft) => void
  onRemove?: () => void
}) {
  const update = <Key extends keyof FeeAgreementItemDraft>(
    key: Key,
    value: FeeAgreementItemDraft[Key],
  ) => onChange({ ...item, [key]: value })

  const updateClassification = (classification: FeeAgreementItemClassification) => {
    if (classification === 'one_time') {
      onChange({
        ...item,
        classification,
        billing_frequency: 'one_time',
        billing_months: item.billing_months.slice(0, 1),
        requires_preview_confirmation: true,
      })
      return
    }

    update('classification', classification)
  }

  const updateBillingPattern = (billingFrequency: BillingFrequency) => {
    onChange({
      ...item,
      billing_frequency: billingFrequency,
      billing_months: billingFrequency === 'monthly' ? [] : item.billing_months,
    })
  }

  return (
    <article
      className={`fee-item-row${expanded ? ' is-expanded' : ''}`}
      data-fee-item-id={item.fee_item_id}
    >
      <div className="fee-item-row-summary">
        <div className="fee-item-identity">
          <strong>{item.name}</strong>
          <span>{optional ? 'Optional fee' : 'Core fee'}</span>
        </div>

        <span className="fee-item-summary-copy">{feeItemSummary(item)}</span>

        <label className="fee-item-amount">
          <span>Amount (RM)</span>
          <input
            aria-label={`${item.name} amount`}
            type="number"
            min="0"
            step="0.01"
            value={item.amount}
            onChange={(event) => update('amount', event.target.value)}
          />
        </label>

        <div className="fee-item-row-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            aria-label={expanded ? `Close ${item.name}` : `Edit ${item.name}`}
            onClick={onToggle}
          >
            {expanded ? 'Done' : 'Edit'}
          </button>
          {optional && onRemove && (
            <button
              type="button"
              className="text-button danger-text"
              aria-label={`Remove ${item.name}`}
              onClick={onRemove}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="fee-item-advanced">
          <div className="fee-item-settings-grid">
            <label className="form-field">
              Charge Type
              <select
                aria-label={`${item.name} Charge Type`}
                value={item.classification}
                onChange={(event) =>
                  updateClassification(event.target.value as FeeAgreementItemClassification)
                }
              >
                {chargeTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>How this fee is collected and presented.</small>
            </label>

            <label className="form-field">
              Billing Pattern
              <select
                aria-label={`${item.name} Billing Pattern`}
                value={item.billing_frequency}
                onChange={(event) =>
                  updateBillingPattern(event.target.value as BillingFrequency)
                }
              >
                {billingPatterns.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Choose when this fee normally appears.</small>
            </label>
          </div>

          <label className="preview-confirmation-option">
            <input
              type="checkbox"
              checked={item.requires_preview_confirmation}
              onChange={(event) =>
                update('requires_preview_confirmation', event.target.checked)
              }
            />
            <span>
              <strong>Require preview confirmation</strong>
              <small>Ask staff to confirm this fee before generating charges.</small>
            </span>
          </label>

          <BillingMonthSelector
            item={item}
            error={monthError}
            onChange={(months) => update('billing_months', months)}
          />
        </div>
      )}
    </article>
  )
}
