import { useEffect, useState } from 'react'
import { apiRequest } from '../../api'
import './CommunitySafety.css'

type PublicPolicy = { slug: string; title: string; version: string | null; effective_at: string | null; sections: Array<{ heading: string; body: string }>; developer_name: string; organization_name: string; store_safety_disclosure: string; support: { email: string | null; child_safety_email: string | null } }

export function PublicPolicyPage({ slug }: { slug: string }) {
  const [policy, setPolicy] = useState<PublicPolicy | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { apiRequest<{ data: PublicPolicy }>(`/v1/public/community-policies/${slug}`).then(({ data }) => { setPolicy(data); document.title = `${data.title} · ${data.developer_name}` }).catch(() => setError('This policy page is temporarily unavailable.')) }, [slug])

  if (error) return <main className="public-policy-page"><h1>Policy unavailable</h1><p>{error}</p></main>
  if (!policy) return <main className="public-policy-page"><p>Loading policy…</p></main>
  return <main className="public-policy-page"><header><p>{policy.developer_name} · {policy.organization_name}</p><h1>{policy.title}</h1>{policy.effective_at && <small>Effective {new Date(policy.effective_at).toLocaleDateString()}{policy.version ? ` · Version ${policy.version}` : ''}</small>}</header><nav aria-label="Legal and safety"><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a><a href="/legal/community-standards">Community Standards</a><a href="/legal/child-safety">Child Safety</a><a href="/legal/support">Support</a><a href="/legal/account-deletion">Account Deletion</a></nav>{policy.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}{['community-standards', 'child-safety'].includes(policy.slug) && <section className="public-policy-safety"><h2>Child safety prohibition</h2><p>{policy.store_safety_disclosure}</p></section>}<section><h2>Contact</h2>{policy.support.email && <p>Support: <a href={`mailto:${policy.support.email}`}>{policy.support.email}</a></p>}{policy.support.child_safety_email && <p>Child safety: <a href={`mailto:${policy.support.child_safety_email}`}>{policy.support.child_safety_email}</a></p>}<p>This service is not an emergency channel. Contact local emergency services if someone is in immediate danger.</p></section></main>
}
