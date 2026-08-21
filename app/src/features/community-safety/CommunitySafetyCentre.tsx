import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { portalApi, type CommunityAppeal, type CommunityBlockedUser, type CommunityOwnContent, type CommunityReportSummary } from '../../api/portalApi'
import { useSwipeBack } from '../../components/useSwipeBack'
import './CommunitySafety.css'

const label = (value: string) => { const words = value.replaceAll('_', ' '); return words.charAt(0).toUpperCase() + words.slice(1) }

export function CommunitySafetyCentreTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="settings-about-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open Community Safety centre, reports and blocked users"
      >
        <ShieldCheck />
        <span>
          <small>Community</small>
          <strong>Safety centre, reports and blocked users</strong>
        </span>
        <ChevronRight />
      </button>

      {open && (
        <CommunitySafetyCentre onBack={() => setOpen(false)} />
      )}
    </>
  )
}

export function CommunitySafetyCentre({ onBack }: { onBack?: () => void }) {
  const [reports, setReports] = useState<CommunityReportSummary[]>([])
  const [blocked, setBlocked] = useState<CommunityBlockedUser[]>([])
  const [content, setContent] = useState<CommunityOwnContent[]>([])
  const [appeals, setAppeals] = useState<CommunityAppeal[]>([])
  const [error, setError] = useState('')

  const returnToPrevious = () => onBack ? onBack() : window.history.back()
  const { isExiting, requestBack: handleBack, surfaceStyle, gestureHandlers } = useSwipeBack(returnToPrevious)

  useEffect(() => {
    Promise.all([portalApi.getCommunityReports(), portalApi.getBlockedCommunityUsers(), portalApi.getMyCommunityContent(), portalApi.getCommunityAppeals()])
      .then(([reportResponse, blockResponse, contentResponse, appealResponse]) => { setReports(reportResponse.data); setBlocked(blockResponse.data); setContent(contentResponse.data); setAppeals(appealResponse.data) })
      .catch(() => setError('Unable to load all Community safety records.'))
  }, [])

  const unblock = async (userId: number) => { try { await portalApi.unblockCommunityUser(userId); setBlocked((items) => items.filter((item) => item.user.id !== userId)) } catch { setError('Unable to unblock this user.') } }
  const [appealItem, setAppealItem] = useState<CommunityOwnContent | null>(null)
  const [appealStatement, setAppealStatement] = useState('')
  const [appealBusy, setAppealBusy] = useState(false)
  const appeal = (item: CommunityOwnContent) => {
    if (!item.report_id) return
    setAppealItem(item)
    setAppealStatement('')
  }

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label="Community Safety Centre Subpage"
      {...gestureHandlers}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        ...surfaceStyle,
      }}
    >
      <div className="subpage-container">
        <header className="subpage-header">
          <button
            type="button"
            className="subpage-back-btn"
            onClick={handleBack}
            aria-label="Back to previous page"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">Safety Centre</h1>
          <div style={{ width: '38px', flexShrink: 0 }} />
        </header>

        <small style={{ color: 'var(--app-muted)', display: 'block', margin: '0 4px 4px', fontSize: '12px' }}>
          Only you and moderators can see this.
        </small>

        {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

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
      </div>

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
                    setError('Unable to submit this appeal.')
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
    </div>,
    document.body
  )
}
