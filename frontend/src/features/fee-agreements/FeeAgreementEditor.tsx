import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { CustomSelect, DatePicker, FieldError, fieldErrorProps } from '../../components/AdminUi'
import { AgreementReviewPanel } from './AgreementReviewPanel'
import { FeeItemRow } from './FeeItemRow'
import type {
  FeeAgreement,
  DiscountScope,
  DiscountType,
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
  paymentPlanRef,
}: {
  mode: 'create' | 'supersede'
  form: FeeAgreementForm
  errors: ValidationErrors | undefined
  currentAgreement: FeeAgreement | null
  onChange: (form: FeeAgreementForm) => void
  paymentPlanRef?: RefObject<HTMLButtonElement | null>
}) {
  const [expandedFeeItemId, setExpandedFeeItemId] = useState<number | null>(null)
  const [optionalPickerOpen, setOptionalPickerOpen] = useState(false)
  const [optionalSearch, setOptionalSearch] = useState('')
  const [discountExpanded, setDiscountExpanded] = useState(
    form.discount.enabled || Object.keys(errors ?? {}).some((key) => key.startsWith('discounts.')),
  )

  const firstErrorKey = Object.keys(errors ?? {})[0]

  useEffect(() => {
    if (!firstErrorKey) {
      return
    }

    const itemMatch = /^items\.(\d+)\./.exec(firstErrorKey)
    if (itemMatch) {
      const enabledItems = form.items.filter((item) => item.enabled)
      const item = enabledItems[Number(itemMatch[1])]
      if (item) {
        setExpandedFeeItemId(item.fee_item_id)
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              `[data-fee-item-id="${item.fee_item_id}"] [aria-label$=" Billing Pattern"]`,
            )
            ?.focus()
        })
      }
      return
    }

    if (firstErrorKey.startsWith('discounts.')) {
      setDiscountExpanded(true)
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-discount-editor] input, [data-discount-editor] select',
          )
          ?.focus()
      })
    }
  }, [firstErrorKey, form.items])

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

  const updateDiscount = <Key extends keyof FeeAgreementForm['discount']>(
    key: Key,
    value: FeeAgreementForm['discount'][Key],
  ) => {
    onChange({
      ...form,
      discount: {
        ...form.discount,
        [key]: value,
      },
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
    <div className="fee-agreement-editor" data-testid="fee-agreement-editor">
      {mode === 'supersede' && currentAgreement && (
        <div className="agreement-version-context">
          <strong>Creating a new version from v{currentAgreement.version_no}</strong>
          <span>The current agreement stays in version history.</span>
        </div>
      )}

      <main className="fee-agreement-editor-main">
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
                  aria-label="Academic Year"
                  value={form.academic_year}
                  onChange={(event) => update('academic_year', event.target.value)}
                  {...fieldErrorProps(
                    'fee-agreement-academic-year-error',
                    errors?.academic_year?.[0],
                  )}
                />
                <FieldError
                  id="fee-agreement-academic-year-error"
                  message={errors?.academic_year?.[0]}
                />
              </label>
            )}

            <label className="form-field">
              Payment Plan
              <CustomSelect
                triggerRef={paymentPlanRef}
                ariaLabel="Payment Plan"
                value={form.payment_plan}
                onChange={(value) => update('payment_plan', value as PaymentPlan)}
                options={paymentPlans}
              />
            </label>

            <label className="form-field">
              Effective From
              <DatePicker
                ariaLabel="Effective From"
                value={form.effective_from}
                onChange={(value) => update('effective_from', value)}
                {...fieldErrorProps(
                  'fee-agreement-effective-from-error',
                  errors?.effective_from?.[0],
                )}
              />
              <FieldError
                id="fee-agreement-effective-from-error"
                message={errors?.effective_from?.[0]}
              />
            </label>

            <label className="form-field">
              Effective To
              <DatePicker
                ariaLabel="Effective To"
                value={form.effective_to}
                onChange={(value) => update('effective_to', value)}
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
              className="secondary-action"
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
                        className="secondary-action compact-button"
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

        <section className="agreement-editor-section" aria-labelledby="manual-discount-title">
          <div className="agreement-discount-summary">
            <div>
              <p className="eyebrow">Approval only</p>
              <h3 id="manual-discount-title">Manual discount</h3>
              <span>
                {form.discount.enabled
                  ? `${form.discount.discount_label || 'Manual discount'} · ${
                      form.discount.discount_type === 'percentage'
                        ? `${form.discount.value || '0'}%`
                        : `RM ${form.discount.value || '0'}`
                    }`
                  : 'No manual discount'}
              </span>
            </div>
            <button
              type="button"
              className="secondary-action"
              aria-label="Configure manual discount"
              aria-expanded={discountExpanded}
              onClick={() => setDiscountExpanded((expanded) => !expanded)}
            >
              {discountExpanded ? 'Done' : 'Configure'}
            </button>
          </div>

          {discountExpanded && (
            <div className="agreement-discount-editor" data-discount-editor>
              <label className="discount-enable-row">
                <input
                  type="checkbox"
                  aria-label="Enable manual discount"
                  checked={form.discount.enabled}
                  onChange={(event) => updateDiscount('enabled', event.target.checked)}
                />
                <span>
                  <strong>Enable manual discount</strong>
                  <small>Use only after the discount has been approved.</small>
                </span>
              </label>

              {form.discount.enabled && (
                <>
                  <label className="form-field">
                    Discount Label
                    <input
                      aria-label="Discount Label"
                      value={form.discount.discount_label}
                      onChange={(event) =>
                        updateDiscount('discount_label', event.target.value)
                      }
                      {...fieldErrorProps(
                        'fee-agreement-discount-label-error',
                        errors?.['discounts.0.discount_label']?.[0],
                      )}
                    />
                    <FieldError
                      id="fee-agreement-discount-label-error"
                      message={errors?.['discounts.0.discount_label']?.[0]}
                    />
                  </label>

                  <label className="form-field">
                    Discount Type
                    <CustomSelect
                      ariaLabel="Discount Type"
                      value={form.discount.discount_type}
                      onChange={(value) =>
                        updateDiscount('discount_type', value as DiscountType)
                      }
                      options={[{ value: 'fixed_amount', label: 'Fixed amount' }, { value: 'percentage', label: 'Percentage' }]}
                    />
                  </label>

                  <label className="form-field">
                    Scope
                    <CustomSelect
                      ariaLabel="Discount Scope"
                      value={form.discount.scope}
                      onChange={(value) =>
                        updateDiscount('scope', value as DiscountScope)
                      }
                      options={[{ value: 'total_payable', label: 'Total payable' }, { value: 'tuition_only', label: 'Tuition only' }, { value: 'selected_fee_items', label: 'Selected fee items' }]}
                    />
                  </label>

                  <label className="form-field">
                    Discount Value
                    <input
                      aria-label="Discount Value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount.value}
                      onChange={(event) => updateDiscount('value', event.target.value)}
                      {...fieldErrorProps(
                        'fee-agreement-discount-value-error',
                        errors?.['discounts.0.value']?.[0],
                      )}
                    />
                    <FieldError
                      id="fee-agreement-discount-value-error"
                      message={errors?.['discounts.0.value']?.[0]}
                    />
                  </label>

                  {form.discount.scope === 'selected_fee_items' && (
                    <fieldset className="discount-fee-scope wide">
                      <legend>Apply discount to</legend>
                      {form.items
                        .filter((item) => item.enabled)
                        .map((item) => (
                          <label key={item.code}>
                            <input
                              type="checkbox"
                              checked={form.discount.selected_fee_codes.includes(item.code)}
                              onChange={(event) =>
                                updateDiscount(
                                  'selected_fee_codes',
                                  event.target.checked
                                    ? [...form.discount.selected_fee_codes, item.code]
                                    : form.discount.selected_fee_codes.filter(
                                        (code) => code !== item.code,
                                      ),
                                )
                              }
                            />
                            {item.name}
                          </label>
                        ))}
                    </fieldset>
                  )}

                  <label className="form-field wide">
                    Discount Remark
                    <textarea
                      rows={2}
                      value={form.discount.remark}
                      onChange={(event) => updateDiscount('remark', event.target.value)}
                    />
                  </label>
                </>
              )}
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
