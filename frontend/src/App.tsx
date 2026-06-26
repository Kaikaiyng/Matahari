import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Phone,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import misLogo from './assets/mis-logo.jpg'
import './App.css'

type DashboardResponse = {
  school: {
    id: number
    code: string
    name: string
  }
  metrics: {
    today_collection: number
    monthly_collection: number
    outstanding_fees: number
    active_students: number
    overdue_accounts: number
    invoices_this_month: number
  }
  recent_payments: Array<{
    id: number
    student: string
    amount: number
    method: string
    status: string
    payment_date: string
  }>
  outstanding_students: Array<{
    invoice_id: number
    student: string
    class_name: string | null
    amount: number
    due_date: string
    status: string
  }>
}

type PageKey =
  | 'dashboard'
  | 'students'
  | 'parents'
  | 'fees'
  | 'invoices'
  | 'payments'
  | 'receipts'
  | 'reports'
  | 'settings'

const fallbackDashboard: DashboardResponse = {
  school: { id: 1, code: 'MIS', name: 'Matahari International School' },
  metrics: {
    today_collection: 5230,
    monthly_collection: 86420,
    outstanding_fees: 38500,
    active_students: 187,
    overdue_accounts: 16,
    invoices_this_month: 187,
  },
  recent_payments: [
    {
      id: 1,
      student: 'Alyssa Tan',
      amount: 840,
      method: 'bank_transfer',
      status: 'confirmed',
      payment_date: '2026-07-05',
    },
    {
      id: 2,
      student: 'Daniel Lim',
      amount: 400,
      method: 'cash',
      status: 'confirmed',
      payment_date: '2026-07-05',
    },
    {
      id: 3,
      student: 'Mika Wong',
      amount: 920,
      method: 'qr',
      status: 'confirmed',
      payment_date: '2026-07-06',
    },
  ],
  outstanding_students: [
    {
      invoice_id: 1,
      student: 'Ethan Lee',
      class_name: 'Year 4',
      amount: 1680,
      due_date: '2026-07-10',
      status: 'overdue',
    },
    {
      invoice_id: 2,
      student: 'Sofia Rahman',
      class_name: 'Year 2',
      amount: 840,
      due_date: '2026-07-10',
      status: 'partial',
    },
    {
      invoice_id: 3,
      student: 'Marcus Ong',
      class_name: 'Year 6',
      amount: 2520,
      due_date: '2026-07-10',
      status: 'overdue',
    },
  ],
}

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'parents', label: 'Parents', icon: Users },
  { key: 'fees', label: 'Fees', icon: CreditCard },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'payments', label: 'Payments', icon: Banknote },
  { key: 'receipts', label: 'Receipts', icon: Receipt },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
] satisfies Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }>

const students = [
  {
    id: 'MIS-STD-0001',
    name: 'Alyssa Tan',
    gender: 'Female',
    dob: '2018-04-12',
    parent: 'Michelle Tan',
    className: 'Year 2',
    status: 'Active',
  },
  {
    id: 'MIS-STD-0002',
    name: 'Daniel Lim',
    gender: 'Male',
    dob: '2016-09-21',
    parent: 'Jonathan Lim',
    className: 'Year 4',
    status: 'Active',
  },
  {
    id: 'MIS-STD-0003',
    name: 'Sofia Rahman',
    gender: 'Female',
    dob: '2019-01-30',
    parent: 'Nadia Rahman',
    className: 'Year 1',
    status: 'Active',
  },
  {
    id: 'MIS-STD-0004',
    name: 'Marcus Ong',
    gender: 'Male',
    dob: '2015-12-08',
    parent: 'Grace Ong',
    className: 'Year 6',
    status: 'Inactive',
  },
]

const parents = [
  {
    name: 'Michelle Tan',
    phone: '+60 12-223 9018',
    email: 'michelle.tan@example.com',
    emergency: '+60 17-880 1293',
    address: 'Taman Desa, Kuala Lumpur',
  },
  {
    name: 'Jonathan Lim',
    phone: '+60 16-445 2088',
    email: 'jonathan.lim@example.com',
    emergency: '+60 11-664 5532',
    address: 'Bukit Jalil, Kuala Lumpur',
  },
  {
    name: 'Nadia Rahman',
    phone: '+60 13-771 6520',
    email: 'nadia.rahman@example.com',
    emergency: '+60 18-222 4190',
    address: 'Cyberjaya, Selangor',
  },
]

const feeStructures = [
  { item: 'Primary Year 1 Fee', type: 'Template', amount: 890, taxable: 'No', status: 'Active' },
  { item: 'Tuition Fee', type: 'Template Item', amount: 800, taxable: 'No', status: 'Active' },
  { item: 'Transport', type: 'Optional Add-on', amount: 120, taxable: 'No', status: 'Optional' },
  { item: 'Registration', type: 'One Time', amount: 50, taxable: 'No', status: 'Active' },
]

