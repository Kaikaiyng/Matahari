import { AgreementReviewPanel } from './AgreementReviewPanel'
import type {
  FeeAgreement,
  FeeAgreementForm,
  PaymentPlan,
  ValidationErrors,
} from './types'
import './FeeAgreementEditor.css'

const paymentPlans: Array<{ value: PaymentPlan; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
]

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
  const update = <Key extends keyof FeeAgreementForm>(
    key: Key,
    value: FeeAgreementForm[Key],
  ) => {
    onChange({ ...form, [key]: value })
  }

  const updateAmount = (feeItemId: number, amount: string) => {
    onChange({
      ...form,
      items: form.items.map((item) =>
        item.fee_item_id === feeItemId ? { ...item, amount } : item,
      ),
    })
  }

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

          <div className="fee-item-list">
            {form.items
              .filter((item) => ['TUITION', 'MISC'].includes(item.code))
              .map((item) => (
                <div className="fee-row-shell" key={item.fee_item_id}>
                  <strong>{item.name}</strong>
                  <span className="fee-row-summary-copy">
                    Monthly · Every month · No preview required
                  </span>
                  <label className="fee-row-amount">
                    <span>{item.name} amount</span>
                    <input
                      aria-label={`${item.name} amount`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) => updateAmount(item.fee_item_id, event.target.value)}
                    />
                  </label>
                </div>
              ))}
          </div>
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
