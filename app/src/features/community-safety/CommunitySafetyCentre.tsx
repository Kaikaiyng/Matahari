import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { portalApi, type CommunityReportSummary } from '../../api/portalApi'
import { useSwipeBack } from '../../components/useSwipeBack'
import './CommunitySafety.css'

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const links = [['community-standards', 'Community Standards'], ['child-safety', 'Child Safety Standards'], ['terms', 'Terms of Use'], ['privacy', 'Privacy Policy'], ['support', 'Contact Support'], ['account-deletion', 'Account Deletion']] as const

export function CommunitySafetyCentreTrigger() {
  const [open, setOpen] = useState(false)
  return <>{<button type="button" className="settings-about-trigger" onClick={() => setOpen(true)} aria-label="Open Community Safety centre"><ShieldCheck /><span><small>Community</small><strong>Safety, policies and support</strong></span><ChevronRight /></button>}{open && <CommunitySafetyCentre onBack={() => setOpen(false)} />}</>
}

export function CommunitySafetyCentre({ onBack }: { onBack?: () => void }) {
  const [reports, setReports] = useState<CommunityReportSummary[]>([]); const [error, setError] = useState('')
  const returnToPrevious = () => onBack ? onBack() : window.history.back()
  const { isExiting, requestBack, surfaceStyle, gestureHandlers } = useSwipeBack(returnToPrevious)
  useEffect(() => { portalApi.getCommunityReports().then(({ data }) => setReports(data)).catch(() => setError('Unable to load your post reports.')) }, [])
  return createPortal(<div className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`} role="region" aria-label="Community Safety Centre Subpage" {...gestureHandlers} style={{ position: 'fixed', inset: 0, zIndex: 99990, background: '#f6f3ee', overflowY: 'auto', ...surfaceStyle }}><div className="subpage-container"><header className="subpage-header"><button type="button" className="subpage-back-btn" onClick={requestBack} aria-label="Back to previous page"><ChevronLeft size={20} /></button><h1 className="subpage-nav-title">Safety Centre</h1><div style={{ width: '38px' }} /></header><small style={{ color: 'var(--app-muted)', display: 'block', margin: '0 4px 4px' }}>Only you and moderators can see this.</small>{error && <p className="form-error">{error}</p>}<section className="subpage-content-group"><div className="subpage-section-heading"><b>My Post Reports</b><small>{reports.length} report{reports.length === 1 ? '' : 's'}</small></div><div className="subpage-policy-block">{reports.length ? reports.map((report) => <div key={report.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(221,217,209,.65)' }}><span><strong>{label(report.reason_code)}</strong><small style={{ display: 'block', color: 'var(--app-muted)' }}>Update report #{report.id}</small></span><small>{label(report.status)}</small></div>) : <p>No post reports submitted.</p>}</div></section><section className="subpage-content-group"><div className="subpage-section-heading"><b>Policies and support</b></div><div className="about-policy-list-card">{links.map(([slug, title]) => <a className="about-policy-item" href={`/legal/${slug}`} key={slug}><span className="about-item-title">{title}</span><ChevronRight size={18} className="about-item-arrow" /></a>)}</div></section></div></div>, document.body)
}
