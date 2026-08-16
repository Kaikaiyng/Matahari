import { useEffect, useState } from 'react'
import { portalApi, type CommunityPolicy } from '../../api/portalApi'
import './CommunitySafety.css'

export function CommunityPolicyGate({ role, onReadyChange }: { role?: 'parent' | 'student' | 'teacher' | 'staff'; onReadyChange: (ready: boolean) => void }) {
  const [policies, setPolicies] = useState<CommunityPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    portalApi.getCurrentCommunityPolicies().then(({ data }) => {
      const required = ['terms', 'community_standards'].map((key) => data[key]).filter(Boolean)
      setPolicies(required)
      onReadyChange(required.length === 2 && required.every((policy) => policy.accepted))
    }).catch(() => { setError('Unable to verify the current Community policies.'); onReadyChange(false) }).finally(() => setLoading(false))
  }, [onReadyChange])

  const accept = async () => {
    setSaving(true); setError('')
    try {
      for (const policy of policies.filter((item) => !item.accepted)) await portalApi.acceptCommunityPolicy(policy.id)
      setPolicies((items) => items.map((item) => ({ ...item, accepted: true })))
      onReadyChange(true)
    } catch { setError('We could not record your acceptance. Please try again.') } finally { setSaving(false) }
  }

  if (loading || (policies.length === 2 && policies.every((policy) => policy.accepted))) return null
  return <section className="community-policy-gate" aria-live="polite">
    <h2>Before you contribute</h2>
    <p>Read and accept the current Terms of Use and Community Standards before posting, reacting, or commenting. Reporting and blocking remain available.</p>
    {role === 'student' && <p>Student freeform interaction also requires active adult authorization. Ask your parent or guardian if contribution controls remain unavailable after acceptance.</p>}
    <ul>{policies.map((policy) => <li key={policy.id}>{policy.public_path ? <a href={policy.public_path} target="_blank" rel="noreferrer">{policy.title}</a> : policy.title}{policy.accepted && ' · accepted'}</li>)}</ul>
    {error && <p className="form-error">{error}</p>}
    <button type="button" className="primary-action" disabled={saving || policies.length !== 2} onClick={() => void accept()}>{saving ? 'Saving…' : 'Accept and continue'}</button>
  </section>
}
