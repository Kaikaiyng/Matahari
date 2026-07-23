import { useState } from 'react'
import { AgreementReviewPanel } from './AgreementReviewPanel'
import { FeeItemRow } from './FeeItemRow'
import type {
  FeeAgreement,
  FeeAgreementForm,
  FeeAgreementItemDraft,
  PaymentPlan,
  ValidationErrors,
} from './types'
import './FeeAgreementEditor.css'

const paymentPlans: Array<{ value: PaymentPlan; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
]

const coreFeeCodes = new Set(['TUITION', 'MISC'])

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
  const [expandedFeeItemId, setExpandedFeeItemId] = useState<number | null>(null)
  const [optionalPickerOpen, setOptionalPickerOpen] = useState(false)
  const [optionalSearch, setOptionalSearch] = useState('')

  const update = <Key extends keyof FeeAgreementForm>(
    key: Key,
    value: FeeAgreementForm[Key],
  ) => {
    onChange({ ...form, [key]: value })
  }

  const updateItem = (updatedItem: FeeAgreementItemDraft) => {
    onChange({
      ...form,
      items: form.items.map((item) =>
        item.fee_item_id === updatedItem.fee_item_id ? updatedItem : item,
      ),
    })
  }

  const coreItems = form.items.filter((item) => coreFeeCodes.has(item.code))
  const enabledOptionalItems = form.items.filter(
    (item) => !coreFeeCodes.has(item.code) && item.enabled,
  )
  const disabledOptionalItems = form.items.filter(
    (item) =>
      !coreFeeCodes.has(item.code) &&
      !item.enabled &&
      item.name.toLowerCase().includes(optionalSearch.toLowerCase()),
  )

  const monthErrorFor = (feeItemId: number) => {
    const enabledIndex = form.items
      .filter((item) => item.enabled)
      .findIndex((item) => item.fee_item_id === feeItemId)

    return errors?.[`items.${enabledIndex}.billing_months`]?.[0]
  }

  const renderFeeItem = (item: FeeAgreementItemDraft, optional = false) => (
    <FeeItemRow
      key={item.fee_item_id}
      item={item}
      optional={optional}
      expanded={expandedFeeItemId === item.fee_item_id}
      monthError={monthErrorFor(item.fee_item_id)}
      onToggle={() =>
        setExpandedFeeItemId((current) =>
          current === item.fee_item_id ? null : item.fee_item_id,
        )
      }
      onChange={updateItem}
      onRemove={
        optional
          ? () => {
              updateItem({ ...item, enabled: false })
              setExpandedFeeItemId(null)
              setOptionalPickerOpen(false)
            }
          : undefined
      }
    />
  )

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
                <input
                  value={form.academic_year}
                  onChange={(event) => update('academic_year', event.target.value)}
                />
                {errors?.academic_year?.[0] && <small>{errors.academic_year[0]}</small>}
              </label>
            )}

            <label className="form-field">
              Payment Plan
              <select
                value={form.payment_plan}
                onChange={(event) => update('payment_plan', event.target.value as PaymentPlan)}
              >
                {paymentPlans.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              Effective From
              <input
                type="date"
                value={form.effective_from}
                onChange={(event) => update('effective_from', event.target.value)}
              />
              {errors?.effective_from?.[0] && <small>{errors.effective_from[0]}</small>}
            </label>

            <label className="form-field">
              Effective To
              <input
                type="date"
                value={form.effective_to}
                onChange={(event) => update('effective_to', event.target.value)}
              />
            </label>

            <label className="form-field agreement-remarks-field">
              Agreement Remarks
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(event) => update('remarks', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="agreement-editor-section" aria-labelledby="core-fees-title">
          <div className="agreement-section-heading">
            <div>
              <p className="eyebrow">Required</p>
              <h3 id="core-fees-title">Core fees</h3>
            </div>
            <span>Review the amount; open a fee only for advanced settings.</span>
          </div>

          <div className="fee-item-list">{coreItems.map((item) => renderFeeItem(item))}</div>
        </section>

        <section className="agreement-editor-section" aria-labelledby="optional-fees-title">
          <div className="agreement-section-heading">
            <div>
              <p className="eyebrow">As needed</p>
              <h3 id="optional-fees-title">Optional fees</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              aria-expanded={optionalPickerOpen}
              onClick={() => setOptionalPickerOpen((open) => !open)}
            >
              Add optional fee
            </button>
          </div>

          {enabledOptionalItems.length > 0 ? (
            <div className="fee-item-list">
              {enabledOptionalItems.map((item) => renderFeeItem(item, true))}
            </div>
          ) : (
            <p className="optional-fee-empty">No optional fees added.</p>
          )}

          {optionalPickerOpen && (
            <div className="optional-fee-picker">
              <label className="form-field">
                Find optional fee
                <input
                  type="search"
                  value={optionalSearch}
                  placeholder="Search available fees"
                  onChange={(event) => setOptionalSearch(event.target.value)}
                />
              </label>
              <div className="optional-fee-picker-list">
                {disabledOptionalItems.length > 0 ? (
                  disabledOptionalItems.map((item) => (
                    <div className="optional-fee-choice" key={item.fee_item_id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>Default RM {item.amount || '0'}</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        aria-label={`Add ${item.name}`}
                        onClick={() => {
                          updateItem({ ...item, enabled: true })
                          setExpandedFeeItemId(item.fee_item_id)
                          setOptionalPickerOpen(false)
                          setOptionalSearch('')
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No available fees match your search.</p>
                )}
              </div>
            </div>
          )}
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
