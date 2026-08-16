import { useState } from 'react'
import { Ellipsis, ShieldAlert } from 'lucide-react'
import { portalApi } from '../../api/portalApi'
import './CommunitySafety.css'

const reasons = [
  ['bullying_harassment', 'Bullying or harassment'], ['child_safety', 'Child safety concern'],
  ['hate_speech', 'Hate speech'], ['sexual_content', 'Sexual content'], ['violence_threat', 'Violence or threat'],
  ['spam', 'Spam'], ['impersonation', 'Impersonation'], ['privacy', 'Privacy concern'], ['other', 'Other'],
] as const

type Props = { targetType: 'post' | 'comment'; targetId: number; authorUserId: number; canReportContent: boolean; canReportUser: boolean; onBlocked: () => void }

export function CommunitySafetyMenu({ targetType, targetId, authorUserId, canReportContent, canReportUser, onBlocked }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'content' | 'user' | 'block' | null>(null)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submitReport = async () => {
    if (!reason) return
    setBusy(true); setNotice('')
    try {
      if (mode === 'content') await portalApi.reportCommunityContent(targetType, targetId, reason, details)
      else await portalApi.reportCommunityUser(authorUserId, reason, details)
      setMode(null); setOpen(false); setReason(''); setDetails(''); setNotice('Your report was sent to the school moderation team.')
    } catch { setNotice('Unable to send this report. It may already be under review.') } finally { setBusy(false) }
  }

  const block = async () => {
    setBusy(true); setNotice('')
    try { await portalApi.blockCommunityUser(authorUserId); setMode(null); setOpen(false); onBlocked() } catch { setNotice('Unable to block this user.') } finally { setBusy(false) }
  }

  if (!canReportContent && !canReportUser) return null
  return <div className="community-safety-menu">
    <button type="button" className="plain-icon" aria-expanded={open} aria-label="Safety actions" onClick={() => { setOpen(!open); setMode(null) }}><Ellipsis /></button>
    {open && !mode && <div className="safety-popover" role="menu">
      {canReportContent && <button type="button" onClick={() => setMode('content')}>Report content</button>}
      {canReportUser && <button type="button" onClick={() => setMode('user')}>Report user</button>}
      {canReportUser && <button type="button" onClick={() => setMode('block')}>Block user</button>}
    </div>}
    {(mode === 'content' || mode === 'user') && <div className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby={`report-${targetType}-${targetId}`}>
      <h3 id={`report-${targetType}-${targetId}`}><ShieldAlert />Report {mode === 'content' ? 'content' : 'user'}</h3>
      <p>Choose the closest reason. Reports are confidential and reviewed by authorized moderators. This is not an emergency service; contact local emergency services if someone is in immediate danger.</p>
      <fieldset><legend>Reason</legend>{reasons.map(([value, label]) => <label key={value}><input type="radio" name={`reason-${targetType}-${targetId}`} value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset>
      <label><span>More details (optional)</span><textarea maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} /></label>
      <div className="safety-dialog-actions"><button type="button" onClick={() => setMode(null)}>Cancel</button><button type="button" className="primary-action" disabled={!reason || busy} onClick={() => void submitReport()}>Submit report</button></div>
    </div>}
    {mode === 'block' && <div className="safety-dialog" role="dialog" aria-modal="true" aria-label="Block user confirmation"><h3>Block this user?</h3><p>You will no longer see each other's Community posts, comments, or reactions. School records and official messages are not affected.</p><div className="safety-dialog-actions"><button type="button" onClick={() => setMode(null)}>Cancel</button><button type="button" className="danger-action" disabled={busy} onClick={() => void block()}>Confirm block</button></div></div>}
    {notice && <p className="safety-notice" role="status">{notice}</p>}
  </div>
}
