import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const currentUser = {
  id: 1,
  name: 'Demo Admin',
  username: 'admin',
  school_id: 1,
  roles: ['school-admin'],
  permissions: [
    'calendar.view',
    'calendar.create',
    'calendar.update',
    'calendar.delete',
    'students.view',
    'students.create',
    'fee_agreements.create',
    'fee_agreements.update',
    'fee_record.view',
    'fee_record.generate',
    'fee_record.manage',
    'payments.view',
    'payments.create',
    'payments.verify',
    'payments.void',
    'receipts.view',
    'receipts.create',
    'receipts.void',
    'receipts.print',
  ],
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
  class: { id: 5, name: 'MD1' },
  fee_amount: 0,
  outstanding_balance: 0,
  status: 'active',
  gender: null,
  dob: null,
  registration_date: '2026-01-08',
  notes: null,
  parents: [],
}

const schoolClasses = [
  { id: 1, name: 'Kindergarten', level_group: 'kindergarten' },
  { id: 2, name: 'MA1', level_group: 'primary' },
  { id: 3, name: 'MB1', level_group: 'primary' },
  { id: 4, name: 'MC1', level_group: 'primary' },
  { id: 5, name: 'MD1', level_group: 'primary' },
  { id: 6, name: 'ME1', level_group: 'primary' },
  { id: 7, name: 'MF1', level_group: 'primary' },
  { id: 8, name: 'MP1', level_group: 'secondary' },
  { id: 9, name: 'MQ1', level_group: 'secondary' },
  { id: 10, name: 'MR1', level_group: 'secondary' },
  { id: 11, name: 'MS1', level_group: 'secondary' },
  { id: 12, name: 'MT1', level_group: 'secondary' },
  { id: 13, name: 'STP', level_group: 'stp' },
]

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

const pendingPayment = {
  id: 11,
  student_id: 1,
  payment_method: 'bank_transfer',
  payment_date: '2026-07-17',
  received_date: null,
  amount: 400,
  paid_by: 'Michelle Tan',
  bank_account: null,
  reference_no: 'PAY-11',
  payment_proof: null,
  remark: null,
  status: 'pending_verification',
  recorded_by: { id: 1, name: 'Demo Admin' },
  verified_by: null,
  verified_at: null,
  voided_by: null,
  voided_at: null,
  void_reason: null,
  issued_receipt: null,
  allocations: [],
}

