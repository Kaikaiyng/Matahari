import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react'
import { ApiError } from '../../api'
import { CustomSelect } from '../../components/AdminUi'
import { moderationApi, type ModerationCase, type ModerationDecision } from './moderationApi'
import './UgcModerationPage.css'

const reasonCodes = ['incorrect', 'outdated', 'inappropriate', 'other']

const human = (value: string) => {
  const words = value.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function UgcModerationPage() {
  const [queue, setQueue] = useState<ModerationCase[]>([])
  const [selected, setSelected] = useState<ModerationCase | null>(null)
  const [decision, setDecision] = useState<ModerationDecision | ''>('')
  const [reasonCode, setReasonCode] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setQueue((await moderationApi.getSchoolQueue()).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load post reports.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openReport = async (id: number) => {
    setError('')
    setNotice('')
    try {
      setSelected((await moderationApi.getSchoolCase(id)).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this post report.')
    }
  }

  const submitDecision = async () => {
    if (!selected || !decision || !reasonCode || !reason.trim()) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await moderationApi.decideSchoolCase(selected.id, decision, reasonCode, reason.trim())
      setNotice('Decision recorded with its audit history.')
      setSelected(null)
      setDecision('')
      setReasonCode('')
      setReason('')
      await load()
    } catch (caught) {
      setError(apiMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return <section className="ugc-workspace">
    <header className="ugc-header"><div><p>School updates</p><h1>Post Reports</h1><span>Review reported posts, preserve their evidence, and record a reason for every decision.</span></div><ShieldCheck /></header>
    {error && <p className="ugc-message error" role="alert">{error}</p>}
    {notice && <p className="ugc-message success" role="status">{notice}</p>}
    <PostReportQueue cases={queue} onOpen={openReport} />
    {selected && <PostReportDetail item={selected} decision={decision} reasonCode={reasonCode} reason={reason} busy={busy} onDecision={setDecision} onReasonCode={setReasonCode} onReason={setReason} onSubmit={submitDecision} />}
  </section>
}

function PostReportQueue({ cases, onOpen }: { cases: ModerationCase[]; onOpen: (id: number) => void }) {
  return <section className="ugc-queue" aria-label="Post reports queue"><h2>Reported posts</h2>{cases.length ? cases.map((item) => <button key={item.id} type="button" className={item.priority === 'severe' ? 'severe' : ''} onClick={() => void onOpen(item.id)}><span><strong>Post report #{item.id}</strong><small>{human(item.reason_code)} · {human(item.status)}</small></span><span className="ugc-tags"><b>{human(item.priority)}</b>{item.overdue && <em>Overdue</em>}</span></button>) : <p>No open post reports.</p>}</section>
}

type DetailProps = {
  item: ModerationCase
  decision: ModerationDecision | ''
  reasonCode: string
  reason: string
  busy: boolean
  onDecision: (value: ModerationDecision) => void
  onReasonCode: (value: string) => void
  onReason: (value: string) => void
  onSubmit: () => void
}

function PostReportDetail({ item, decision, reasonCode, reason, busy, onDecision, onReasonCode, onReason, onSubmit }: DetailProps) {
  const post = item.target_snapshot.post
  const audience = item.post?.audience
  const audienceLabel = audience?.school ? 'Whole school' : audience?.classes.map((schoolClass) => schoolClass.name).join('; ') || 'No audience recorded'

  return <section className="ugc-detail" aria-label={`Post report #${item.id} detail`}><header><div><p>{human(item.priority)} post report #{item.id}</p><h2>{human(item.reason_code)}</h2><span>{human(item.status)} · reported {timestamp(item.created_at)}</span></div>{item.overdue && <b><Clock3 />Overdue</b>}</header><div className="ugc-evidence"><h3>Preserved evidence</h3><p>{post?.body ?? 'No post snapshot is available.'}</p>{post?.media.map((media) => <div key={media.id}><AlertTriangle /><span><strong>{media.name ?? `Media #${media.id}`}</strong><small>{media.mime_type} · {media.status}</small></span></div>)}</div><div className="ugc-metadata"><p>Reporter: {item.reporter?.name ?? 'Not provided'}</p><p>Post author: {item.post?.author?.name ?? 'Not provided'}</p><p>Audience: {audienceLabel}</p><p>Report details: {item.details ?? 'No additional details provided.'}</p><p>Due: {timestamp(item.due_at)}</p></div><div className="ugc-decision"><label>Decision<CustomSelect ariaLabel="Decision" value={decision} onChange={(value) => onDecision(value as ModerationDecision)} options={[{ value: '', label: 'Select action' }, { value: 'no_action', label: 'No action' }, { value: 'remove_content', label: 'Remove content' }]} /></label><label>Reason category<CustomSelect ariaLabel="Reason category" value={reasonCode} onChange={onReasonCode} options={[{ value: '', label: 'Select reason' }, ...reasonCodes.map((value) => ({ value, label: human(value) }))]} /></label><label>Decision reason<textarea aria-label="Decision reason" rows={4} value={reason} onChange={(event) => onReason(event.target.value)} /></label><button type="button" className="ugc-primary" disabled={busy || !decision || !reasonCode || !reason.trim()} onClick={() => void onSubmit()}>Apply decision</button></div><section className="ugc-history" aria-label="Action history"><h3>Action history</h3>{item.actions.length ? item.actions.map((action) => <p key={action.id}><strong>{human(action.action)}</strong>{action.actor ? ` by ${action.actor.name}` : ''}{action.reason ? ` — ${action.reason}` : ''}<small>{timestamp(action.created_at)}</small></p>) : <p>No actions recorded.</p>}</section></section>
}

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}

function apiMessage(caught: unknown) {
  return caught instanceof ApiError && caught.errors ? Object.values(caught.errors).flat()[0] ?? caught.message : caught instanceof Error ? caught.message : 'Unable to complete this post report decision.'
}
