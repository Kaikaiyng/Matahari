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
    'attendance.view_school',
    'attendance.manage_school',
    'attendance.devices.manage',
    'attendance.abilities.manage',
    'parents.view',
    'fee_items.view',
    'fee_agreements.view',
    'fee_agreements.create',
    'fee_agreements.update',
    'fee_record.view',
    'fee_record.generate',
    'fee_record.manage',
    'payments.view',
    'payments.create',
    'payments.verify',
    'payments.void',
    'payment_reminders.send',
    'receipts.view',
    'receipts.create',
    'receipts.void',
    'receipts.print',
  ],
}

const superAdminUser = {
  ...currentUser,
  school_id: null,
  roles: ['super-admin'],
  permissions: [...currentUser.permissions, 'audit.view', 'logs.view'],
}

const schoolAdminDialogUser = {
  ...currentUser,
  roles: ['school-admin'],
  permissions: [
    'students.view',
    'students.create',
    'fee_agreements.create',
    'fee_agreements.update',
    'fee_record.view',
    'fee_record.manage',
    'payments.view',
    'payments.create',
    'receipts.view',
  ],
}

const employeeAbilityAccess = {
  position: 'teacher',
  positions: [
    { value: 'school-admin', label: 'School Admin' },
    { value: 'finance', label: 'Finance' },
    { value: 'teacher', label: 'Teacher' },
  ],
  groups: {
    Community: [
      { slug: 'community.view', label: 'View posts' },
      { slug: 'community.publish', label: 'Publish posts' },
      { slug: 'community.moderate', label: 'Manage posts' },
    ],
  },
  dependencies: {
    'community.publish': 'community.view',
    'community.moderate': 'community.view',
  },
  position_defaults: { 'school-admin': [], finance: [], teacher: ['community.view'] },
  default_permissions: ['community.view'],
  permissions: ['community.view'],
  teacher_app_access: true,
}

const financeDialogUser = {
  ...currentUser,
  roles: ['finance'],
  permissions: [
    'students.view',
    'fee_record.view',
    'payments.view',
    'payments.verify',
    'payments.void',
    'receipts.view',
    'receipts.void',
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
  payment_plan: 'custom',
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
      billing_frequency: 'custom',
      billing_months: [7, 8, 9],
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
      billing_frequency: 'custom',
      billing_months: [7, 8, 9],
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

const outstandingUniformCharge = {
  id: 41,
  student_id: 1,
  fee_agreement_id: 20,
  fee_agreement_item_id: null,
  fee_item_id: null,
  academic_year: '2026',
  billing_month: '2026-07',
  fee_record_category: 'OTHERS',
  fee_code: null,
  description: 'Uniform – Sports T-shirt',
  expected_amount: 80,
  paid_amount: 0,
  outstanding_amount: 80,
  billing_status: 'billable',
  collection_status: 'unpaid',
  charge_origin: 'manual',
  source_type: 'manual_charge',
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

function noContent() {
  return Promise.resolve(new Response(null, { status: 204 }))
}

function installApiMock() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input), window.location.origin)

    if (url.pathname.endsWith('/csrf-cookie')) return noContent()
    if (url.pathname.endsWith('/me')) return json({ user: currentUser })
    if (url.pathname.endsWith('/dashboard/school')) return json(dashboard)
    if (url.pathname.endsWith('/calendar-events')) return json({ data: [] })
    if (url.pathname.endsWith('/audit-logs')) {
      return json({ data: [], meta: { per_page: 50, next_cursor: null, previous_cursor: null } })
    }
    if (url.pathname.endsWith('/application-logs')) {
      return json({
        data: [],
        meta: { page: 1, per_page: 50, total: 0, total_pages: 1, level_counts: { FATAL: 0, ERROR: 0, WARN: 0, INFO: 0 }, truncated: false },
      })
    }
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
    if (url.pathname.endsWith('/receipts/21')) return json({ receipt: issuedReceipt })
    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) return json({ data: [] })
    if (url.pathname.endsWith('/fee-items/catalogue')) return json({ data: feeItems.map((item) => ({ ...item, status: 'active' })) })
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

