import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const currentUser = {
  id: 1,
  name: 'Demo Admin',
  email: 'admin@mis.test',
  school_id: 1,
  roles: ['school-admin'],
  permissions: ['students.view', 'fee_record.view'],
}

const dashboard = {
  school: { id: 1, code: 'MIS', name: 'Matahari International School' },
  metrics: {
    today_collection: 0,
    monthly_collection: 0,
    outstanding_fees: 0,
    active_students: 1,
    overdue_accounts: 0,
    invoices_this_month: 0,
  },
  recent_payments: [],
  outstanding_students: [],
}

const student = {
  id: 1,
  student_no: 'MIS-2026-001',
  full_name: 'Alyssa Tan',
  level_group: 'primary',
  class: { id: 1, name: 'Year 4' },
  fee_amount: 0,
  outstanding_balance: 0,
  status: 'active',
  gender: null,
  dob: null,
  registration_date: '2026-01-08',
  notes: null,
  parents: [],
}

const feeRecordSummary = {
  student_id: 1,
  student_no: student.student_no,
  student_name: student.full_name,
  level_group: student.level_group,
  class_name: student.class.name,
  total_expected: 1200,
  total_paid: 400,
  total_outstanding: 800,
  outstanding_months: ['2026-07'],
  outstanding_categories: ['School Fees'],
  latest_receipt_no: null,
  latest_receipt_date: null,
  collection_status_summary: 'partial',
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

function installApiMock() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/me')) return json({ user: currentUser })
    if (url.pathname.endsWith('/dashboard/school')) return json(dashboard)
    if (url.pathname.endsWith('/students/1/fee-agreements')) return json({ data: [] })
    if (url.pathname.endsWith('/students/1')) return json({ student })
    if (url.pathname.endsWith('/students')) return json({ data: [student] })
    if (url.pathname.endsWith('/fee-record/summary')) return json({ data: [feeRecordSummary] })

    return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
  })
}

async function renderAuthenticatedApp() {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await screen.findByRole('heading', { name: 'Dashboard' })
}

describe('demo shell', () => {
  beforeEach(() => installApiMock())
  afterEach(() => vi.restoreAllMocks())

  it('shows only destinations that are ready for the demo', async () => {
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(navigation).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Dashboard',
      'Students',
      'Parents',
      'Fees',
      'Fee Record',
    ])
    expect(within(navigation).getByText('Overview')).toBeInTheDocument()
    expect(within(navigation).getByText('People')).toBeInTheDocument()
    expect(within(navigation).getByText('Finance')).toBeInTheDocument()
    expect(screen.queryByText('MVP phase')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/coming in the next frontend pass/i)).not.toBeInTheDocument()
  })

  it('replaces the student list with a focused student workspace', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await screen.findByRole('heading', { name: 'Student List' })
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })

    expect(screen.queryByRole('heading', { name: 'Student List' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to students/i })).toBeInTheDocument()
  })

  it('uses business-facing Fee Record cards and headings', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Fee Record' }))
    await screen.findByRole('heading', { name: 'Fee Record' })

    const totalExpectedLabel = screen.getAllByText('Total Expected').find((element) => element.tagName === 'SPAN')
    expect(totalExpectedLabel?.closest('article')).toHaveClass('metric-card')
    expect(screen.queryByText(/read-only charge-cell/i)).not.toBeInTheDocument()
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
  })

  it('opens a Fee Record student directly without loading the full student list', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Fee Record' }))
    await user.click(await screen.findByRole('button', { name: 'Alyssa Tan' }))
    const fetchMock = vi.mocked(globalThis.fetch)
    const studentDetailRequestIndex = fetchMock.mock.calls.findIndex(([input]) => String(input).includes('/students/1'))
    const studentListRequestIndex = fetchMock.mock.calls.findIndex(([input]) => String(input).includes('/students?'))

    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    expect(studentDetailRequestIndex).toBeGreaterThan(-1)
    expect(studentListRequestIndex).toBe(-1)
  })
})
