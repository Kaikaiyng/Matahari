import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, ShieldCheck, ChevronRight, ChevronLeft } from 'lucide-react'
import { apiRequest } from '../../api'
import { portalApi, type CommunityAppeal, type CommunityBlockedUser, type CommunityOwnContent, type CommunityReportSummary } from '../../api/portalApi'
import { useSwipeBack } from '../../components/useSwipeBack'
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

const label = (value: string) => { const words = value.replaceAll('_', ' '); return words.charAt(0).toUpperCase() + words.slice(1) }

export function CommunitySafetyLinks() {
  const [navState, setNavState] = useState<'none' | 'about' | 'safety' | 'detail'>('none')

  // Policy Detail State
  const [activePolicy, setActivePolicy] = useState<PublicPolicyDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Community Safety Centre State
  const [reports, setReports] = useState<CommunityReportSummary[]>([])
  const [blocked, setBlocked] = useState<CommunityBlockedUser[]>([])
  const [content, setContent] = useState<CommunityOwnContent[]>([])
  const [appeals, setAppeals] = useState<CommunityAppeal[]>([])
  const [safetyError, setSafetyError] = useState('')

  useEffect(() => {
    if (navState === 'safety') {
      Promise.all([portalApi.getCommunityReports(), portalApi.getBlockedCommunityUsers(), portalApi.getMyCommunityContent(), portalApi.getCommunityAppeals()])
        .then(([reportResponse, blockResponse, contentResponse, appealResponse]) => { setReports(reportResponse.data); setBlocked(blockResponse.data); setContent(contentResponse.data); setAppeals(appealResponse.data) })
        .catch(() => setSafetyError('Unable to load all Community safety records.'))
    }
  }, [navState])

  const unblock = async (userId: number) => { try { await portalApi.unblockCommunityUser(userId); setBlocked((items) => items.filter((item) => item.user.id !== userId)) } catch { setSafetyError('Unable to unblock this user.') } }
  const [appealItem, setAppealItem] = useState<CommunityOwnContent | null>(null)
  const [appealStatement, setAppealStatement] = useState('')
  const [appealBusy, setAppealBusy] = useState(false)
  const appeal = (item: CommunityOwnContent) => {
    if (!item.report_id) return
    setAppealItem(item)
    setAppealStatement('')
  }

  const policies = [
    { slug: 'community-standards', title: 'Community Standards', category: 'Rules & Moderation' },
    { slug: 'child-safety', title: 'Child Safety Standards', category: 'Safeguarding & Protection' },
    { slug: 'terms', title: 'Terms of Use', category: 'Legal Agreement' },
    { slug: 'privacy', title: 'Privacy Policy', category: 'Data & Identity Protection' },
    { slug: 'support', title: 'Contact Support', category: 'Help & Escalations' },
    { slug: 'account-deletion', title: 'Request Account Deletion', category: 'Account & Data Erasure' },
  ]

  const closeLevelOne = () => setNavState('none')
  const closePolicyDetail = () => setNavState('about')
  const levelOneSwipe = useSwipeBack(closeLevelOne, navState !== 'none')
  const detailSwipe = useSwipeBack(closePolicyDetail, navState === 'detail')

  const openDetail = async (slug: string) => {
    setLoadingDetail(true)
    setDetailError('')
    setNavState('detail')
    try {
      const res = await apiRequest<{ data: PublicPolicyDetail }>(`/v1/public/community-policies/${slug}`)
      setActivePolicy(res.data)
    } catch {
      setDetailError('Unable to load policy detail. Please try again.')
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="settings-about-trigger"
        onClick={() => setNavState('safety')}
        aria-label="Open Community Safety centre, reports and blocked users"
      >
        <ShieldCheck />
        <span>
          <small>Community</small>
          <strong>Safety centre, reports and blocked users</strong>
        </span>
        <ChevronRight />
      </button>

      <button
        type="button"
        className="settings-about-trigger"
        onClick={() => setNavState('about')}
        aria-label="Open About RYLAY and Legal Policies"
      >
        <Info />
        <span>
          <small>System & Legal</small>
          <strong>About RYLAY & Legal Policies</strong>
        </span>
        <ChevronRight />
      </button>

      {/* Level 1: Slide-In Overlay (Shared for About RYLAY and Safety Centre) */}
      {(navState === 'about' || navState === 'safety' || navState === 'detail') && createPortal(
        <div
          className={`subpage-slide-overlay ${levelOneSwipe.isExiting ? 'subpage-slide-out' : ''}`}
          role="region"
          aria-label={navState === 'safety' ? 'Community Safety Centre Subpage' : 'About RYLAY Subpage'}
          {...levelOneSwipe.gestureHandlers}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99990,
            background: '#f6f3ee',
            overflowY: 'auto',
            ...levelOneSwipe.surfaceStyle,
          }}
        >
          <div className="subpage-container">
            <header className="subpage-header">
              <button
                type="button"
                className="subpage-back-btn"
                onClick={levelOneSwipe.requestBack}
                aria-label="Back to Account settings"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="subpage-nav-title">
                {navState === 'safety' ? 'Safety Centre' : 'About RYLAY'}
              </h1>
              <div style={{ width: '38px', flexShrink: 0 }} />
            </header>

            {navState === 'about' && (
              <>
                <section className="subpage-content-group">
                  <div className="subpage-section-heading">
                    <b>Policies & Terms</b>
                    <small>Tap any policy to read details</small>
                  </div>

                  <div className="about-policy-list-card">
                    {policies.map((item, idx) => {
                      const isLast = idx === policies.length - 1
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          className="about-policy-item"
                          onClick={() => void openDetail(item.slug)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '14px 16px',
                            textDecoration: 'none',
                            border: 'none',
                            borderBottom: isLast ? 'none' : '1px solid rgba(221,217,209,0.65)',
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            className="about-item-text"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <strong
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: 'var(--app-ink, #172033)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                              }}
                            >
                              {item.title}
                            </strong>
                            <small
                              style={{
                                fontSize: '11px',
                                color: 'var(--app-muted, #717d96)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                              }}
                            >
                              {item.category}
                            </small>
                          </span>
                          <ChevronRight
                            size={18}
                            className="about-item-arrow"
                            style={{ color: '#a0aec0', flexShrink: 0, marginLeft: 'auto' }}
                          />
                        </button>
                      )
                    })}
                  </div>
                </section>
              </>
            )}

            {navState === 'safety' && (
              <>
                <small style={{ color: 'var(--app-muted)', display: 'block', margin: '0 4px 4px', fontSize: '12px' }}>
                  Only you and moderators can see this.
                </small>

                {safetyError && <p className="form-error" style={{ margin: 0 }}>{safetyError}</p>}

                <section className="subpage-content-group">
                  <div className="subpage-section-heading">
                    <b>My Reports</b>
                    <small>{reports.length} report{reports.length === 1 ? '' : 's'}</small>
                  </div>

                  <div className="subpage-policy-block">
                    {reports.length ? reports.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(221,217,209,0.65)' }}>
                        <div>
                          <strong>{label(item.reason_code)}</strong>
                          <small style={{ display: 'block', color: 'var(--app-muted)' }}>{item.target_type} report #{item.id}</small>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary-dark)' }}>{label(item.status)}</span>
                      </div>
                    )) : <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '13px' }}>No reports submitted.</p>}
                  </div>
                </section>

                <section className="subpage-content-group">
                  <div className="subpage-section-heading">
                    <b>Blocked Users</b>
                    <small>{blocked.length} blocked</small>
                  </div>

                  <div className="subpage-policy-block">
                    {blocked.length ? blocked.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                        <strong>{item.user.name}</strong>
                        <button
                          type="button"
                          className="subpage-back-btn"
                          style={{ padding: '6px 12px', fontSize: '12px', color: '#b42318', borderColor: 'rgba(180,35,24,0.2)' }}
                          aria-label={`Unblock ${item.user.name}`}
                          onClick={() => void unblock(item.user.id)}
                        >
                          Unblock
                        </button>
                      </div>
                    )) : <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '13px' }}>No blocked users.</p>}
                  </div>
                </section>

                <section className="subpage-content-group">
                  <div className="subpage-section-heading">
                    <b>Content Under Review</b>
                    <small>{content.length} item{content.length === 1 ? '' : 's'}</small>
                  </div>

                  <div className="subpage-policy-block">
                    {content.length ? content.map((item) => (
                      <div key={`${item.type}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                        <div>
                          <strong>{item.body}</strong>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--brand-primary-dark)', fontWeight: 600 }}>{label(item.status)}</span>
                        </div>
                        {item.report_id && ['rejected', 'hidden'].includes(item.status) && (
                          <button
                            type="button"
                            className="subpage-back-btn"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => void appeal(item)}
                          >
                            Appeal decision
                          </button>
                        )}
                      </div>
                    )) : <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '13px' }}>No content under review.</p>}
                  </div>
                </section>

                <section className="subpage-content-group">
                  <div className="subpage-section-heading">
                    <b>My Appeals</b>
                    <small>{appeals.length} appeal{appeals.length === 1 ? '' : 's'}</small>
                  </div>

                  <div className="subpage-policy-block">
                    {appeals.length ? appeals.map((item) => (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>Appeal #{item.id}</strong>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary-dark)' }}>{label(item.status)}</span>
                        </div>
                        {item.decision_reason && <small style={{ color: 'var(--app-muted)' }}>{item.decision_reason}</small>}
                      </div>
                    )) : <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '13px' }}>No appeals submitted.</p>}
                  </div>
                </section>

                <div className="subpage-safety-callout">
                  <strong>Emergency Notice:</strong> This reporting tool is not an emergency service. If someone is in immediate danger, contact local emergency services and a trusted school safeguarding contact.
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Level 2: Policy Term Detail Sub-Page (Renders on top at zIndex 99999) */}
      {navState === 'detail' && createPortal(
        <div
          className={`subpage-slide-overlay ${detailSwipe.isExiting ? 'subpage-slide-out' : ''}`}
          role="region"
          aria-label="Policy Detail Subpage"
          {...detailSwipe.gestureHandlers}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#f6f3ee',
            overflowY: 'auto',
            ...detailSwipe.surfaceStyle,
          }}
        >
          <div className="subpage-container">
            <header className="subpage-header">
              <button
                type="button"
                className="subpage-back-btn"
                onClick={detailSwipe.requestBack}
                aria-label="Back to About page"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="subpage-nav-title">
                {activePolicy?.title ?? 'Policy Detail'}
              </h1>
              <div style={{ width: '38px', flexShrink: 0 }} />
            </header>

            {loadingDetail ? (
              <div className="subpage-loading-skeleton">
                <div className="app-skeleton large" />
                <div className="app-skeleton" />
                <div className="app-skeleton" />
              </div>
            ) : detailError ? (
              <div className="app-empty">
                <h2>Policy detail unavailable</h2>
                <p>{detailError}</p>
                <button
                  type="button"
                  className="subpage-back-btn"
                  onClick={() => setNavState('about')}
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            ) : activePolicy ? (
              <article className="subpage-detail-article">
                <header className="subpage-detail-header">
                  <p className="subpage-eyebrow">{activePolicy.organization_name}</p>
                  <h1 className="subpage-title">{activePolicy.title}</h1>
                  {activePolicy.effective_at && (
                    <p className="subpage-version">
                      Effective {new Date(activePolicy.effective_at).toLocaleDateString()}
                      {activePolicy.version ? ` (v${activePolicy.version})` : ''}
                    </p>
                  )}
                </header>

                <div className="subpage-detail-body">
                  {activePolicy.sections.map((section, idx) => (
                    <section key={idx} className="subpage-policy-block">
                      <h2>{section.heading}</h2>
                      <p>{section.body}</p>
                    </section>
                  ))}

                  {['community-standards', 'child-safety'].includes(activePolicy.slug) && (
                    <div className="subpage-safety-callout">
                      <strong>Safety Disclosure:</strong> {activePolicy.store_safety_disclosure}
                    </div>
                  )}

                  {activePolicy.support?.email && (
                    <div className="subpage-support-info">
                      <p>For questions or support contact: <strong>{activePolicy.support.email}</strong></p>
                    </div>
                  )}
                </div>
              </article>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {appealItem !== null && createPortal(
        <div className="community-policy-modal-overlay" role="dialog" aria-modal="true" aria-label="Submit appeal dialog">
          <div className="community-policy-gate-modal" style={{ maxWidth: '440px' }}>
            <h2>Submit Appeal</h2>
            <p className="policy-gate-desc">Explain why this moderation decision should be reviewed again by a different moderator.</p>
            <textarea
              className="custom-textarea"
              rows={4}
              value={appealStatement}
              onChange={(e) => setAppealStatement(e.target.value)}
              placeholder="State the context or reasons for reconsideration…"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                className="secondary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                onClick={() => {
                  setAppealItem(null)
                  setAppealStatement('')
                }}
                disabled={appealBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                disabled={appealBusy || !appealStatement.trim()}
                onClick={async () => {
                  if (!appealItem.report_id) return
                  setAppealBusy(true)
                  try {
                    const response = await portalApi.submitCommunityAppeal(appealItem.report_id, appealStatement.trim())
                    setAppeals((items) => [response.data, ...items])
                    setAppealItem(null)
                    setAppealStatement('')
                  } catch {
                    setSafetyError('Unable to submit this appeal.')
                  } finally {
                    setAppealBusy(false)
                  }
                }}
              >
                {appealBusy ? 'Submitting…' : 'Submit Appeal'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
