import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BookOpenCheck, CalendarCheck2, ChevronRight, LogOut, Mail, Phone, ReceiptText, UserRound } from 'lucide-react'
import { portalApi, type AttendanceRecord, type GuardianMe, type OutstandingCharge, type PortalPayment, type PortalReceipt, type PublishedAssessmentResult } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'

export function ParentPortalView({ parentName, activeTab, onTabChange, onLogout }: { parentName: string; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void }) {
  const [guardian, setGuardian] = useState<GuardianMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { portalApi.getGuardianMe().then(setGuardian).catch(() => setError('Unable to load your linked children.')).finally(() => setLoading(false)) }, [])

  if (activeTab === 'home') return <CommunityFeed role="parent" userName={parentName} onOpenFinance={() => onTabChange('finance')} />
  if (loading) return <PageLoading />
  if (error) return <PageError message={error} />

  const children = guardian?.children ?? []
  if (activeTab === 'children') return <ChildrenPage children={children} />
  if (activeTab === 'academics') return <ParentAcademics children={children} />
  if (activeTab === 'finance') return <ParentFinance children={children} />
  return <ParentMore name={guardian?.data?.full_name ?? parentName} phone={guardian?.data?.phone} email={guardian?.data?.email} childrenCount={children.length} onLogout={onLogout} />
}

function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header>
}

function PageLoading() { return <div className="record-page"><div className="app-skeleton large" /><div className="app-skeleton" /><div className="app-skeleton" /></div> }
function PageError({ message }: { message: string }) { return <div className="record-page"><div className="app-empty"><AlertCircle /><h2>We could not load this page</h2><p>{message}</p></div></div> }

function ChildrenPage({ children }: { children: GuardianMe['children'] }) {
  return <div className="record-page"><PageTitle eyebrow="Family" title="Your children" copy="School information for children linked to your account." />{children.length === 0 ? <div className="app-empty"><UserRound /><h2>No linked children</h2><p>Ask the school office to review your guardian link.</p></div> : children.map((child) => <article className="child-overview" key={child.id}><div className="child-identity"><span className="student-avatar">{child.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{child.full_name}</strong><small>{child.class?.name ?? 'Class not assigned'} · {child.student_no}</small></span><span className="status-label success">Active</span></div><div className="child-snapshot"><div><CalendarCheck2 /><span><small>Academics</small><strong>{child.can_view_academics ? 'Available' : 'Restricted'}</strong></span></div><div><ReceiptText /><span><small>Finance</small><strong>{child.can_view_finance ? 'Available' : 'Restricted'}</strong></span></div></div></article>)}</div>
}

function ParentAcademics({ children }: { children: GuardianMe['children'] }) {
  const academicChildren = useMemo(() => children.filter((child) => child.can_view_academics), [children])
  const [selectedId, setSelectedId] = useState(academicChildren[0]?.id ?? 0)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [results, setResults] = useState<PublishedAssessmentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const child = academicChildren.find((item) => item.id === selectedId)
  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setError('')
    Promise.all([portalApi.getChildAttendance(selectedId), portalApi.getChildAssessmentResults(selectedId)]).then(([attendanceResponse, resultResponse]) => { setAttendance(attendanceResponse.data); setResults(resultResponse.data) }).catch(() => setError('Unable to load academic records.')).finally(() => setLoading(false))
  }, [selectedId])
  const counts = countAttendance(attendance)
  return <div className="record-page"><PageTitle eyebrow="Academics" title="Learning progress" copy="Live attendance and teacher-published assessment results." /><ChildSelector children={academicChildren} selectedId={selectedId} onChange={setSelectedId} />{child ? <>{loading ? <div className="app-skeleton" /> : <section className="attendance-hero"><div><small>Recorded sessions</small><strong>{attendance.length}</strong><span>Attendance</span></div><div className="attendance-bars" aria-label={`${counts.present} present, ${counts.late} late, ${counts.absent} absent`}><i className="present" style={{ width: `${percent(counts.present, attendance.length)}%` }} /><i className="late" style={{ width: `${percent(counts.late, attendance.length)}%` }} /><i className="absent" style={{ width: `${percent(counts.absent, attendance.length)}%` }} /></div><p><span>{counts.present} Present</span><span>{counts.late} Late</span><span>{counts.absent} Absent</span></p>{error && <small className="form-error">{error}</small>}</section>}<div className="section-heading"><span><b>Published results</b><small>{results.length} result{results.length === 1 ? '' : 's'}</small></span></div>{results.map((result) => <ResultRow key={result.id} subject={result.subject} assessment={result.title} score={`${result.score} / ${result.max_score}`} grade={result.grade_label ?? '—'} comment={result.teacher_comment} />)}{results.length === 0 && !loading && <p className="quiet-empty">No assessment results have been published.</p>}</> : <div className="app-empty"><BookOpenCheck /><h2>No academic access</h2><p>No linked child with reviewed academic access is available.</p></div>}</div>
}

function ResultRow({ subject, assessment, score, grade, comment }: { subject: string; assessment: string; score: string; grade: string; comment: string | null }) { return <div className="result-row"><span><strong>{subject}</strong><small>{assessment}{comment ? ` · ${comment}` : ''}</small></span><b>{score}</b><i>{grade}</i><ChevronRight /></div> }

