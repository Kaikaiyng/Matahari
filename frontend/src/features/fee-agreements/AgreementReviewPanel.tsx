import { agreementTotals, getAgreementChanges } from './feeAgreementEditorModel'
import type { FeeAgreement, FeeAgreementForm } from './types'

function formatCurrency(value: number) {
  return `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(value)}`
}

export function AgreementReviewPanel({
  mode,
  form,
  currentAgreement,
  errorCount,
}: {
  mode: 'create' | 'supersede'
  form: FeeAgreementForm
  currentAgreement: FeeAgreement | null
  errorCount: number
}) {
  const totals = agreementTotals(form)
  const enabledItems = form.items.filter((item) => item.enabled)
  const changes =
    mode === 'supersede' && currentAgreement ? getAgreementChanges(currentAgreement, form) : []
  const label =
    mode === 'create' ? 'Agreement Summary' : `Changes from v${currentAgreement?.version_no ?? ''}`

  return (
    <aside className="agreement-review-panel" aria-label={label}>
      <div>
        <p className="eyebrow">{mode === 'create' ? 'Agreement Summary' : 'Supersede Review'}</p>
        <h3>{label}</h3>
      </div>

      <dl className="agreement-review-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCurrency(totals.subtotal)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>− {formatCurrency(totals.discountAmount)}</dd>
        </div>
        <div className="agreement-review-total">
          <dt>Preview total</dt>
          <dd>{formatCurrency(totals.total)}</dd>
        </div>
      </dl>

      <div className="agreement-review-meta">
        <span>
          {form.effective_from}
          {form.effective_to ? ` to ${form.effective_to}` : ' onward'}
        </span>
        <span>{enabledItems.map((item) => item.name).join(', ')}</span>
      </div>

      {errorCount > 0 && (
        <p className="agreement-review-warning">
          {errorCount} area{errorCount === 1 ? '' : 's'} need attention.
        </p>
      )}

      {mode === 'supersede' && (
        <div className="agreement-change-list">
          {changes.length > 0 ? (
            changes.map((change) => <p key={change.key}>{change.message}</p>)
          ) : (
            <p>No fee configuration changes.</p>
          )}
        </div>
      )}
    </aside>
  )
}