const invoices = [
  { no: 'INV-MIS-2026-000001', month: '2026-07', student: 'Alyssa Tan', amount: 840, due: '2026-07-10', status: 'Paid' },
  { no: 'INV-MIS-2026-000002', month: '2026-07', student: 'Daniel Lim', amount: 920, due: '2026-07-10', status: 'Partial' },
  { no: 'INV-MIS-2026-000003', month: '2026-07', student: 'Sofia Rahman', amount: 840, due: '2026-07-10', status: 'Overdue' },
]

const receipts = [
  { no: 'MIS-2026-000001', student: 'Alyssa Tan', payment: 'PAY-000001', amount: 840, date: '2026-07-05', method: 'Bank Transfer' },
  { no: 'MIS-2026-000002', student: 'Daniel Lim', payment: 'PAY-000002', amount: 400, date: '2026-07-05', method: 'Cash' },
  { no: 'MIS-2026-000003', student: 'Mika Wong', payment: 'PAY-000003', amount: 920, date: '2026-07-06', method: 'QR' },
]

const reports = [
  { name: 'Daily Collection', owner: 'Finance', period: 'Today', output: 'Excel / PDF' },
  { name: 'Monthly Collection', owner: 'Principal', period: 'July 2026', output: 'Excel / PDF' },
  { name: 'Outstanding Fees', owner: 'CEO', period: 'Current', output: 'Excel / PDF' },
  { name: 'Student Ledger', owner: 'Finance', period: 'Per Student', output: 'PDF' },
]

const users = [
  { name: 'CEO View', role: 'CEO', school: 'All Schools', permission: 'Group reports' },
  { name: 'School Admin', role: 'School Admin', school: 'MIS', permission: 'Student and parent management' },
  { name: 'Finance Admin', role: 'Finance', school: 'MIS', permission: 'Invoices, payments, receipts' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('MYR', 'RM')
}

function formatMethod(method: string) {
  return method
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('overdue') || normalized.includes('inactive')) {
    return 'danger'
  }
  if (normalized.includes('paid') || normalized.includes('active') || normalized.includes('confirmed')) {
    return 'paid'
  }
  if (normalized.includes('partial') || normalized.includes('optional') || normalized.includes('rule')) {
    return 'partial'
  }
  return 'neutral'
}

function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: string
}) {
  return (
    <section className="page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="primary-action compact">
          <Plus size={17} />
          {action}
        </button>
      )}
    </section>
  )
}

function StudentsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Student module" title="Student Profiles" action="Add Student" />
      <div className="summary-grid three">
        <article className="metric-card positive">
          <span>Active Students</span>
          <strong>187</strong>
        </article>
        <article className="metric-card">
          <span>New This Month</span>
          <strong>9</strong>
        </article>
        <article className="metric-card warning">
          <span>Missing Fee Setup</span>
          <strong>4</strong>
        </article>
      </div>
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>DOB</th>
                <th>Parent</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.gender}</td>
                  <td>{student.dob}</td>
                  <td>{student.parent}</td>
                  <td>{student.className}</td>
                  <td>
                    <span className={`badge ${statusClass(student.status)}`}>{student.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function ParentsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Parent module" title="Parent Contacts" action="Add Parent" />
      <section className="cards-grid">
        {parents.map((parent) => (
          <article className="contact-card" key={parent.email}>
            <div className="contact-avatar">{parent.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <h3>{parent.name}</h3>
              <p>{parent.address}</p>
            </div>
            <span>
              <Phone size={15} />
              {parent.phone}
            </span>
            <span>
              <Mail size={15} />
              {parent.email}
            </span>
            <span>
              <ShieldCheck size={15} />
              Emergency: {parent.emergency}
            </span>
          </article>
        ))}
      </section>
    </section>
  )
}

function FeesPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Fee structure" title="Fee Templates and Discount Rules" action="Create Template" />
      <section className="content-grid">
        <article className="panel payments-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2>Default MIS Fee Template</h2>
            </div>
            <strong className="panel-total">RM890</strong>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Taxable</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {feeStructures.map((fee) => (
                  <tr key={fee.item}>
                    <td>{fee.item}</td>
                    <td>{fee.type}</td>
                    <td>{formatCurrency(fee.amount)}</td>
                    <td>{fee.taxable}</td>
                    <td>
                      <span className={`badge ${statusClass(fee.status)}`}>{fee.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Rules</p>
              <h2>Discount Engine</h2>
            </div>
            <CheckCircle2 className="success-icon" size={22} />
          </div>
          <div className="rule-list">
            <div>Sibling Discount <b>10%</b></div>
            <div>Old Student Discount <b>Custom</b></div>
            <div>Referral Discount <b>Manual Approval</b></div>
            <div>Scholarship <b>Fixed / Percent</b></div>
          </div>
        </article>
      </section>
    </section>
  )
}

function InvoicesPage({ generateInvoices, generationState }: { generateInvoices: () => void; generationState: string }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Monthly billing" title="Invoices" />
      <section className="hero-strip slim">
        <div>
          <p className="eyebrow">Batch generation</p>
          <h2>Generate July 2026 invoices</h2>
          <p>{generationState}</p>
        </div>
        <button className="primary-action" onClick={generateInvoices}>
          <FileText size={18} />
          Generate Invoices
        </button>
      </section>
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Month</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.no}>
                  <td>{invoice.no}</td>
                  <td>{invoice.month}</td>
                  <td>{invoice.student}</td>
                  <td>{formatCurrency(invoice.amount)}</td>
                  <td>{invoice.due}</td>
                  <td>
                    <span className={`badge ${statusClass(invoice.status)}`}>{invoice.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function PaymentsPage({ dashboard }: { dashboard: DashboardResponse }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Payment module" title="Record and Allocate Payments" action="Record Payment" />
      <section className="summary-grid three">
        <article className="metric-card positive">
          <span>Today Received</span>
          <strong>{formatCurrency(dashboard.metrics.today_collection)}</strong>
        </article>
        <article className="metric-card">
          <span>Payment Methods</span>
          <strong>Cash / Bank / QR</strong>
        </article>
        <article className="metric-card warning">
          <span>Partial Payments</span>
          <strong>6</strong>
        </article>
      </section>
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recent_payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.student}</td>
                  <td>{payment.payment_date}</td>
                  <td>{formatMethod(payment.method)}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>
                    <span className={`badge ${statusClass(payment.status)}`}>
                      {formatMethod(payment.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function ReceiptsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Receipt module" title="Auto-numbered Receipts" action="Print Receipt" />
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Student</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.no}>
                  <td>{receipt.no}</td>
                  <td>{receipt.student}</td>
                  <td>{receipt.payment}</td>
                  <td>{formatCurrency(receipt.amount)}</td>
                  <td>{receipt.date}</td>
                  <td>{receipt.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function ReportsPage({ dashboard }: { dashboard: DashboardResponse }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Reports" title="Finance and Student Reports" action="Export Report" />
      <section className="summary-grid three">
        <article className="metric-card">
          <span>Monthly Collection</span>
          <strong>{formatCurrency(dashboard.metrics.monthly_collection)}</strong>
        </article>
        <article className="metric-card danger">
          <span>Outstanding</span>
          <strong>{formatCurrency(dashboard.metrics.outstanding_fees)}</strong>
        </article>
        <article className="metric-card">
          <span>Students</span>
          <strong>{dashboard.metrics.active_students}</strong>
        </article>
      </section>
      <section className="cards-grid report-grid">
        {reports.map((report) => (
          <article className="report-card" key={report.name}>
            <BarChart3 size={22} />
            <h3>{report.name}</h3>
            <p>{report.owner} / {report.period}</p>
            <strong>{report.output}</strong>
          </article>
        ))}
      </section>
    </section>
  )
}

function SettingsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Settings" title="Schools, Users and Permissions" action="Invite User" />
      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Multi-school</p>
              <h2>School Setup</h2>
            </div>
            <Building2 size={22} />
          </div>
          <div className="rule-list">
            <div>Matahari International School <b>MIS</b></div>
            <div>Kindergarten A <b>Future</b></div>
            <div>Kindergarten B <b>Future</b></div>
            <div>Future Schools <b>No code change</b></div>
          </div>
        </article>
        <article className="panel payments-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">RBAC</p>
              <h2>User Roles</h2>
            </div>
            <LockKeyhole size={22} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>School</th>
                  <th>Permission</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.name}>
                    <td>{user.name}</td>
                    <td>{user.role}</td>
                    <td>{user.school}</td>
                    <td>{user.permission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  )
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard)
  const [apiState, setApiState] = useState<'live' | 'demo' | 'loading'>('loading')
  const [generationState, setGenerationState] = useState<string>('Ready to generate')
  const [activePage, setActivePage] = useState<PageKey>('dashboard')

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard/school?school_id=1&invoice_month=2026-07')
      if (!response.ok) {
        throw new Error('Dashboard API unavailable')
      }
      setDashboard(await response.json())
      setApiState('live')
    } catch {
      setDashboard(fallbackDashboard)
      setApiState('demo')
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const metrics = useMemo(
    () => [
      {
        label: "Today's Collection",
        value: formatCurrency(dashboard.metrics.today_collection),
        tone: 'positive',
      },
      {
        label: 'Monthly Collection',
        value: formatCurrency(dashboard.metrics.monthly_collection),
        tone: 'neutral',
      },
      {
        label: 'Outstanding Fees',
        value: formatCurrency(dashboard.metrics.outstanding_fees),
        tone: 'danger',
      },
      { label: 'Active Students', value: String(dashboard.metrics.active_students), tone: 'neutral' },
      { label: 'Overdue Accounts', value: String(dashboard.metrics.overdue_accounts), tone: 'warning' },
      {
        label: 'Invoices This Month',
        value: String(dashboard.metrics.invoices_this_month),
        tone: 'neutral',
      },
    ],
    [dashboard],
  )

  const generateInvoices = async () => {
    setGenerationState('Generating...')
    try {
      const response = await fetch('/api/invoices/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: dashboard.school.id,
          invoice_month: '2026-07',
          issue_date: '2026-07-01',
          due_date: '2026-07-10',
        }),
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const result = (await response.json()) as {
        created_count: number
        skipped_count: number
      }
      setGenerationState(
        `Created ${result.created_count}, skipped ${result.skipped_count} existing invoices`,
      )
      await loadDashboard()
    } catch {
      setGenerationState('Backend unavailable, showing demo data')
      setApiState('demo')
    }
  }

  const pageTitle = navItems.find((item) => item.key === activePage)?.label ?? 'Dashboard'

  const renderPage = () => {
    if (activePage === 'students') {
      return <StudentsPage />
    }

    if (activePage === 'parents') {
      return <ParentsPage />
    }

    if (activePage === 'fees') {
      return <FeesPage />
    }

    if (activePage === 'invoices') {
      return <InvoicesPage generateInvoices={generateInvoices} generationState={generationState} />
    }

    if (activePage === 'payments') {
      return <PaymentsPage dashboard={dashboard} />
    }

    if (activePage === 'receipts') {
      return <ReceiptsPage />
    }

    if (activePage === 'reports') {
      return <ReportsPage dashboard={dashboard} />
    }

    if (activePage === 'settings') {
      return <SettingsPage />
    }

    return (
      <>
        <section className="hero-strip">
          <div>
            <p className="eyebrow">Monthly billing</p>
            <h2>Generate July 2026 invoices for active students</h2>
            <p>{generationState}</p>
          </div>
          <button className="primary-action" onClick={generateInvoices}>
            <FileText size={18} />
            Generate July 2026 Invoices
          </button>
        </section>

        <section className="metrics-grid" aria-label="Dashboard metrics">
          {metrics.map((metric) => (
            <article className={`metric-card ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel payments-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Collection</p>
                <h2>Recent Payments</h2>
              </div>
              <button className="secondary-action" onClick={() => setActivePage('payments')}>
                View All
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.student}</td>
                      <td>{payment.payment_date}</td>
                      <td>{formatMethod(payment.method)}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>
                        <span className={`badge ${statusClass(payment.status)}`}>
                          {formatMethod(payment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dashboard.recent_payments.length === 0 && (
                    <tr>
                      <td colSpan={5}>No payments recorded yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Attention</p>
                <h2>Outstanding Students</h2>
              </div>
              <AlertTriangle className="warning-icon" size={22} />
            </div>

            <div className="outstanding-list">
              {dashboard.outstanding_students.map((item) => (
                <div className="outstanding-item" key={item.invoice_id}>
                  <div>
                    <strong>{item.student}</strong>
                    <span>
                      {item.class_name ?? 'No class'} / due {item.due_date}
                    </span>
                  </div>
                  <b>{formatCurrency(item.amount)}</b>
                </div>
              ))}
              {dashboard.outstanding_students.length === 0 && (
                <div className="empty-state">No outstanding invoices yet</div>
              )}
            </div>
          </article>
        </section>
      </>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={misLogo} alt="MIS logo" />
          <div>
            <strong>IEM</strong>
            <span>Finance Admin</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activePage === item.key ? 'nav-item active' : 'nav-item'}
                key={item.label}
                onClick={() => setActivePage(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">IEM Education Platform / {dashboard.school.name}</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className={`api-pill ${apiState}`}>{apiState === 'live' ? 'Live API' : 'Demo data'}</div>
            <label className="search-box">
              <Search size={17} />
              <input placeholder="Search student, invoice, receipt" />
            </label>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <div className="user-chip">
              <span>FA</span>
              <div>
                <strong>Finance Admin</strong>
                <small>{dashboard.school.code} Campus</small>
              </div>
            </div>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  )
}

export default App
