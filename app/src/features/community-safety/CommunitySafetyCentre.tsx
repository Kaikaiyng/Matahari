import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { portalApi, type CommunityReportSummary } from '../../api/portalApi'
import { useSwipeBack } from '../../components/useSwipeBack'
import { SafetyPolicySubpage } from './SafetyPolicySubpage'
import './CommunitySafety.css'

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
type SafetyLink = { slug: string; title: string; description: string; icon: LucideIcon }

const safetyLinks: SafetyLink[] = [
  { slug: 'community-standards', title: 'Community Standards', description: 'How we keep school updates respectful and safe.', icon: ShieldCheck },
  { slug: 'child-safety', title: 'Child Safety Standards', description: 'Our safeguards for children and young people.', icon: Flag },
]

const policyLinks: SafetyLink[] = [
  { slug: 'terms', title: 'Terms of Use', description: 'The rules for using the School App.', icon: FileText },
  { slug: 'privacy', title: 'Privacy Policy', description: 'How your information is handled and protected.', icon: LockKeyhole },
  { slug: 'account-deletion', title: 'Account Deletion', description: 'Request removal of your School App account.', icon: UserRoundX },
]

function SafetyLinkList({ links, onOpen }: { links: SafetyLink[]; onOpen: (slug: string) => void }) {
  return <div className="about-policy-list-card safety-centre-link-list">{links.map(({ slug, title, description, icon: Icon }) => <a className="about-policy-item safety-centre-link" href={`/legal/${slug}`} key={slug} aria-label={title} onClick={(event) => { event.preventDefault(); onOpen(slug) }}><span className="safety-centre-link-icon"><Icon size={20} /></span><span className="about-item-text"><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} className="about-item-arrow" /></a>)}</div>
}

export function CommunitySafetyCentreTrigger() {
  const [open, setOpen] = useState(false)
  return <>{<button type="button" className="settings-about-trigger" onClick={() => setOpen(true)} aria-label="Open Community Safety centre"><ShieldCheck /><span><small>Community</small><strong>Safety, policies and support</strong></span><ChevronRight /></button>}{open && <CommunitySafetyCentre onBack={() => setOpen(false)} />}</>
}

export function CommunitySafetyCentre({ onBack }: { onBack?: () => void }) {
  const [reports, setReports] = useState<CommunityReportSummary[]>([])
  const [error, setError] = useState('')
  const [activePolicySlug, setActivePolicySlug] = useState<string | null>(null)
  const returnToPrevious = () => onBack ? onBack() : window.history.back()
  const { isExiting, requestBack, surfaceStyle, gestureHandlers } = useSwipeBack(returnToPrevious)
  useEffect(() => { portalApi.getCommunityReports().then(({ data }) => setReports(data)).catch(() => setError('Unable to load your post reports.')) }, [])
  return createPortal(<div className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`} role="region" aria-label="Community Safety Centre Subpage" {...gestureHandlers} style={{ position: 'fixed', inset: 0, zIndex: 99990, background: '#f6f3ee', overflowY: 'auto', ...surfaceStyle }}><div className="subpage-container safety-centre-page">
    <header className="subpage-header"><button type="button" className="subpage-back-btn" onClick={requestBack} aria-label="Back to previous page"><ChevronLeft size={20} /></button><h1 className="subpage-nav-title">Safety Centre</h1><div className="subpage-header-spacer" /></header>
    <section className="safety-centre-intro" aria-label="Privacy notice"><span className="safety-centre-intro-icon"><ShieldCheck size={23} /></span><span><small>PRIVATE &amp; SECURE</small><strong>Only you and moderators can see this.</strong><p>Review your reports, school safety standards and support options in one place.</p></span></section>
    {error && <p className="form-error safety-centre-error">{error}</p>}
    <section className="subpage-content-group"><div className="subpage-section-heading"><b>My Post Reports</b><small>{reports.length} report{reports.length === 1 ? '' : 's'}</small></div><div className={`safety-report-card ${reports.length ? 'has-reports' : ''}`}>{reports.length ? reports.map((report) => <article className="safety-report-row" key={report.id}><span className="safety-report-icon"><Flag size={18} /></span><span className="safety-report-copy"><strong>{label(report.reason_code)}</strong><small>Update report #{report.id}</small></span><span className="safety-report-status">{label(report.status)}</span></article>) : <div className="safety-report-empty"><span className="safety-report-empty-icon"><ShieldCheck size={22} /></span><span><strong>No reports submitted</strong><small>Reports you send will appear here with their latest status.</small></span></div>}</div></section>
    <section className="subpage-content-group"><div className="subpage-section-heading"><b>Safety standards</b></div><SafetyLinkList links={safetyLinks} onOpen={setActivePolicySlug} /></section>
    <section className="subpage-content-group"><div className="subpage-section-heading"><b>Policies &amp; account</b></div><SafetyLinkList links={policyLinks} onOpen={setActivePolicySlug} /></section>
    <section className="subpage-content-group"><div className="subpage-section-heading"><b>School support</b></div><a className="safety-support-card" href="/legal/support" aria-label="Contact Support" onClick={(event) => { event.preventDefault(); setActivePolicySlug('support') }}><span className="safety-support-icon"><Headphones size={22} /></span><span className="safety-support-copy"><small>NEED HELP?</small><strong>Contact Support</strong><p>Call, WhatsApp or email your school support team.</p></span><ChevronRight size={19} className="about-item-arrow" /></a></section>
  </div>{activePolicySlug && <SafetyPolicySubpage slug={activePolicySlug} onBack={() => setActivePolicySlug(null)} />}</div>, document.body)
}
