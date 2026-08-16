import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { portalApi, type CommunityAppeal, type CommunityBlockedUser, type CommunityOwnContent, type CommunityReportSummary } from '../../api/portalApi'
import './CommunitySafety.css'

const label = (value: string) => { const words = value.replaceAll('_', ' '); return words.charAt(0).toUpperCase() + words.slice(1) }

export function CommunitySafetyCentre() {
  const [reports, setReports] = useState<CommunityReportSummary[]>([])
  const [blocked, setBlocked] = useState<CommunityBlockedUser[]>([])
  const [content, setContent] = useState<CommunityOwnContent[]>([])
  const [appeals, setAppeals] = useState<CommunityAppeal[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([portalApi.getCommunityReports(), portalApi.getBlockedCommunityUsers(), portalApi.getMyCommunityContent(), portalApi.getCommunityAppeals()])
      .then(([reportResponse, blockResponse, contentResponse, appealResponse]) => { setReports(reportResponse.data); setBlocked(blockResponse.data); setContent(contentResponse.data); setAppeals(appealResponse.data) })
      .catch(() => setError('Unable to load all Community safety records.'))
  }, [])

  const unblock = async (userId: number) => { try { await portalApi.unblockCommunityUser(userId); setBlocked((items) => items.filter((item) => item.user.id !== userId)) } catch { setError('Unable to unblock this user.') } }
  const appeal = async (item: CommunityOwnContent) => {
    if (!item.report_id) return
    const statement = window.prompt('Explain why this moderation decision should be reviewed again.')?.trim()
    if (!statement) return
    try { const response = await portalApi.submitCommunityAppeal(item.report_id, statement); setAppeals((items) => [response.data, ...items]) } catch { setError('Unable to submit this appeal.') }
  }

  return <div className="record-page community-safety-centre">
    <header className="record-page-title"><p>Community</p><h1>Safety centre</h1><span>Report concerns, manage blocks, and follow private moderation cases.</span></header>
    <div className="safety-privacy"><ShieldCheck /><span><strong>Your safety activity is private</strong><small>Only you and moderators can see this.</small></span></div>
    {error && <p className="form-error">{error}</p>}
    <section><h2>My reports</h2>{reports.length ? reports.map((item) => <article key={item.id}><strong>{label(item.reason_code)}</strong><span>{label(item.status)}</span><small>{item.target_type} report #{item.id}</small></article>) : <p>No reports submitted.</p>}</section>
    <section><h2>Blocked users</h2>{blocked.length ? blocked.map((item) => <article key={item.id}><strong>{item.user.name}</strong><button type="button" aria-label={`Unblock ${item.user.name}`} onClick={() => void unblock(item.user.id)}>Unblock</button></article>) : <p>No blocked users.</p>}</section>
    <section><h2>My content under review</h2>{content.length ? content.map((item) => <article key={`${item.type}-${item.id}`}><strong>{item.body}</strong><span>{label(item.status)}</span>{item.report_id && ['rejected', 'hidden'].includes(item.status) && <button type="button" onClick={() => void appeal(item)}>Appeal decision</button>}</article>) : <p>No content under review.</p>}</section>
    <section><h2>My appeals</h2>{appeals.length ? appeals.map((item) => <article key={item.id}><strong>Appeal #{item.id}</strong><span>{label(item.status)}</span>{item.decision_reason && <small>{item.decision_reason}</small>}</article>) : <p>No appeals submitted.</p>}</section>
    <p className="safety-emergency">This reporting tool is not an emergency service. If someone is in immediate danger, contact local emergency services and a trusted school safeguarding contact.</p>
  </div>
}
