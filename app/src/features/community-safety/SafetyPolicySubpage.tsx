import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Clock, Headphones, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../../api'
import { useSwipeBack } from '../../components/useSwipeBack'

type SchoolSupport = {
  call_phone: string | null
  whatsapp_phone: string | null
  support_email: string | null
  operating_hours: string | null
}

type PublicPolicy = {
  slug: string
  title: string
  version: string | null
  effective_at: string | null
  sections: Array<{ heading: string; body: string }>
  developer_name: string
  organization_name: string
  store_safety_disclosure: string
  support: { email: string | null; child_safety_email: string | null; school: SchoolSupport | null }
}

const fallbackTitles: Record<string, string> = {
  'community-standards': 'Community Standards',
  'child-safety': 'Child Safety Standards',
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
  support: 'Contact Support',
  'account-deletion': 'Account Deletion',
}

export function SafetyPolicySubpage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [policy, setPolicy] = useState<PublicPolicy | null>(null)
  const [error, setError] = useState('')
  const { isExiting, requestBack, surfaceStyle, gestureHandlers } = useSwipeBack(onBack)
  const title = policy?.title ?? fallbackTitles[slug] ?? 'Safety information'

  useEffect(() => {
    let active = true
    setPolicy(null)
    setError('')
    apiRequest<{ data: PublicPolicy }>(`/v1/public/community-policies/${slug}`)
      .then(({ data }) => { if (active) setPolicy(data) })
      .catch(() => { if (active) setError('This page is temporarily unavailable.') })
    return () => { active = false }
  }, [slug])

  const school = policy?.support.school
  const whatsappDigits = school?.whatsapp_phone?.replace(/\D/g, '')

  return createPortal(
    <div
      className={`subpage-slide-overlay tertiary-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label={`${title} Subpage`}
      {...gestureHandlers}
      style={{ position: 'fixed', inset: 0, zIndex: 99991, background: '#f6f3ee', overflowY: 'auto', ...surfaceStyle }}
    >
      <div className="subpage-container safety-policy-page">
        <header className="subpage-header">
          <button type="button" className="subpage-back-btn" onClick={requestBack} aria-label="Back to Safety Centre"><ChevronLeft size={20} /></button>
          <h1 className="subpage-nav-title">{title}</h1>
          <div className="subpage-header-spacer" />
        </header>

        {!policy && !error && <div className="safety-policy-skeleton" aria-label="Loading policy"><span /><span /><span /></div>}
        {error && <section className="safety-policy-error"><ShieldCheck size={22} /><strong>Unable to open this page</strong><p>{error}</p></section>}

        {policy && <>
          <section className="safety-policy-hero">
            <span className="safety-policy-hero-icon"><ShieldCheck size={24} /></span>
            <span className="safety-policy-hero-copy">
              <small>{policy.developer_name} · {policy.organization_name}</small>
              <h2>{policy.title}</h2>
              {policy.effective_at && <p>Effective {new Date(policy.effective_at).toLocaleDateString()}{policy.version ? ` · Version ${policy.version}` : ''}</p>}
            </span>
          </section>

          <div className="safety-policy-sections">
            {policy.sections.map((section) => <section className="safety-policy-content-card" key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}
            {['community-standards', 'child-safety'].includes(policy.slug) && <section className="safety-policy-content-card safety-policy-warning"><span className="safety-policy-card-eyebrow">CHILD SAFETY</span><h2>Child safety prohibition</h2><p>{policy.store_safety_disclosure}</p></section>}
          </div>

          <section className="subpage-content-group">
            <div className="subpage-section-heading"><b>Contact &amp; support</b></div>
            <div className="safety-policy-contact-card">
              {school?.call_phone && <a href={`tel:${school.call_phone}`}><span><Phone size={18} /></span><strong>Call school support</strong><small>{school.call_phone}</small></a>}
              {school?.whatsapp_phone && whatsappDigits && <a href={`https://wa.me/${whatsappDigits}`}><span><MessageCircle size={18} /></span><strong>WhatsApp support</strong><small>{school.whatsapp_phone}</small></a>}
              {school?.support_email && <a href={`mailto:${school.support_email}`}><span><Mail size={18} /></span><strong>Email school support</strong><small>{school.support_email}</small></a>}
              {school?.operating_hours && <div className="safety-policy-contact-hours"><span><Clock size={18} /></span><strong>Support hours</strong><small>{school.operating_hours}</small></div>}
              {!school && policy.support.email && <a href={`mailto:${policy.support.email}`}><span><Headphones size={18} /></span><strong>Matahari Support</strong><small>{policy.support.email}</small></a>}
              {policy.support.child_safety_email && <a href={`mailto:${policy.support.child_safety_email}`}><span><ShieldCheck size={18} /></span><strong>Child safety</strong><small>{policy.support.child_safety_email}</small></a>}
            </div>
            <p className="safety-policy-emergency">This service is not an emergency channel. Contact local emergency services if someone is in immediate danger.</p>
          </section>
        </>}
      </div>
    </div>,
    document.body,
  )
}
