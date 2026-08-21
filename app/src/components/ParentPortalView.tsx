import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, BookOpenCheck, CalendarCheck2, ChevronLeft, ChevronRight, LogOut, Mail, Phone, Printer, ReceiptText, UserRound } from 'lucide-react'
import { portalApi, type AttendanceRecord, type GuardianMe, type OutstandingCharge, type PortalPayment, type PortalReceipt, type PublishedAssessmentResult } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySafetyCentre } from '../features/community-safety/CommunitySafetyCentre'
import { CommunitySafetyLinks } from '../features/community-safety/CommunitySafetyLinks'
import { CustomSelect } from './CustomSelect'
import { useSwipeBack } from './useSwipeBack'

import { useSwipe } from './MobileShell'

export function ParentPortalView({ parentName, activeTab, onTabChange, onLogout }: { parentName: string; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void }) {
  const { dragOffset, isDragging } = useSwipe()
  const [guardian, setGuardian] = useState<GuardianMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { portalApi.getGuardianMe().then(setGuardian).catch(() => setError('Unable to load your linked children.')).finally(() => setLoading(false)) }, [])

  const [previousTab, setPreviousTab] = useState<string>('home')

  useEffect(() => {
    if (activeTab !== 'safety') {
      setPreviousTab(activeTab)
    }
  }, [activeTab])

  const children = guardian?.children ?? []
  const primaryTabs = ['home', 'children', 'academics', 'finance', 'more']
  const visibleTab = activeTab === 'safety' ? previousTab : activeTab
  const activeIndex = primaryTabs.indexOf(visibleTab)

  const trackTransform = activeIndex !== -1
    ? `calc(-${activeIndex * 100}% + ${dragOffset}px)`
    : '0px'

  const renderChildrenTab = () => {
    if (loading) return <PageLoading />
    if (error) return <PageError message={error} />
    return <ChildrenPage children={children} />
  }

  const renderAcademicsTab = () => {
    if (loading) return <PageLoading />
    if (error) return <PageError message={error} />
    return <ParentAcademics children={children} />
  }

  const renderFinanceTab = () => {
    if (loading) return <PageLoading />
    if (error) return <PageError message={error} />
    return <ParentFinance children={children} />
  }

  return (
    <>
    <div className="portal-viewpager-container">
      <div
        className="portal-viewpager-track"
        style={{
          transform: `translateX(${trackTransform})`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        <div className={`portal-tab-slide ${visibleTab === 'home' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <CommunityFeed role="parent" userName={parentName} onOpenFinance={() => onTabChange('finance')} activeTab={visibleTab} />
        </div>
        <div className={`portal-tab-slide ${visibleTab === 'children' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {renderChildrenTab()}
        </div>
        <div className={`portal-tab-slide ${visibleTab === 'academics' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {renderAcademicsTab()}
        </div>
        <div className={`portal-tab-slide ${visibleTab === 'finance' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {renderFinanceTab()}
        </div>
        <div className={`portal-tab-slide ${visibleTab === 'more' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <ParentMore name={guardian?.data?.full_name ?? parentName} phone={guardian?.data?.phone} email={guardian?.data?.email} childrenCount={children.length} onSafety={() => onTabChange('safety')} onLogout={onLogout} />
        </div>
      </div>
    </div>
    {activeTab === 'safety' && <CommunitySafetyCentre onBack={() => onTabChange(previousTab)} />}
    </>
  )
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

function ChildSelector({ children, selectedId, onChange }: { children: GuardianMe['children']; selectedId: number; onChange: (id: number) => void }) {
  if (children.length > 1) {
    const options = children.map((c) => ({
      value: c.id,
      label: `${c.full_name} · ${c.class?.name ?? 'No class'}`,
    }))
    return (
      <div className="child-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-muted)' }}>Viewing:</span>
        <CustomSelect
          value={selectedId}
          onChange={(val) => onChange(Number(val))}
          options={options}
          size="compact"
        />
      </div>
    )
  }
  return children[0] ? (
    <div className="selected-child">
      <span className="student-avatar small">{children[0].full_name[0]}</span>
      <span>
        <strong>{children[0].full_name}</strong>
        <small>{children[0].class?.name ?? 'No class'}</small>
      </span>
    </div>
  ) : null
}

function ParentFinance({ children }: { children: GuardianMe['children'] }) {
  const financeChildren = useMemo(() => children.filter((child) => child.can_view_finance), [children])
  const [selectedId, setSelectedId] = useState(financeChildren[0]?.id ?? 0)
  const [charges, setCharges] = useState<OutstandingCharge[]>([])
  const [payments, setPayments] = useState<PortalPayment[]>([])
  const [receipts, setReceipts] = useState<PortalReceipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<PortalReceipt | null>(null)
  const [loading, setLoading] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [error, setError] = useState('')
  const selectedChild = financeChildren.find((child) => child.id === selectedId)
  const academicYear = selectedChild?.academic_year?.code
  useEffect(() => {
    setSelectedReceipt(null)
    if (!selectedId || !academicYear) return
    setLoading(true)
    setError('')
    Promise.all([portalApi.getChildOutstanding(selectedId, academicYear), portalApi.getChildPayments(selectedId), portalApi.getChildReceipts(selectedId)])
      .then(([chargeResponse, paymentResponse, receiptResponse]) => { setCharges(chargeResponse.data); setPayments(paymentResponse.data); setReceipts(receiptResponse.data) })
      .catch(() => { setCharges([]); setPayments([]); setReceipts([]); setError('Unable to load finance records for this child.') })
      .finally(() => setLoading(false))
  }, [selectedId, academicYear])

  function openReceipt(receiptId: number) {
    if (!selectedId) return
    setReceiptLoading(true)
    setError('')
    portalApi.getChildReceipt(selectedId, receiptId)
      .then((response) => setSelectedReceipt(response.data))
      .catch(() => setError('Unable to open this receipt.'))
      .finally(() => setReceiptLoading(false))
  }

  const total = charges.reduce((sum, charge) => sum + Number(charge.outstanding_amount), 0)
  return <div className="record-page">
    <PageTitle eyebrow="Finance" title="School account" copy="Read-only records from the school finance ledger. No online payment is offered." />
    {financeChildren.length > 0 && <div className="finance-child-cards" aria-label="Choose a child">{financeChildren.map((child) => <button type="button" key={child.id} className={`finance-child-card${child.id === selectedId ? ' active' : ''}`} aria-label={`View ${child.full_name} finance`} aria-pressed={child.id === selectedId} onClick={() => setSelectedId(child.id)}><span className="student-avatar small">{child.full_name[0]}</span><span><strong>{child.full_name}</strong><small>{child.class?.name ?? 'No class'} · {child.student_no}</small></span></button>)}</div>}
    {financeChildren.length === 0 ? <div className="app-empty"><ReceiptText /><h2>Finance access unavailable</h2><p>No reviewed guardian link grants finance access.</p></div> : !academicYear ? <div className="app-empty"><ReceiptText /><h2>Academic year unavailable</h2><p>The school must confirm a current enrolment before finance records can be shown.</p></div> : loading ? <PageLoading /> : <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="finance-balance"><small>Outstanding balance</small><strong>{money(total)}</strong><span>{charges.length} open charge{charges.length === 1 ? '' : 's'}</span></section>
      <section className="record-section"><div className="section-heading"><span><b>Outstanding items</b><small>Academic year {academicYear}</small></span></div>{charges.length ? charges.map((charge) => <div className="finance-row" key={charge.id}><span><strong>{charge.description}</strong><small>{charge.billing_month} · {charge.fee_code}</small></span><b>{money(Number(charge.outstanding_amount))}</b></div>) : <p className="quiet-empty">No outstanding charges.</p>}</section>
      <section className="record-section"><div className="section-heading"><span><b>Payment history</b><small>{payments.length} record{payments.length === 1 ? '' : 's'}</small></span></div>{payments.map((payment) => <div className="finance-row" key={payment.id}><span><strong>{payment.issued_receipt?.receipt_no ?? 'Verified payment'}</strong><small>{payment.payment_date} · {payment.payment_method ?? 'Method not recorded'} · {payment.status}</small></span><b>{money(Number(payment.amount))}</b></div>)}{payments.length === 0 && <p className="quiet-empty">No payments found.</p>}</section>
      <section className="record-section"><div className="section-heading"><span><b>Receipts</b><small>View, print or save as PDF</small></span></div>{receipts.map((receipt) => <button type="button" className="receipt-row" key={receipt.id} aria-label={`View receipt ${receipt.receipt_no}`} onClick={() => openReceipt(receipt.id)} disabled={receiptLoading}><ReceiptText /><span><strong>{receipt.receipt_no}</strong><small>{receipt.receipt_date} · {receipt.status}</small></span><b>{money(Number(receipt.amount))}</b><ChevronRight /></button>)}{receipts.length === 0 && <p className="quiet-empty">No receipts found.</p>}</section>
    </>}
    {selectedReceipt && <ReceiptDialog receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
  </div>
}

function ReceiptDialog({ receipt, onClose }: { receipt: PortalReceipt; onClose: () => void }) {
  const { isExiting, requestBack: handleClose, surfaceStyle, gestureHandlers } = useSwipeBack(onClose)

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="dialog"
      aria-label={`Receipt ${receipt.receipt_no}`}
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
            onClick={handleClose}
            aria-label="Back to finance"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">Official Receipt</h1>
          <div style={{ width: '38px', flexShrink: 0 }} />
        </header>

        <section className="receipt-paper" style={{ margin: '16px 0 0', boxShadow: '0 4px 20px rgba(23,32,51,0.06)' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span>
              <small style={{ color: 'var(--app-muted)', fontSize: '11px', display: 'block' }}>Official receipt</small>
              <h2 style={{ margin: '2px 0 0', font: '700 20px "DM Sans"' }}>{receipt.receipt_no}</h2>
            </span>
            <span className={`status-label ${receipt.status === 'issued' ? 'success' : 'neutral'}`}>{receipt.status}</span>
          </header>

          <dl>
            <div><dt>Student</dt><dd>{receipt.student_name}<small>{receipt.student_no}</small></dd></div>
            <div><dt>Receipt date</dt><dd>{receipt.receipt_date}</dd></div>
            <div><dt>Paid by</dt><dd>{receipt.paid_by ?? 'Not recorded'}</dd></div>
            <div><dt>Method</dt><dd>{receipt.payment_method ?? 'Not recorded'}</dd></div>
          </dl>

          <div className="receipt-items">
            {receipt.items.map((item, index) => (
              <div key={`${item.fee_code}-${index}`}>
                <span>
                  <strong>{item.description}</strong>
                  <small>{item.fee_code}</small>
                </span>
                <b>{money(Number(item.amount))}</b>
              </div>
            ))}
          </div>

          <div className="receipt-total">
            <span>Total paid</span>
            <strong>{money(Number(receipt.amount))}</strong>
          </div>
          {receipt.amount_in_words && <p className="receipt-words">{receipt.amount_in_words}</p>}
        </section>

        <footer style={{ marginTop: '20px' }}>
          <button type="button" className="receipt-print" aria-label="Print or save receipt as PDF" onClick={() => window.print()}>
            <Printer size={18} /> Print or save as PDF
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

function ParentMore({ name, phone, email, childrenCount, onLogout }: { name: string; phone?: string | null; email?: string | null; childrenCount: number; onSafety?: () => void; onLogout: () => void }) { return <div className="record-page"><PageTitle eyebrow="Account" title="Profile and settings" copy="Your private MIS App access." /><section className="profile-card"><span className="profile-avatar">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{name}</h2><p>Parent · {childrenCount} linked child{childrenCount === 1 ? '' : 'ren'}</p></section><section className="settings-list"><div><Phone /><span><small>Phone</small><strong>{phone ?? 'Not provided'}</strong></span></div><div><Mail /><span><small>Email</small><strong>{email ?? 'Not provided'}</strong></span></div><CommunitySafetyLinks /><div><ChevronRight/><span><small>Notifications</small><strong>Open the bell in the header</strong></span></div><div><ChevronRight/><span><small>Privacy</small><strong>Only reviewed child links and authorized audiences are shown</strong></span></div></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value) }
function countAttendance(records: AttendanceRecord[]) { return { present: records.filter((item) => item.status === 'present').length, late: records.filter((item) => item.status === 'late').length, absent: records.filter((item) => item.status === 'absent').length } }
function percent(value: number, total: number) { return total === 0 ? 0 : (value / total) * 100 }