const issuedReceipt = {
  id: 21,
  receipt_no: 'RCP-21',
  receipt_date: '2026-07-17',
  status: 'issued',
  school_id: 1,
  payment_id: 11,
  active_payment_id: 11,
  student_id: 1,
  student_no: student.student_no,
  student_name: student.full_name,
  paid_by: 'Michelle Tan',
  payment_method: 'bank_transfer',
  payment_date: '2026-07-17',
  received_date: '2026-07-17',
  amount: 400,
  amount_in_words: 'Four hundred ringgit only',
  issued_by: { id: 1, name: 'Demo Admin' },
  issued_at: '2026-07-17T12:00:00Z',
  voided_by: null,
  voided_at: null,
  void_reason: null,
  items: [],
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
    if (url.pathname.endsWith('/calendar-events')) return json({ data: [] })
    if (url.pathname.endsWith('/students/1/fee-agreements')) return json({ data: [] })
    if (url.pathname.endsWith('/students/1/payments')) return json({ data: [pendingPayment] })
    if (url.pathname.endsWith('/students/1/receipts')) return json({ data: [issuedReceipt] })
    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) return json({ data: [] })
    if (url.pathname.endsWith('/fee-items')) return json({ data: [] })
    if (url.pathname.endsWith('/classes')) return json({ data: schoolClasses })
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
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    installApiMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('explains that the saved session is being checked', () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise<Response>(() => undefined))

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })

  it('uses empty username credentials and submits the username login payload', async () => {
    const user = userEvent.setup()
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/me')) return json({ message: 'Unauthenticated.' }, 401)
      if (url.pathname.endsWith('/login')) return json({ user: currentUser })

      return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
    })

    render(<App />)

    const username = await screen.findByLabelText('Username')
    const password = screen.getByLabelText('Password')
    expect(username).toHaveValue('')
    expect(password).toHaveValue('')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()

    await user.type(username, 'admin')
    await user.type(password, 'password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/login$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'password' }),
      }),
    ))
  })

  it('shows an invalid-credentials message only once', async () => {
    const user = userEvent.setup()
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/me')) return json({ message: 'Unauthenticated.' }, 401)
      if (url.pathname.endsWith('/login')) {
        return json(
          {
            message: 'The provided credentials are incorrect.',
            errors: { username: ['The provided credentials are incorrect.'] },
          },
          422,
        )
      }

      return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
    })

    render(<App />)

    await user.type(await screen.findByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findAllByText('The provided credentials are incorrect.')).toHaveLength(1)
  })

  it('uses a compact Dashboard header and shared metric cards', async () => {
    await renderAuthenticatedApp()

    expect(screen.getByRole('heading', { name: 'School overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Students' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Dashboard metrics' })).toBeInTheDocument()
    expect(document.querySelector('.hero-strip')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.stat-card')).toHaveLength(4)
  })

  it('shows the complete sidebar including display-only modules', async () => {
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(navigation).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Dashboard',
      'Calendar',
      'Students',
      'Parents',
      'Fees',
      'Fee Record',
      'Invoices',
      'Payments',
      'Receipts',
      'Reports',
      'Settings',
    ])
    expect(within(navigation).getByText('Overview')).toBeInTheDocument()
    expect(within(navigation).getByText('People')).toBeInTheDocument()
    expect(within(navigation).getByText('Finance')).toBeInTheDocument()
    expect(within(navigation).getByText('Management')).toBeInTheDocument()
  })

  it('opens Calendar with the active school context', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(await screen.findByRole('region', { name: 'School calendar' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        vi.mocked(globalThis.fetch).mock.calls.some(([input]) => {
          const url = new URL(String(input))
          return url.pathname.endsWith('/calendar-events') && url.searchParams.get('school_id') === '1'
        }),
      ).toBe(true),
    )
  })

  it.each([
    ['Invoices', 'Invoice Module'],
    ['Payments', 'Payment Module'],
    ['Receipts', 'Receipt Module'],
    ['Reports', 'Reports Module'],
    ['Settings', 'Settings Module'],
  ])('opens %s as a not-yet-developed display page', async (destination, pageTitle) => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: destination }))

    expect((await screen.findAllByRole('heading', { name: pageTitle })).length).toBeGreaterThan(0)
    expect(screen.getByText('Module not included in this MVP')).toBeInTheDocument()
  })

  it('uses a dedicated filter toolbar and data panel on Students', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))

    expect(await screen.findByRole('region', { name: 'Student filters' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student List' })).toBeInTheDocument()
    expect(screen.getAllByText('Active').some((element) => element.classList.contains('status-badge'))).toBe(true)
  })

  it.each([
    ['Parents', 'Parent Directory'],
    ['Fees', 'Fee Catalogue'],
  ])('uses the shared data hierarchy on %s', async (destination, panelTitle) => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: destination }))

    expect(await screen.findByRole('region', { name: panelTitle })).toBeInTheDocument()
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
    expect(totalExpectedLabel?.closest('article')).toHaveClass('stat-card')
    expect(screen.queryByText(/read-only charge-cell/i)).not.toBeInTheDocument()
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
  })

  it('opens Add Student in the shared modal and closes without submitting', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add Student' }))

    expect(screen.getByRole('dialog', { name: 'Create Student Profile' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Create Student Profile' })).not.toBeInTheDocument()
  })

  it('shows the configured child classes for each student level group', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add Student' }))

    const levelGroup = screen.getByLabelText('Level Group')
    const schoolClass = screen.getByLabelText('Class')

    expect(within(schoolClass).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Select class',
      'MA1',
      'MB1',
      'MC1',
      'MD1',
      'ME1',
      'MF1',
    ])

    await user.selectOptions(levelGroup, 'secondary')
    expect(within(schoolClass).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Select class',
      'MP1',
      'MQ1',
      'MR1',
      'MS1',
      'MT1',
    ])

    await user.selectOptions(levelGroup, 'kindergarten')
    expect(within(schoolClass).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Select class',
      'Kindergarten',
    ])

    await user.selectOptions(levelGroup, 'stp')
    expect(within(schoolClass).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Select class',
      'STP',
    ])
  })

  it('uses the shared modal frame for financial workflows', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })

    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
    expect(screen.getByRole('dialog', { name: 'Create Fee Agreement' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Add Manual Charge' }))
    expect(screen.getByRole('dialog', { name: 'Add Manual Charge' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Create Payment' }))
    expect(screen.getByRole('dialog', { name: 'Record Payment' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(await screen.findByRole('button', { name: 'Verify' }))
    expect(screen.getByRole('dialog', { name: 'Verify Payment' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    const voidButtons = screen.getAllByRole('button', { name: 'Void' })
    await user.click(voidButtons[0])
    expect(screen.getByRole('dialog', { name: 'Void Payment' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getAllByRole('button', { name: 'Void' }).at(-1)!)
    expect(screen.getByRole('dialog', { name: 'Void Receipt' })).toBeInTheDocument()
  })

  it('uses shared summary and data regions on Fee Record', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Fee Record' }))

    expect(await screen.findByRole('region', { name: 'Fee Record filters' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student Fee Records' })).toBeInTheDocument()
    expect(document.querySelectorAll('.stat-card').length).toBeGreaterThanOrEqual(3)
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
