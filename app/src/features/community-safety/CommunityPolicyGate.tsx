import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../../api'
import { portalApi, type CommunityPolicy } from '../../api/portalApi'
import './CommunitySafety.css'

type PublicPolicyDetail = {
  slug: string
  title: string
  version: string | null
  effective_at: string | null
  sections: Array<{ heading: string; body: string }>
  developer_name: string
  organization_name: string
  store_safety_disclosure: string
  support: { email: string | null; child_safety_email: string | null }
}

function getSlugForPolicy(policy: CommunityPolicy): string {
  if (policy.public_path) {
    const parts = policy.public_path.split('/')
    const last = parts[parts.length - 1]
    if (last) return last
  }
  if (policy.title.toLowerCase().includes('standard')) return 'community-standards'
  if (policy.title.toLowerCase().includes('child')) return 'child-safety'
  if (policy.title.toLowerCase().includes('privacy')) return 'privacy'
  if (policy.title.toLowerCase().includes('deletion')) return 'account-deletion'
  return 'terms'
}

export function CommunityPolicyGate({ role, onReadyChange }: { role?: 'parent' | 'student' | 'teacher' | 'staff'; onReadyChange: (ready: boolean) => void }) {
  const [policies, setPolicies] = useState<CommunityPolicy[]>([])
  const [checkedIds, setCheckedIds] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [activePolicyDetail, setActivePolicyDetail] = useState<{ policyId: number; detail: PublicPolicyDetail } | null>(null)
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)
  const [detailError, setDetailError] = useState('')

  const loadPolicies = useCallback(() => {
    setLoading(true)
    setError('')
    portalApi.getCurrentCommunityPolicies().then(({ data }) => {
      const required = ['terms', 'community_standards'].map((key) => data[key]).filter(Boolean)
      if (required.length !== 2) throw new Error('Required policies are unavailable')
      setPolicies(required)
      const initialChecked: Record<number, boolean> = {}
      required.forEach((p) => { if (p.accepted) initialChecked[p.id] = true })
      setCheckedIds(initialChecked)
      onReadyChange(required.length === 2 && required.every((policy) => policy.accepted))
    }).catch(() => {
      setPolicies([])
      setCheckedIds({})
      setError('Unable to verify the current Community policies.')
      onReadyChange(false)
    }).finally(() => setLoading(false))
  }, [onReadyChange])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const openPolicyDetail = async (policy: CommunityPolicy, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const slug = getSlugForPolicy(policy)
    setLoadingDetailId(policy.id)
    setDetailError('')
    try {
      const res = await apiRequest<{ data: PublicPolicyDetail }>(`/v1/public/community-policies/${slug}`)
      setActivePolicyDetail({ policyId: policy.id, detail: res.data })
    } catch {
      setDetailError('Unable to load policy detail. Please try again.')
    } finally {
      setLoadingDetailId(null)
    }
  }

  const closeDetailAndCheck = (autoCheck = true) => {
    if (activePolicyDetail && autoCheck) {
      setCheckedIds((prev) => ({ ...prev, [activePolicyDetail.policyId]: true }))
    }
    setActivePolicyDetail(null)
  }

  const accept = async () => {
    setSaving(true); setError('')
    try {
      for (const policy of policies.filter((item) => !item.accepted)) await portalApi.acceptCommunityPolicy(policy.id)
      setPolicies((items) => items.map((item) => ({ ...item, accepted: true })))
      onReadyChange(true)
    } catch { setError('We could not record your acceptance. Please try again.') } finally { setSaving(false) }
  }

  if (loading || (policies.length === 2 && policies.every((policy) => policy.accepted))) return null

  const allChecked = policies.length === 2 && policies.every((p) => p.accepted || checkedIds[p.id])
  const canSubmit = allChecked && !saving

  return (
    <div className="community-policy-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="policy-gate-title">
      {activePolicyDetail ? (
        <section className="community-policy-gate-modal policy-detail-viewer-modal">
          <header className="policy-detail-header">
            <button type="button" className="policy-back-button" onClick={() => closeDetailAndCheck(false)}>
              ← Back to Agreement
            </button>
            <span className="policy-gate-badge">{activePolicyDetail.detail.developer_name}</span>
          </header>

          <div className="policy-detail-content">
            <h1>{activePolicyDetail.detail.title}</h1>
            <p className="policy-meta">
              {activePolicyDetail.detail.organization_name}
              {activePolicyDetail.detail.effective_at && (
                <small> · Effective {new Date(activePolicyDetail.detail.effective_at).toLocaleDateString()}{activePolicyDetail.detail.version ? ` (v${activePolicyDetail.detail.version})` : ''}</small>
              )}
            </p>

            {activePolicyDetail.detail.sections.map((section, idx) => (
              <div key={idx} className="policy-section-block">
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </div>
            ))}

            {['community-standards', 'child-safety'].includes(activePolicyDetail.detail.slug) && (
              <div className="policy-gate-notice">
                <strong>Safety Disclosure:</strong> {activePolicyDetail.detail.store_safety_disclosure}
              </div>
            )}
          </div>

          <footer className="policy-detail-footer">
            <button
              type="button"
              className="primary-action policy-gate-submit"
              onClick={() => closeDetailAndCheck(true)}
            >
              ✓ Read & Confirm {activePolicyDetail.detail.title}
            </button>
          </footer>
        </section>
      ) : (
        <section className="community-policy-gate-modal">
          <div className="policy-gate-badge">Safety & Compliance</div>
          <h2 id="policy-gate-title">Before you continue</h2>
          <p className="policy-gate-desc">
            Please review and accept the required policies before using the App.
          </p>
          {role === 'student' && (
            <p className="policy-gate-notice">
              Student freeform interaction also requires active adult authorization. Ask your parent or guardian if contribution controls remain unavailable after acceptance.
            </p>
          )}
          <ul className="policy-gate-list">
            {policies.map((policy) => {
              const isChecked = !!checkedIds[policy.id] || policy.accepted
              const isLoadingThis = loadingDetailId === policy.id
              return (
                <li key={policy.id} className={isChecked ? 'accepted' : 'pending'}>
                  <label className="policy-checkbox-label">
                    <input
                      type="checkbox"
                      className="policy-checkbox"
                      checked={isChecked}
                      disabled={policy.accepted || saving}
                      onChange={() => toggleCheck(policy.id)}
                    />
                    <span className="policy-checkbox-custom">{isChecked ? '✓' : ''}</span>
                    <span className="policy-title-text">
                      <button
                        type="button"
                        className="policy-inline-link"
                        disabled={isLoadingThis}
                        aria-busy={isLoadingThis}
                        onClick={(e) => void openPolicyDetail(policy, e)}
                      >
                        {policy.title}
                      </button>
                      {policy.accepted ? <small> · accepted</small> : <small className="read-hint"> (Click to read details)</small>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {detailError && <p className="form-error">{detailError}</p>}
          {error && <p className="form-error">{error}</p>}
          {policies.length === 0 && error ? (
            <button type="button" className="primary-action policy-gate-submit" onClick={loadPolicies}>Retry</button>
          ) : (
            <button
              type="button"
              className="primary-action policy-gate-submit"
              disabled={!canSubmit}
              onClick={() => void accept()}
            >
              {saving ? 'Saving…' : 'Accept and continue'}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