function installApiUser(user: Omit<typeof currentUser, 'school_id'> & { school_id: number | null }) {
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), window.location.origin)
    if (url.pathname.endsWith('/me')) return json({ user })
    return installedImplementation(input, init)
  })
}

function installActiveFeeAgreement() {
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()
  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), window.location.origin)
    if (url.pathname.endsWith('/students/1/fee-agreements') && init?.method !== 'POST') {
      return json({ data: [currentFeeAgreement] })
    }
    return installedImplementation(input, init)
  })
}

async function renderAuthenticatedApp() {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await screen.findByRole('region', { name: 'Dashboard metrics' })
}

async function openSelectedStudentPayments(
  user: ReturnType<typeof userEvent.setup>,
  withIssuedReceipt = false,
) {
  if (withIssuedReceipt) {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/students/1/payments') && init?.method !== 'POST') {
        return json({
          data: [{
            ...pendingPayment,
            status: 'verified',
            issued_receipt: {
              id: issuedReceipt.id,
              receipt_no: issuedReceipt.receipt_no,
              receipt_date: issuedReceipt.receipt_date,
              status: issuedReceipt.status,
            },
          }],
        })
      }
      return installedImplementation(input, init)
    })
  }

  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
}

describe('demo shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    installApiMock()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('explains that the saved session is being checked', () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise<Response>(() => undefined))

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })

  it('uses empty username credentials and submits the username login payload', async () => {
    const user = userEvent.setup()
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/csrf-cookie')) return noContent()
      if (url.pathname.endsWith('/me')) return json({ message: 'Unauthenticated.' }, 401)
      if (url.pathname.endsWith('/login')) return json({ user: currentUser })

      return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
    })

    render(<App />)

    const username = await screen.findByLabelText('Username')
    expect(screen.getByRole('img', { name: 'Matahari International School logo' })).toBeInTheDocument()
    expect(screen.getByText('Matahari International School')).toBeInTheDocument()
    const password = screen.getByLabelText('Password')
    expect(username).toHaveValue('')
    expect(password).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Remember me' })).not.toBeChecked()
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

  it('remembers only the username after a successful login', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('matahari.rememberedUsername', 'superadmin')
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/csrf-cookie')) return noContent()
      if (url.pathname.endsWith('/me')) return json({ message: 'Unauthenticated.' }, 401)
      if (url.pathname.endsWith('/login')) return json({ user: currentUser })

      return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
    })

    render(<App />)

    expect(await screen.findByLabelText('Username')).toHaveValue('superadmin')
    expect(screen.getByRole('checkbox', { name: 'Remember me' })).toBeChecked()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(window.localStorage.getItem('rylay.rememberedUsername')).toBe('superadmin')
    expect(window.localStorage.getItem('matahari.rememberedUsername')).toBeNull()

    await user.clear(screen.getByLabelText('Username'))
    await user.type(screen.getByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => expect(window.localStorage.getItem('rylay.rememberedUsername')).toBe(currentUser.username))
    expect(window.localStorage.getItem('password')).toBeNull()
  })

  it('shows an invalid-credentials message only once', async () => {
    const user = userEvent.setup()
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/csrf-cookie')) return noContent()
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

  it('presents a management overview with operational quick actions', async () => {
    await renderAuthenticatedApp()

    const utilityHeader = document.querySelector<HTMLElement>('.utility-header')
    if (!utilityHeader) throw new Error('Utility header was not rendered')
    expect(within(utilityHeader).getByText('Matahari International School')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'School overview' })).not.toBeInTheDocument()
    const dashboardHeading = document.querySelector<HTMLElement>('.dashboard-heading')
    if (!dashboardHeading) throw new Error('Dashboard heading was not rendered')
    expect(within(dashboardHeading).getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Live Workspace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Dashboard metrics' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Financial snapshot' })).toBeInTheDocument()

    const actions = screen.getByRole('region', { name: 'Quick actions' })
    expect(within(actions).getByRole('button', { name: 'Go to Students' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Go to Fee Record' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Go to Calendar' })).toBeInTheDocument()
    expect(document.querySelector('.hero-strip')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.stat-card')).toHaveLength(4)
  })

  it('limits Dashboard quick actions to modules the user can view', async () => {
    installApiUser(financeDialogUser)
    await renderAuthenticatedApp()

    const actions = screen.getByRole('region', { name: 'Quick actions' })
    expect(within(actions).getByRole('button', { name: 'Go to Students' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Go to Fee Record' })).toBeInTheDocument()
    expect(within(actions).queryByRole('button', { name: 'Go to Calendar' })).not.toBeInTheDocument()
  })

  it('shows loading values instead of fallback metrics while the dashboard request is pending', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/dashboard/school')) {
        return new Promise<Response>(() => undefined)
      }

      return installedImplementation(input, init)
    })

    render(<App />)

    const metrics = await screen.findByRole('region', { name: 'Dashboard metrics' })

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
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/dashboard/school')) {
        return json({ message: 'Dashboard unavailable.' }, 500)
      }

      return installedImplementation(input, init)
    })

    render(<App />)

    await screen.findByRole('region', { name: 'Dashboard metrics' })
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

    const metrics = screen.getByRole('region', { name: 'Dashboard metrics' })
    expect(within(metrics).getByText('RM 800')).toBeInTheDocument()
    expect(screen.queryByText('View Fee Record')).not.toBeInTheDocument()

    await user.click(within(metrics).getByRole('button', { name: 'Open Fee Record' }))
    expect(await screen.findByRole('heading', { name: 'Admin Fee Record' })).toBeInTheDocument()
  })

  it('shows only verified modules allowed by the current user permissions', async () => {
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(Array.from(navigation.querySelectorAll('.nav-item, .nav-subitem')).map((button) => button.textContent)).toEqual([
      'Dashboard',
      'Calendar',
      'Attendance',
      'Students',
      'Classes',
      'Parents',
      'Fees',
      'Fee Record',
    ])
    expect(within(navigation).getByText('People')).toBeInTheDocument()
    expect(within(navigation).getByText('Finance')).toBeInTheDocument()
    expect(within(navigation).queryByText('Management')).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Audit Trail' })).not.toBeInTheDocument()
  })

  it('shows Post Reports only with the school post-report permission', async () => {
    const user = userEvent.setup()
    installApiUser({ ...currentUser, permissions: [...currentUser.permissions, 'community.moderate'] })
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    await user.click(within(navigation).getByRole('button', { name: 'Administration navigation group' }))
    expect(within(navigation).getByRole('button', { name: 'Post Reports' })).toBeInTheDocument()
  })

  it('does not expose Post Reports to a platform-only moderator', async () => {
    installApiUser({ ...currentUser, permissions: [...currentUser.permissions, 'community.moderate_platform'] })
    await renderAuthenticatedApp()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(navigation).queryByRole('button', { name: 'Administration navigation group' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Post Reports' })).not.toBeInTheDocument()
  })

  it('presents Community abilities as official School Updates', async () => {
    const user = userEvent.setup()
    installApiUser({
      ...currentUser,
      permissions: [...currentUser.permissions, 'foundation_accounts.manage', 'employees.abilities.manage'],
    })
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/staff')) {
        return json({ data: [{ id: 2, staff_no: 'MIS-E002', name: 'Ava Tan', username: 'ava.tan', role: 'Teacher', roles: ['teacher'], status: 'active', assigned_classes: [] }] })
      }
      if (url.pathname.endsWith('/staff/2/access') && init?.method !== 'PUT') {
        return json({ data: employeeAbilityAccess })
      }
      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    const peopleNavigation = screen.getByRole('button', { name: 'People navigation group' })
    if (peopleNavigation.getAttribute('aria-expanded') === 'false') await user.click(peopleNavigation)
    await user.click(await screen.findByRole('button', { name: 'Employees' }))
    await user.click(await screen.findByRole('button', { name: /Edit/ }))

    expect(await screen.findByText('Official School Updates')).toBeInTheDocument()
    expect(screen.getByText('Publish posts')).toBeInTheDocument()
    expect(screen.getByText('Manage posts')).toBeInTheDocument()
    expect(screen.queryByText('Interact with posts')).not.toBeInTheDocument()
  })

  it('rejects a parent-only account from the Admin Panel', async () => {
    installApiUser({
      ...currentUser,
      name: 'Rachel Wong',
      username: 'rachel.wong',
      roles: ['parent'],
      permissions: ['parent.self_service'],
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Admin access unavailable' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('rejects a teacher-only account from the Admin Panel', async () => {
    installApiUser({
      ...currentUser,
      name: 'Ms Lim',
      username: 'teacher.lim',
      roles: ['teacher'],
      permissions: ['academic_years.view', 'subjects.view', 'teaching_scope.view'],
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Admin access unavailable' })).toBeInTheDocument()
    expect(screen.getByText('This account belongs to the Community App and cannot enter the Admin Panel.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('opens Calendar with the active school context', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(await screen.findByRole('region', { name: 'School calendar' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        vi.mocked(globalThis.fetch).mock.calls.some(([input]) => {
          const url = new URL(String(input), window.location.origin)
          return url.pathname.endsWith('/calendar-events') && url.searchParams.get('school_id') === '1'
        }),
      ).toBe(true),
    )
  })

  it('shows Audit Trail only to an authorized user and does not assume school 1 for a global account', async () => {
    const user = userEvent.setup()
    installApiUser(superAdminUser)
    await renderAuthenticatedApp()

    expect(screen.getByText('A school must be selected before school-scoped dashboard data can be loaded.')).toBeInTheDocument()
    expect(
      vi.mocked(globalThis.fetch).mock.calls.some(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/dashboard/school')),
    ).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Audit Trail' }))

    expect(await screen.findByRole('heading', { name: 'Audit Trail', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('No audit events found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Application Logs' }))
    expect(await screen.findByRole('heading', { name: 'Application Logs', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('No log entries found')).toBeInTheDocument()
  })

  it('opens Attendance as a dedicated Admin module', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Attendance' }))

    expect(await screen.findByRole('heading', { name: 'Attendance', level: 2 })).toBeInTheDocument()
  })

  it('uses a dedicated filter toolbar and data panel on Students', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))

    expect(await screen.findByRole('region', { name: 'Student filters' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student List' })).toBeInTheDocument()
    expect(screen.getAllByText('Active').some((element) => element.classList.contains('status-badge'))).toBe(true)
  })

  it('uses the shared data hierarchy on Fees', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Fees' }))

    expect(await screen.findByRole('region', { name: 'Standard Fee Items' })).toBeInTheDocument()
    expect(screen.getByText('RM 800.00')).toBeInTheDocument()
  })

  it('shows the MIS demo parent directory grouped by class', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Parents' }))

    expect(await screen.findByRole('heading', { name: 'Parent & Guardian Directory' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Class: MA1' })).toBeInTheDocument()
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
      const url = new URL(String(input), window.location.origin)
      return url.pathname.endsWith('/students') && url.searchParams.has('status')
    }).length

    await user.click(screen.getByRole('button', { name: 'View Alyssa Tan' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })
    expect(screen.getByRole('button', { name: 'Back to MA1' })).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input), window.location.origin)
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
    await screen.findByRole('heading', { name: 'Parent & Guardian Directory' })
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

  it('edits a student profile through the permitted detail action and refreshes the list', async () => {
    const user = userEvent.setup()
    installApiUser({ ...currentUser, permissions: [...currentUser.permissions, 'students.update'] })
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()!
    let updated = student
    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/students/1') && init?.method === 'PATCH') {
        updated = { ...student, full_name: 'Updated Student Name' }
        return json({ student: updated })
      }
      if (url.pathname.endsWith('/students') && init?.method !== 'POST') return json({ data: [updated] })
      return installedImplementation(input, init)
    })
    await openSelectedStudentPayments(user)
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Student Profile' })
    await user.clear(within(dialog).getByLabelText('Student Name'))
    await user.type(within(dialog).getByLabelText('Student Name'), 'Updated Student Name')
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Student Profile' })).not.toBeInTheDocument())
    expect(screen.getByText('Updated profile for MIS-2026-001.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Updated Student Name MIS-2026-001' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to students' }))
    expect(await screen.findByText('Updated Student Name')).toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/students/1') && init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ full_name: 'Updated Student Name' })
  })

  it('keeps student profile editing unavailable without the update ability', async () => {
    const user = userEvent.setup()
    await openSelectedStudentPayments(user)
    expect(screen.getByRole('heading', { name: 'Student Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument()
  })

  it('opens Create Student at Student ID with the standard modal contract', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add Student' }))

    const dialog = screen.getByRole('dialog', { name: 'Create Student Profile' })
    expect(dialog).toHaveClass('modal-frame--standard')
    await waitFor(() => expect(within(dialog).getByLabelText('Student ID')).toHaveFocus())
  })

  it('associates and focuses the first Create Student server error', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/students') && init?.method === 'POST') {
        return json(
          {
            message: 'Please check the student.',
            errors: { student_no: ['Student ID is required.'] },
          },
          422,
        )
      }
      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Add Student' }))
    await user.type(screen.getByLabelText('Student ID'), 'TEMP-001')
    await user.type(screen.getByLabelText('Student Name'), 'Alyssa Tan')
    await user.selectOptions(screen.getByLabelText('Class'), '2')
    await user.click(screen.getByRole('button', { name: 'Create Student' }))

    const studentId = await screen.findByLabelText('Student ID')
    expect(studentId).toHaveAttribute('aria-invalid', 'true')
    expect(studentId).toHaveAttribute(
      'aria-describedby',
      'create-student-student-no-error',
    )
    expect(document.getElementById('create-student-student-no-error')).toHaveTextContent(
      'Student ID is required.',
    )
    await waitFor(() => expect(studentId).toHaveFocus())
  })

  it('uses One-time Charge language and identifies the selected student', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    installActiveFeeAgreement()
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Add One-time Charge' })).toBeInTheDocument(),
      { timeout: 3_000 },
    )
    await user.click(screen.getByRole('button', { name: 'Add One-time Charge' }))

    const dialog = screen.getByRole('dialog', { name: 'One-time Charge' })
    expect(dialog).toHaveClass('modal-frame--standard')
    expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
      'Alyssa Tan',
    )
    expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
      'MIS-2026-001',
    )
    await waitFor(() => expect(within(dialog).getByLabelText('Academic Year')).toHaveFocus())
    expect(
      within(dialog).getByRole('button', { name: 'Add One-time Charge' }),
    ).toBeInTheDocument()
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
    installActiveFeeAgreement()
    await renderAuthenticatedApp()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })

    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))
    expect(screen.getByRole('dialog', { name: 'Create Fee Agreement' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Add One-time Charge' })).toBeInTheDocument(),
      { timeout: 3_000 },
    )
    await user.click(screen.getByRole('button', { name: 'Add One-time Charge' }))
    expect(screen.getByRole('dialog', { name: 'One-time Charge' })).toBeInTheDocument()
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

  }, 10_000)

  it('sends an in-app payment reminder for the selected student', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/students/1/payment-reminders') && init?.method === 'POST') {
        return json({ data: { student_id: 1, academic_year: '2026', outstanding_amount: 2670, recipient_count: 1 } }, 201)
      }
      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user)
    await user.click(screen.getByRole('button', { name: 'Send payment reminder' }))

    expect(screen.getByRole('heading', { name: 'Send Payment Reminder' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm & Send' }))

    expect(await screen.findByText('Payment reminder sent to 1 parent account.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/students\/1\/payment-reminders$/),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows the selected payment before verification', async () => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    await openSelectedStudentPayments(user)
    await user.click(await screen.findByRole('button', { name: 'Verify' }))

    const dialog = screen.getByRole('dialog', { name: 'Verify Payment' })
    expect(dialog).toHaveClass('modal-frame--standard')
    const summary = within(dialog).getByRole('region', { name: 'Payment to verify' })
    expect(summary).toHaveTextContent('Alyssa Tan')
    expect(summary).toHaveTextContent('RM 400')
    expect(summary).toHaveTextContent('PAY-11')
    await waitFor(() => expect(within(dialog).getByLabelText('Received Date')).toHaveFocus())
  })

  it.each([
    [
      'pending_verification',
      'This pending payment will become void; charge balances have not yet changed.',
    ],
    [
      'verified',
      'Each applied charge will reopen by the amount allocated from this payment.',
    ],
  ] as const)('explains the %s payment void consequence', async (status, consequence) => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/payments') && init?.method !== 'POST') {
        return json({ data: [{ ...pendingPayment, status }] })
      }

      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user)
    await user.click((await screen.findAllByRole('button', { name: 'Void' }))[0])

    const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
    expect(
      within(dialog).getByRole('region', { name: 'Payment to void' }),
    ).toHaveTextContent(consequence)
    expect(
      within(dialog).getByRole('button', { name: 'Confirm Void Payment' }),
    ).toBeEnabled()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('blocks payment void while an issued receipt exists', async () => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/payments') && init?.method !== 'POST') {
        return json({
          data: [
            {
              ...pendingPayment,
              issued_receipt: {
                id: 21,
                receipt_no: 'RCP-21',
                receipt_date: '2026-07-17',
                status: 'issued',
              },
            },
          ],
        })
      }

      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user)
    await user.click((await screen.findAllByRole('button', { name: 'Void' }))[0])

    const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
    expect(dialog).toHaveClass('modal-frame--compact', 'modal-frame--danger')
    expect(
      within(dialog).getByText('Void the issued receipt before voiding this payment.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Confirm Void Payment' }),
    ).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Void Reason')).not.toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus())
  })

  it('explains that voiding a receipt leaves payment and balances unchanged', async () => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    await openSelectedStudentPayments(user, true)
    await user.click(await screen.findByRole('button', { name: 'Void Receipt' }))

    const dialog = screen.getByRole('dialog', { name: 'Void Receipt' })
    const summary = within(dialog).getByRole('region', { name: 'Receipt to void' })
    expect(summary).toHaveTextContent('RCP-21')
    expect(summary).toHaveTextContent('Alyssa Tan')
    expect(summary).toHaveTextContent('The linked payment remains verified')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('marks the displayed receipt as a fictional sample', async () => {
    const user = userEvent.setup()
    await openSelectedStudentPayments(user, true)
    await user.click(await screen.findByRole('button', { name: 'View Receipt' }))

    expect(screen.getByRole('heading', { name: 'Matahari International School' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('SAMPLE — NOT A VALID RECEIPT')
  })

  it('preserves Verify Payment submission and success refresh behavior', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 7, 18, 12))
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/payments/11/verify') && init?.method === 'POST') {
        return json({ payment: { ...pendingPayment, status: 'verified' } })
      }
      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user)
    await user.click(await screen.findByRole('button', { name: 'Verify' }))
    const dialog = screen.getByRole('dialog', { name: 'Verify Payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Received Date' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: '18 July 2026' }))
    await user.type(within(dialog).getByLabelText('Bank Account'), 'Maybank')
    await user.click(within(dialog).getByRole('button', { name: 'Verify Payment' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/payments\/11\/verify$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            received_date: '2026-07-18',
            bank_account: 'Maybank',
            reference_no: 'PAY-11',
            remark: null,
          }),
        }),
      ),
    )
    expect(screen.queryByRole('dialog', { name: 'Verify Payment' })).not.toBeInTheDocument()
    expect(screen.getByText('Payment verified.')).toBeInTheDocument()
  })

  it('preserves eligible Void Payment submission and reason', async () => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/payments/11/void') && init?.method === 'POST') {
        return json({ payment: { ...pendingPayment, status: 'voided' } })
      }
      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user)
    await user.click((await screen.findAllByRole('button', { name: 'Void' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
    await user.type(within(dialog).getByLabelText('Void Reason'), 'Duplicate entry')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Void Payment' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/payments\/11\/void$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ void_reason: 'Duplicate entry' }),
        }),
      ),
    )
    expect(screen.getByText('Payment voided.')).toBeInTheDocument()
  })

  it('preserves Void Receipt submission while leaving payment handling separate', async () => {
    const user = userEvent.setup()
    installApiUser(financeDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/receipts/21/void') && init?.method === 'POST') {
        return json({ receipt: { ...issuedReceipt, status: 'voided' } })
      }
      return installedImplementation(input, init)
    })

    await openSelectedStudentPayments(user, true)
    await user.click(await screen.findByRole('button', { name: 'Void Receipt' }))
    const dialog = screen.getByRole('dialog', { name: 'Void Receipt' })
    await user.type(within(dialog).getByLabelText('Void Reason'), 'Receipt reissued')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Void Receipt' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/receipts\/21\/void$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ void_reason: 'Receipt reissued' }),
        }),
      ),
    )
    expect(screen.getByText('Receipt RCP-21 voided.')).toBeInTheDocument()
  })

  it('creates a one-time charge inside Record Payment and selects it after confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/fee-record/manual-charges') && init?.method === 'POST') {
        return json({ data: outstandingUniformCharge })
      }

      if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
        return json({ data: [outstandingUniformCharge] })
      }

      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Add one-time charge' }))
    await user.type(within(dialog).getByLabelText('One-time charge description'), 'Uniform – Sports T-shirt')
    await user.type(within(dialog).getByLabelText('One-time charge amount'), '80')
    await user.click(within(dialog).getByRole('button', { name: 'Add and select charge' }))

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith('/students/1/fee-record/manual-charges') && init?.method === 'POST',
      )
      expect(request).toBeDefined()
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        academic_year: '2026',
        billing_month: expect.stringMatching(/^2026-\d{2}$/),
        fee_record_category: 'OTHERS',
        description: 'Uniform – Sports T-shirt',
        expected_amount: 80,
        remark: null,
      })
    })

    expect(await within(dialog).findByText('Charge added and selected for this payment.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Uniform – Sports T-shirt amount')).toHaveValue(80)
    expect(within(dialog).getByText(/Allocated RM\s*80 of RM\s*80/)).toBeInTheDocument()
  })

  it('keeps one-time charge validation inside Record Payment and adds no allocation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/fee-record/manual-charges') && init?.method === 'POST') {
        return json(
          {
            message: 'The description field is required.',
            errors: { description: ['Description is required.'] },
          },
          422,
        )
      }

      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Add one-time charge' }))
    await user.type(within(dialog).getByLabelText('One-time charge amount'), '80')
    await user.click(within(dialog).getByRole('button', { name: 'Add and select charge' }))

    expect(await within(dialog).findByText('Description is required.')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Add one-time charge' })).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).getByLabelText('One-time charge description')).toHaveFocus(),
    )
    expect(within(dialog).queryByText('Charge added and selected for this payment.')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Allocated RM\s*0 of RM\s*0/)).toBeInTheDocument()
  })

  it('hides one-time charge creation without Fee Record management permission', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/me')) {
        return json({
          user: {
            ...currentUser,
            permissions: currentUser.permissions.filter((permission) => permission !== 'fee_record.manage'),
          },
        })
      }

      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    expect(within(dialog).queryByRole('button', { name: 'Add one-time charge' })).not.toBeInTheDocument()
  })

  it('allows only one incomplete unclassified payment row', async () => {
    const user = userEvent.setup()
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    await user.click(within(dialog).getByText('Advanced options'))
    const addButton = within(dialog).getByRole('button', { name: 'Record unclassified payment' })
    await user.click(addButton)

    expect(within(dialog).getAllByLabelText(/Unclassified payment \d+ description/)).toHaveLength(1)
    expect(addButton).toBeDisabled()
    await user.click(addButton)
    expect(within(dialog).getAllByLabelText(/Unclassified payment \d+ description/)).toHaveLength(1)
  })

  it('shows payment basics, fees, allocation, balance, then supporting details', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    expect(dialog).toHaveClass('modal-frame--workflow')
    expect(
      within(dialog).getByRole('region', { name: 'Student context' }),
    ).toHaveTextContent('Alyssa Tan')
    expect(within(dialog).getByRole('heading', { name: 'Payment basics' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Outstanding fees' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Payment allocation' })).toBeInTheDocument()
    expect(within(dialog).getByText('Amount remaining')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Additional payment details').closest('details'),
    ).not.toHaveAttribute('open')
    expect(within(dialog).getByRole('button', { name: 'Record Payment' })).toBeDisabled()
    await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveFocus())
  })

  it('opens Additional payment details when a contained field has an error', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
        return json({ data: [outstandingUniformCharge] })
      }

      if (url.pathname.endsWith('/students/1/payments') && init?.method === 'POST') {
        return json(
          {
            message: 'Please check the payment.',
            errors: { reference_no: ['Reference is invalid.'] },
          },
          422,
        )
      }

      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Uniform – Sports T-shirt/ }))
    await user.click(within(dialog).getByText('Additional payment details'))
    await user.type(within(dialog).getByLabelText('Reference No'), 'INVALID')
    const recordButton = within(dialog).getByRole('button', { name: 'Record Payment' })
    expect(recordButton).toBeEnabled()
    await user.click(recordButton)

    const details = within(dialog).getByText('Additional payment details').closest('details')
    expect(await within(dialog).findByText('Reference is invalid.')).toBeInTheDocument()
    expect(details).toHaveAttribute('open')
    expect(within(dialog).getByLabelText('Reference No')).toHaveAttribute(
      'aria-describedby',
      'record-payment-reference-no-error',
    )
    await waitFor(() => expect(within(dialog).getByLabelText('Reference No')).toHaveFocus())
  })

  it('preserves the Record Payment endpoint and allocation payload', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()

    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)

      if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
        return json({ data: [outstandingUniformCharge] })
      }

      if (url.pathname.endsWith('/students/1/payments') && init?.method === 'POST') {
        return json({ payment: { ...pendingPayment, amount: 80 } })
      }

      return installedImplementation(input, init)
    })

    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Payment' }))

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Uniform – Sports T-shirt/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith('/students/1/payments') && init?.method === 'POST',
      )
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        payment_method: 'bank_transfer',
        amount: 80,
        allocations: [
          {
            allocation_type: 'charge',
            fee_record_charge_id: 41,
            description: 'Uniform – Sports T-shirt',
            amount: 80,
          },
        ],
      })
    })
    expect(screen.queryByRole('dialog', { name: 'Record Payment' })).not.toBeInTheDocument()
    expect(
      screen.getByText('Payment recorded and pending finance verification.'),
    ).toBeInTheDocument()
  })

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

  it('identifies the student and focuses Payment Plan in Fee Agreement', async () => {
    const user = userEvent.setup()
    installApiUser(schoolAdminDialogUser)
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

    const dialog = screen.getByRole('dialog', { name: 'Create Fee Agreement' })
    expect(dialog).toHaveClass('modal-frame--workflow')
    expect(
      within(dialog).getByRole('region', { name: 'Student context' }),
    ).toHaveTextContent('Alyssa Tan')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Monthly' })).toHaveFocus())
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
      const url = new URL(String(input), window.location.origin)
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
    expect(within(dialog).getByLabelText('Payment Plan')).toHaveValue('monthly')
    expect(within(dialog).getByRole('button', { name: 'Effective From' })).toHaveTextContent('02 Jan 2026')
    expect(within(dialog).getByText('Creating a new version from v1')).toBeInTheDocument()
    expect(within(dialog).getByRole('complementary', { name: 'Changes from v1' })).toBeInTheDocument()
    expect(within(dialog).getByRole('complementary', { name: 'Changes from v1' })).toHaveTextContent(
      'Payment plan: Custom → Monthly',
    )

    await user.clear(within(dialog).getByLabelText('Tuition Fee amount'))
    await user.type(within(dialog).getByLabelText('Tuition Fee amount'), '850')
    expect(within(dialog).getByRole('complementary', { name: 'Changes from v1' })).toHaveTextContent(
      /Tuition Fee: RM 800.*RM 850/,
    )
  })

  it('waits for the fee catalogue before enabling agreement actions', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const installedImplementation = fetchMock.getMockImplementation()
    if (!installedImplementation) throw new Error('API mock is not installed')

    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/fee-items')) {
        return new Promise<Response>(() => undefined)
      }
      return installedImplementation(input, init)
    })

    const user = userEvent.setup()
    await renderAuthenticatedApp()
    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('heading', { name: /Alyssa Tan/ })

    expect(screen.getByRole('button', { name: 'Create Agreement' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Supersede Current' })).toBeDisabled()
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
