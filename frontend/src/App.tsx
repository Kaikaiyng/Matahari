import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
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
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Students', icon: GraduationCap },
  { label: 'Parents', icon: Users },
  { label: 'Fees', icon: CreditCard },
  { label: 'Invoices', icon: FileText },
  { label: 'Payments', icon: Banknote },
  { label: 'Receipts', icon: Receipt },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
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

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard)
  const [apiState, setApiState] = useState<'live' | 'demo' | 'loading'>('loading')
  const [generationState, setGenerationState] = useState<string>('Ready to generate')

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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={misLogo} alt="MIS logo" />
          <div>
            <strong>{dashboard.school.code}</strong>
            <span>Finance Admin</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button className={item.active ? 'nav-item active' : 'nav-item'} key={item.label}>
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
            <p className="eyebrow">{dashboard.school.name}</p>
            <h1>School Fee Dashboard</h1>
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
              <button className="secondary-action">View All</button>
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
                        <span className="badge paid">{formatMethod(payment.status)}</span>
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
      </main>
    </div>
  )
}

export default App
