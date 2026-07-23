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
    outstanding_fees: 800,
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
  class: { id: 2, name: 'MA1' },
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

const feeItems = [
  {
    id: 1,
    code: 'TUITION',
    name: 'Tuition Fee',
    category: 'mandatory',
    fee_type: 'recurring',
    default_amount: 800,
  },
  {
    id: 2,
    code: 'MISC',
    name: 'Misc Fee',
    category: 'mandatory',
    fee_type: 'recurring',
    default_amount: 90,
  },
  {
    id: 3,
    code: 'TRANSPORT',
    name: 'Transport',
    category: 'optional',
    fee_type: 'recurring',
    default_amount: 120,
  },
]

const currentFeeAgreement = {
  id: 20,
  academic_year: '2026',
  version_no: 1,
  payment_plan: 'monthly',
  effective_from: '2026-01-01',
  effective_to: null,
  is_current: true,
  status: 'active',
  remarks: 'Current agreement',
  items: [
    {
      id: 201,
      fee_item_id: 1,
      fee_code: 'TUITION',
      fee_category: 'mandatory',
      description: 'Tuition Fee',
      amount: 800,
      is_mandatory: true,
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: null,
      requires_preview_confirmation: false,
    },
    {
      id: 202,
      fee_item_id: 2,
      fee_code: 'MISC',
      fee_category: 'mandatory',
      description: 'Misc Fee',
      amount: 90,
      is_mandatory: true,
      classification: 'recurring',
      billing_frequency: 'monthly',
      billing_months: null,
      requires_preview_confirmation: false,
    },
  ],
  discounts: [],
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

const julyFeeRecordSummary = {
  ...feeRecordSummary,
  total_expected: 500,
  total_paid: 300,
  total_outstanding: 200,
  outstanding_months: ['2026-07'],
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
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/me')) return json({ user: currentUser })
    if (url.pathname.endsWith('/dashboard/school')) return json(dashboard)
    if (url.pathname.endsWith('/calendar-events')) return json({ data: [] })
    if (
      url.pathname.endsWith('/students/1/fee-agreements') &&
      init?.method === 'POST'
    ) {
      return json({
        fee_agreement: {
          id: 30,
          academic_year: '2026',
          version_no: 1,
          payment_plan: 'monthly',
          effective_from: '2026-07-23',
          effective_to: null,
          is_current: true,
          status: 'active',
          remarks: null,
          items: [],
          discounts: [],
        },
      })
    }
    if (url.pathname.endsWith('/students/1/fee-agreements')) return json({ data: [] })
    if (url.pathname.endsWith('/students/1/payments')) return json({ data: [pendingPayment] })
    if (url.pathname.endsWith('/students/1/receipts')) return json({ data: [issuedReceipt] })
    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) return json({ data: [] })
    if (url.pathname.endsWith('/fee-items')) return json({ data: feeItems })
    if (url.pathname.endsWith('/classes')) return json({ data: schoolClasses })
    if (url.pathname.endsWith('/students/1')) return json({ student })
    if (url.pathname.endsWith('/students')) return json({ data: [student] })
    if (url.pathname.endsWith('/fee-record/summary')) {
      const billingMonth = url.searchParams.get('billing_month')
      if (billingMonth === '2026-12') return json({ data: [] })
      return json({ data: [billingMonth === '2026-07' ? julyFeeRecordSummary : feeRecordSummary] })
    }

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

  it('shows loading values instead of fallback metrics while the dashboard request is pending', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/dashboard/school')) {
        return new Promise<Response>(() => undefined)
      }

      return installedImplementation(input, init)
    })

    render(<App />)

    await screen.findByRole('heading', { name: 'School overview' })
    const metrics = screen.getByRole('region', { name: 'Dashboard metrics' })

    expect(within(metrics).getAllByText('Loading...')).toHaveLength(4)
    expect(screen.queryByText('RM 5,230')).not.toBeInTheDocument()
    expect(screen.queryByText('RM 86,420')).not.toBeInTheDocument()
    expect(screen.queryByText('RM 38,500')).not.toBeInTheDocument()
    expect(screen.queryByText('187')).not.toBeInTheDocument()
  })

  it('shows an unavailable state instead of fallback metrics when the dashboard request fails', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/dashboard/school')) {
        return json({ message: 'Dashboard unavailable.' }, 500)
      }

      return installedImplementation(input, init)
    })

    render(<App />)

    await screen.findByRole('heading', { name: 'School overview' })
    expect(await screen.findByRole('status')).toHaveTextContent('Service temporarily unavailable')

    const metrics = screen.getByRole('region', { name: 'Dashboard metrics' })
    expect(within(metrics).getAllByText('Unavailable')).toHaveLength(4)
    expect(screen.queryByText('RM 5,230')).not.toBeInTheDocument()
    expect(screen.queryByText('RM 86,420')).not.toBeInTheDocument()
    expect(screen.queryByText('RM 38,500')).not.toBeInTheDocument()
    expect(screen.queryByText('187')).not.toBeInTheDocument()
  })

  it('shows the Fee Record outstanding total and opens Fee Record from the metric', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    expect(screen.getByText('RM 800')).toBeInTheDocument()
    expect(screen.queryByText('View Fee Record')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Fee Record' }))

    expect(await screen.findByRole('heading', { name: 'Admin Fee Record' })).toBeInTheDocument()
  })

  it('shows the complete sidebar including display-only modules', async () => {
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(navigation).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Dashboard',
      'Calendar',
      'Students',
      'Classes',
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

  it('returns Student Detail to the originating class roster', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Classes' }))
    await user.click(await screen.findByRole('button', { name: 'View MA1' }))
    expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()
    expect(screen.getByText('Alyssa Tan')).toBeInTheDocument()

    const fetchMock = vi.mocked(globalThis.fetch)
    const studentListRequestsBefore = fetchMock.mock.calls.filter(([input]) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/students') && url.searchParams.has('status')
    }).length

    await user.click(screen.getByRole('button', { name: 'View Alyssa Tan' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    expect(screen.getByRole('button', { name: 'Back to MA1' })).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input))
        return url.pathname.endsWith('/students') && url.searchParams.has('status')
      }),
    ).toHaveLength(studentListRequestsBefore)

    await user.click(screen.getByRole('button', { name: 'Back to MA1' }))
    expect(await screen.findByRole('heading', { name: 'MA1' })).toBeInTheDocument()
    expect(screen.getByText('Alyssa Tan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Classes' })).toHaveClass('active')
  })

  it('clears the selected class after deliberate sidebar navigation', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Classes' }))
    await user.click(await screen.findByRole('button', { name: 'View MA1' }))
    expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Parents' }))
    await screen.findByRole('heading', { name: 'Parent Directory' })
    await user.click(screen.getByRole('button', { name: 'Classes' }))

    expect(await screen.findByRole('heading', { name: 'Class Directory' })).toBeInTheDocument()
    expect(screen.queryByText('No active students in this class.')).not.toBeInTheDocument()
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

  it('shows annual paid progress by default and synchronizes a selected month with student rows', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await screen.findByRole('heading', { name: 'Student List' })

    expect(screen.getByLabelText('Fee Period')).toHaveValue('')
    expect(screen.getByText('Paid / Total Fees')).toBeInTheDocument()
    expect(screen.getByText('RM 400 / RM 1,200')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Fee Period'), '2026-07')

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/fee-record\/summary\?.*billing_month=2026-07/),
        expect.any(Object),
      )
    })
    expect(await screen.findByText('RM 300 / RM 500')).toBeInTheDocument()

    const studentRow = screen.getByText('Alyssa Tan').closest('tr')
    expect(studentRow).not.toBeNull()
    expect(within(studentRow!).getByText('RM 500')).toBeInTheDocument()
    expect(within(studentRow!).getByText('RM 200')).toBeInTheDocument()
  })

  it('shows zero fee progress and zero student balances for a month without charges', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await screen.findByRole('heading', { name: 'Student List' })
    await user.selectOptions(screen.getByLabelText('Fee Period'), '2026-12')

    expect(await screen.findByText('RM 0 / RM 0')).toBeInTheDocument()
    const studentRow = screen.getByText('Alyssa Tan').closest('tr')
    expect(studentRow).not.toBeNull()
    expect(within(studentRow!).getAllByText('RM 0')).toHaveLength(2)
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
  }, 10_000)

  it('uses the compact editor for Create and preserves the request payload', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

    const dialog = screen.getByRole('dialog', { name: 'Create Fee Agreement' })
    expect(within(dialog).getByRole('complementary', { name: 'Agreement Summary' })).toBeInTheDocument()
    expect(within(dialog).getAllByText('Monthly · Every month · No preview required')).toHaveLength(2)

    await user.click(within(dialog).getByRole('button', { name: 'Create Agreement' }))

    await waitFor(() => {
      const request = vi.mocked(globalThis.fetch).mock.calls.find(
        ([input, init]) =>
          String(input).endsWith('/students/1/fee-agreements') && init?.method === 'POST',
      )
      expect(request).toBeDefined()
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        academic_year: '2026',
        payment_plan: 'monthly',
        items: [
          { fee_item_id: 1, billing_frequency: 'monthly', billing_months: null },
          { fee_item_id: 2, billing_frequency: 'monthly', billing_months: null },
        ],
        discounts: [],
      })
    })
  })

  it('asks before closing a dirty agreement but closes a clean agreement immediately', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

    let dialog = screen.getByRole('dialog', { name: 'Create Fee Agreement' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Create Fee Agreement' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
    dialog = screen.getByRole('dialog', { name: 'Create Fee Agreement' })
    await user.clear(within(dialog).getByLabelText('Tuition Fee amount'))
    await user.type(within(dialog).getByLabelText('Tuition Fee amount'), '850')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(confirm).toHaveBeenCalledWith('Discard your unsaved Fee Agreement changes?')
    expect(screen.getByRole('dialog', { name: 'Create Fee Agreement' })).toBeInTheDocument()
  })

  it('uses the same review-first editor when superseding an agreement', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (
        url.pathname.endsWith('/students/1/fee-agreements') &&
        init?.method !== 'POST'
      ) {
        return json({ data: [currentFeeAgreement] })
      }
      return installedImplementation(input, init)
    })

    const user = userEvent.setup()
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    await user.click(screen.getByRole('button', { name: 'Supersede Current' }))

    const dialog = screen.getByRole('dialog', { name: 'Supersede Fee Agreement' })
    expect(within(dialog).queryByLabelText('Academic Year')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Creating a new version from v1')).toBeInTheDocument()
    expect(within(dialog).getByRole('complementary', { name: 'Changes from v1' })).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Tuition Fee amount'))
    await user.type(within(dialog).getByLabelText('Tuition Fee amount'), '850')
    expect(within(dialog).getByRole('complementary', { name: 'Changes from v1' })).toHaveTextContent(
      /Tuition Fee: RM 800.*RM 850/,
    )
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
