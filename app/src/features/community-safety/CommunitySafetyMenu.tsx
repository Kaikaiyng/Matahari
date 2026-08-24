import { useState } from 'react'
import { Ellipsis, ShieldAlert } from 'lucide-react'
import { portalApi } from '../../api/portalApi'
import './CommunitySafety.css'

const reasons = [['bullying_harassment', 'Bullying or harassment'], ['child_safety', 'Child safety concern'], ['hate', 'Hate speech'], ['threats_violence', 'Violence or threat'], ['spam', 'Spam'], ['privacy_exposure', 'Privacy concern'], ['other', 'Other']] as const

export function CommunitySafetyMenu({ postId, canReport }: { postId: number; canReport: boolean }) {
  const [open, setOpen] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false)
  if (!canReport) return null
  const submit = async () => { if (!reason) return; setBusy(true); setNotice(''); try { await portalApi.reportSchoolUpdate(postId, reason, details); setReporting(false); setOpen(false); setReason(''); setDetails(''); setNotice('Your report was sent to the school moderation team.') } catch { setNotice('Unable to send this report. It may already be under review.') } finally { setBusy(false) } }
  return <div className="community-safety-menu"><button type="button" className="plain-icon" aria-expanded={open} aria-label="Safety actions" onClick={() => setOpen((value) => !value)}><Ellipsis /></button>{open && !reporting && <div className="safety-popover" role="menu"><button type="button" onClick={() => setReporting(true)}>Report update</button></div>}{reporting && <div className="safety-dialog" role="dialog" aria-modal="true" aria-label="Report school update"><h3><ShieldAlert /> Report update</h3><p>Reports are confidential and reviewed by authorized school staff. This is not an emergency service.</p><fieldset><legend>Reason</legend>{reasons.map(([value, label]) => <label key={value}><input type="radio" name={`reason-${postId}`} value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset><label><span>More details (optional)</span><textarea maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} /></label><div className="safety-dialog-actions"><button type="button" onClick={() => setReporting(false)}>Cancel</button><button type="button" className="primary-action" disabled={!reason || busy} onClick={() => void submit()}>Submit report</button></div></div>}{notice && <p className="safety-notice" role="status">{notice}</p>}</div>
}
