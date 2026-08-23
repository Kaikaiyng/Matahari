import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react'
import { ApiError } from '../../api'
import { CustomSelect } from '../../components/AdminUi'
import { moderationApi, type ModerationCase, type ModerationDecision, type PlatformCase, type PlatformSummary } from './moderationApi'
import './UgcModerationPage.css'

const reasons = ['no_violation', 'bullying_harassment', 'child_safety', 'hate', 'sexual_content', 'threats_violence', 'self_harm', 'spam', 'impersonation', 'privacy_exposure', 'other']
const human = (value: string) => { const words = value.replaceAll('_', ' '); return words.charAt(0).toUpperCase() + words.slice(1) }

export function UgcModerationPage({ permissions, currentUserId }: { permissions: string[]; currentUserId: number }) {
  const platformMode = permissions.includes('community.moderate_platform')
  const [queue, setQueue] = useState<ModerationCase[]>([])
  const [summary, setSummary] = useState<PlatformSummary | null>(null)
  const [selected, setSelected] = useState<ModerationCase | PlatformCase | null>(null)
  const [decision, setDecision] = useState<ModerationDecision | ''>('')
  const [reasonCode, setReasonCode] = useState('')
  const [reason, setReason] = useState('')
  const [restrictionScope, setRestrictionScope] = useState<'comment' | 'publish' | 'media' | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      if (platformMode) setSummary((await moderationApi.getPlatformSummary()).data)
      else setQueue((await moderationApi.getSchoolQueue()).data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load moderation cases.') }
  }, [platformMode])
  useEffect(() => { void load() }, [load])

  const openCase = async (id: number) => {
    setError(''); setNotice('')
    try { setSelected((platformMode ? await moderationApi.getPlatformCase(id) : await moderationApi.getSchoolCase(id)).data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to open this case.') }
  }
  const submitDecision = async () => {
    if (!selected || !decision || !reasonCode || !reason.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (platformMode) await moderationApi.decidePlatformCase(selected.id, decision === 'escalate' ? 'hide' : decision, reasonCode, reason.trim())
      else await moderationApi.decideSchoolCase(selected.id, decision, reasonCode, reason.trim())
      setNotice('Decision recorded with its audit history.'); setSelected(null); setDecision(''); setReasonCode(''); setReason(''); await load()
    } catch (caught) { setError(apiMessage(caught)) } finally { setBusy(false) }
  }
  const restrict = async () => {
    if (!selected || !reasonCode || !reason.trim()) return
    setBusy(true); setError('')
    try { await moderationApi.restrictCommunityUser(selected.target_snapshot.reported_user_id, restrictionScope, reasonCode, reason.trim()); setNotice('Community-only restriction applied.') }
    catch (caught) { setError(apiMessage(caught)) } finally { setBusy(false) }
  }
  const decideAppeal = async (appealId: number, appealDecision: 'upheld' | 'overturned') => {
    if (!reason.trim()) { setError('Enter a decision reason before reviewing an appeal.'); return }
    setBusy(true); setError('')
    try { await moderationApi.decideAppeal(appealId, appealDecision, reason.trim()); setNotice('Appeal decision recorded.'); await openCase(selected!.id) }
    catch (caught) { setError(apiMessage(caught)) } finally { setBusy(false) }
  }

  return <section className="ugc-workspace">
    <header className="ugc-header"><div><p>{platformMode ? 'Platform safety' : 'School safety'}</p><h1>Community moderation</h1><span>Review evidence, take proportionate action, and preserve an auditable reason.</span></div><ShieldCheck /></header>
    {error && <p className="ugc-message error" role="alert">{error}</p>}{notice && <p className="ugc-message success" role="status">{notice}</p>}
    {platformMode ? <PlatformQueue summary={summary} onOpen={openCase} /> : <SchoolQueue cases={queue} onOpen={openCase} />}
    {selected && <CaseDetail item={selected} platformMode={platformMode} currentUserId={currentUserId} decision={decision} reasonCode={reasonCode} reason={reason} restrictionScope={restrictionScope} busy={busy} onDecision={setDecision} onReasonCode={setReasonCode} onReason={setReason} onRestrictionScope={setRestrictionScope} onSubmit={submitDecision} onRestrict={restrict} onAppeal={decideAppeal} />}
  </section>
}

function SchoolQueue({ cases, onOpen }: { cases: ModerationCase[]; onOpen: (id: number) => void }) {
  return <section className="ugc-queue" aria-label="Moderation queue"><h2>Review queue</h2>{cases.length ? cases.map((item) => <button key={item.id} type="button" className={item.priority === 'severe' ? 'severe' : ''} onClick={() => void onOpen(item.id)}><span><strong>Case #{item.id}</strong><small>{human(item.reason_code)} · {human(item.target_type)}</small></span><span className="ugc-tags"><b>{human(item.priority)}</b>{item.overdue && <em>Overdue</em>}{item.has_pending_appeal && <em>Appeal</em>}</span></button>) : <p>No open cases.</p>}</section>
}

function PlatformQueue({ summary, onOpen }: { summary: PlatformSummary | null; onOpen: (id: number) => void }) {
  if (!summary) return <div className="ugc-loading">Loading platform summary…</div>
  return <><section className="ugc-stats"><strong>{summary.open} open cases</strong><span>{summary.severe_open} severe</span><span>{summary.overdue} overdue</span></section><section className="ugc-queue" aria-label="Moderation queue"><h2>Severe and escalated cases</h2>{summary.severe_cases.map((item) => <button key={item.id} type="button" onClick={() => void onOpen(item.id)}><span><strong>Case #{item.id}</strong><small>Tenant {item.tenant_id} · School {item.school_id}</small></span><span className="ugc-tags"><b>{human(item.priority)}</b>{item.overdue && <em>Overdue</em>}</span></button>)}</section><section className="ugc-tenants"><h2>Open cases by tenant</h2>{summary.by_tenant.map((item) => <p key={item.tenant_id}><span>Tenant {item.tenant_id}</span><strong>{item.total}</strong></p>)}</section></>
}

type DetailProps = { item: ModerationCase | PlatformCase; platformMode: boolean; currentUserId: number; decision: ModerationDecision | ''; reasonCode: string; reason: string; restrictionScope: 'comment' | 'publish' | 'media' | 'all'; busy: boolean; onDecision: (value: ModerationDecision) => void; onReasonCode: (value: string) => void; onReason: (value: string) => void; onRestrictionScope: (value: 'comment' | 'publish' | 'media' | 'all') => void; onSubmit: () => void; onRestrict: () => void; onAppeal: (id: number, decision: 'upheld' | 'overturned') => void }
function CaseDetail({ item, platformMode, currentUserId, decision, reasonCode, reason, restrictionScope, busy, onDecision, onReasonCode, onReason, onRestrictionScope, onSubmit, onRestrict, onAppeal }: DetailProps) {
  const evidence = item.target_snapshot.post ?? item.target_snapshot.comment
  const decisionOptions = [{ value: '', label: 'Select action' }, { value: 'no_violation', label: 'No violation' }, { value: 'approve', label: 'Approve' }, { value: 'reject', label: 'Reject' }, { value: 'hide', label: 'Hide' }, { value: 'warn', label: 'Warn' }, ...(!platformMode ? [{ value: 'escalate', label: 'Escalate to platform' }] : [])]
  return <section className="ugc-detail" aria-label={`Case #${item.id} detail`}><header><div><p>{human(item.priority)} case #{item.id}</p><h2>{human(item.reason_code)}</h2>{'tenant_id' in item && <span>Tenant {item.tenant_id} · School {item.school_id}</span>}</div>{item.overdue && <b><Clock3 />Overdue</b>}</header><div className="ugc-evidence"><h3>Preserved evidence</h3><p>{evidence?.body ?? 'User-level report; no content body attached.'}</p>{item.target_snapshot.post?.media.map((media) => <div key={media.id}><AlertTriangle /><span><strong>{media.name ?? `Media #${media.id}`}</strong><small>{media.mime_type} · {media.status}</small></span></div>)}</div><div className="ugc-decision"><label>Decision<CustomSelect ariaLabel="Decision" value={decision} onChange={(value) => onDecision(value as ModerationDecision)} options={decisionOptions} /></label><label>Reason category<CustomSelect ariaLabel="Reason category" value={reasonCode} onChange={onReasonCode} options={[{ value: '', label: 'Select reason' }, ...reasons.map((value) => ({ value, label: human(value) }))]} /></label><label>Decision reason<textarea aria-label="Decision reason" rows={4} value={reason} onChange={(event) => onReason(event.target.value)} /></label><button type="button" className="ugc-primary" disabled={busy || !decision || !reasonCode || !reason.trim()} onClick={() => void onSubmit()}>Apply decision</button>{!platformMode && <div className="ugc-restrict"><label>Community restriction<CustomSelect ariaLabel="Community restriction" value={restrictionScope} onChange={(value) => onRestrictionScope(value as DetailProps['restrictionScope'])} options={[{ value: 'comment', label: 'Comments only' }, { value: 'publish', label: 'Publishing only' }, { value: 'media', label: 'Media only' }, { value: 'all', label: 'All Community contribution' }]} /></label><button type="button" disabled={busy || !reasonCode || !reason.trim()} onClick={() => void onRestrict()}>Apply restriction</button></div>}</div>{!platformMode && item.appeals?.map((appeal) => <article className="ugc-appeal" key={appeal.id}><h3>Appeal #{appeal.id}</h3><p>{appeal.statement}</p>{appeal.source_moderator_user_id === currentUserId ? <strong>A different moderator must decide this appeal.</strong> : appeal.status === 'submitted' ? <div><button type="button" disabled={busy} onClick={() => void onAppeal(appeal.id, 'upheld')}>Uphold appeal</button><button type="button" disabled={busy} onClick={() => void onAppeal(appeal.id, 'overturned')}>Overturn decision</button></div> : <span>{human(appeal.decision ?? appeal.status)}</span>}</article>)}</section>
}

function apiMessage(caught: unknown) { return caught instanceof ApiError && caught.errors ? Object.values(caught.errors).flat()[0] ?? caught.message : caught instanceof Error ? caught.message : 'Unable to complete this moderation action.' }
