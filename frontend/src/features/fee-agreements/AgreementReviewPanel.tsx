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
  const coreFeeCount = form.items.filter(
    (item) => item.enabled && (item.code === 'TUITION' || item.code === 'MISC'),
  ).length
  const coverage = `${form.effective_from}${form.effective_to ? ` to ${form.effective_to}` : ' onward'}`
  const changes =
    mode === 'supersede' && currentAgreement ? getAgreementChanges(currentAgreement, form) : []
  const coverageChanges = changes.filter((change) => change.kind === 'date')
  const feeChanges = changes.filter((change) => change.kind !== 'date')
  const label =
    mode === 'create' ? 'Agreement Summary' : `Changes from v${currentAgreement?.version_no ?? ''}`

  return (
    <aside className="agreement-review-panel" aria-label={label}>
      <div>
        <p className="eyebrow">{mode === 'create' ? 'Agreement Summary' : 'Supersede Review'}</p>
        <h3>{mode === 'create' ? 'At a glance' : label}</h3>
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
        <div>
          <dt>Coverage</dt>
          <dd>{coverage}</dd>
        </div>
        <div>
          <dt>Core fees</dt>
          <dd>{coreFeeCount}</dd>
        </div>
        <div>
          <dt>{mode === 'supersede' ? 'Changes' : 'Warnings'}</dt>
          <dd>{mode === 'supersede' ? changes.length : errorCount}</dd>
        </div>
      </dl>

      {errorCount > 0 && (
        <p className="agreement-review-warning">
          {errorCount} area{errorCount === 1 ? '' : 's'} need attention.
        </p>
      )}

      <details className="agreement-review-details">
        <summary>Review details</summary>
        <div className="agreement-review-detail-content">
          <div className="agreement-review-meta">
            <span>{coverage}</span>
            <span>{enabledItems.map((item) => item.name).join(', ')}</span>
          </div>

          {mode === 'supersede' && (
            <div className="agreement-change-list">
              <section>
                <strong>Coverage changes</strong>
                {coverageChanges.length > 0 ? (
                  coverageChanges.map((change) => <p key={change.key}>{change.message}</p>)
                ) : (
                  <p>No coverage changes.</p>
                )}
              </section>
              <section>
                <strong>Fee configuration</strong>
                {feeChanges.length > 0 ? (
                  feeChanges.map((change) => <p key={change.key}>{change.message}</p>)
                ) : (
                  <p>No fee configuration changes.</p>
                )}
              </section>
            </div>
          )}
        </div>
      </details>
    </aside>
  )
}