function ChildSelector({ children, selectedId, onChange }: { children: GuardianMe['children']; selectedId: number; onChange: (id: number) => void }) { return children.length > 1 ? <label className="child-selector"><span>Viewing</span><select value={selectedId} onChange={(event) => onChange(Number(event.target.value))}>{children.map((child) => <option key={child.id} value={child.id}>{child.full_name} · {child.class?.name ?? 'No class'}</option>)}</select></label> : children[0] ? <div className="selected-child"><span className="student-avatar small">{children[0].full_name[0]}</span><span><strong>{children[0].full_name}</strong><small>{children[0].class?.name ?? 'No class'}</small></span></div> : null }

function ParentFinance({ children }: { children: GuardianMe['children'] }) {
  const financeChildren = useMemo(() => children.filter((child) => child.can_view_finance), [children])
  const [selectedId, setSelectedId] = useState(financeChildren[0]?.id ?? 0)
  const [charges, setCharges] = useState<OutstandingCharge[]>([])
  const [payments, setPayments] = useState<PortalPayment[]>([])
  const [receipts, setReceipts] = useState<PortalReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const selectedChild = financeChildren.find((child) => child.id === selectedId)
  const academicYear = selectedChild?.academic_year?.code
  useEffect(() => { if (!selectedId || !academicYear) return; setLoading(true); Promise.all([portalApi.getChildOutstanding(selectedId, academicYear), portalApi.getChildPayments(selectedId), portalApi.getChildReceipts(selectedId)]).then(([chargeResponse, paymentResponse, receiptResponse]) => { setCharges(chargeResponse.data); setPayments(paymentResponse.data); setReceipts(receiptResponse.data) }).catch(() => { setCharges([]); setPayments([]); setReceipts([]) }).finally(() => setLoading(false)) }, [selectedId, academicYear])
  const total = charges.reduce((sum, charge) => sum + Number(charge.outstanding_amount), 0)
  return <div className="record-page"><PageTitle eyebrow="Finance" title="School account" copy="Read-only records from the MIS finance ledger. No online payment is offered." /><ChildSelector children={financeChildren} selectedId={selectedId} onChange={setSelectedId} />{financeChildren.length === 0 ? <div className="app-empty"><ReceiptText /><h2>Finance access unavailable</h2><p>No reviewed guardian link grants finance access.</p></div> : !academicYear ? <div className="app-empty"><ReceiptText /><h2>Academic year unavailable</h2><p>The school must confirm a current enrolment before finance records can be shown.</p></div> : loading ? <PageLoading /> : <><section className="finance-balance"><small>Outstanding balance</small><strong>{money(total)}</strong><span>{charges.length} open charge{charges.length === 1 ? '' : 's'}</span></section><section className="record-section"><div className="section-heading"><span><b>Outstanding items</b><small>Academic year {academicYear}</small></span></div>{charges.length ? charges.map((charge) => <div className="finance-row" key={charge.id}><span><strong>{charge.description}</strong><small>{charge.billing_month} · {charge.fee_code}</small></span><b>{money(Number(charge.outstanding_amount))}</b></div>) : <p className="quiet-empty">No outstanding charges.</p>}</section><section className="record-section"><div className="section-heading"><span><b>Verified payments</b><small>{payments.length} records</small></span></div>{payments.slice(0, 3).map((payment) => <div className="finance-row" key={payment.id}><span><strong>{payment.issued_receipt?.receipt_no ?? 'Verified payment'}</strong><small>{payment.payment_date} · {payment.payment_method ?? 'Method not recorded'}</small></span><b>{money(Number(payment.amount))}</b></div>)}{payments.length === 0 && <p className="quiet-empty">No verified payments found.</p>}</section><section className="record-section"><div className="section-heading"><span><b>Receipts</b><small>Official MIS records · viewing only</small></span></div>{receipts.slice(0, 3).map((receipt) => <div className="receipt-row" key={receipt.id}><ReceiptText /><span><strong>{receipt.receipt_no}</strong><small>{receipt.receipt_date}</small></span><b>{money(Number(receipt.amount))}</b></div>)}{receipts.length === 0 && <p className="quiet-empty">No receipts found.</p>}</section></>}</div>
}

function ParentMore({ name, phone, email, childrenCount, onLogout }: { name: string; phone?: string | null; email?: string | null; childrenCount: number; onLogout: () => void }) { return <div className="record-page"><PageTitle eyebrow="Account" title="Profile and settings" copy="Your private MIS App access." /><section className="profile-card"><span className="profile-avatar">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{name}</h2><p>Parent · {childrenCount} linked child{childrenCount === 1 ? '' : 'ren'}</p></section><section className="settings-list"><div><Phone /><span><small>Phone</small><strong>{phone ?? 'Not provided'}</strong></span></div><div><Mail /><span><small>Email</small><strong>{email ?? 'Not provided'}</strong></span></div><button type="button" disabled><span><small>Notifications · coming later</small><strong>App notification preferences</strong></span><ChevronRight /></button><button type="button" disabled><span><small>Privacy · coming later</small><strong>Community and media information</strong></span><ChevronRight /></button></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value) }
function countAttendance(records: AttendanceRecord[]) { return { present: records.filter((item) => item.status === 'present').length, late: records.filter((item) => item.status === 'late').length, absent: records.filter((item) => item.status === 'absent').length } }
function percent(value: number, total: number) { return total === 0 ? 0 : (value / total) * 100 }
