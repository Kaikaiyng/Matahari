import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { ApiError, apiRequest } from './api'
import misLogo from './assets/mis-logo.jpg'
import './App.css'

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

type CurrentUser = {
  id: number
  name: string
  email: string
  school_id: number | null
  roles: string[]
  permissions: string[]
}

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
    class_name: string
    amount: number
    due_date: string
    status: string
  }>
}

type StudentStatus = 'active' | 'withdraw' | 'graduate' | 'inactive'
type StudentFilter = StudentStatus | 'all'
type LevelGroup = 'kindergarten' | 'primary' | 'secondary' | 'stp'

type StudentSummary = {
  id: number
  student_no: string
  full_name: string
  level_group: LevelGroup
  class: {
    id: number
    name: string
  } | null
  fee_amount: number | null
  outstanding_balance: number | null
  status: StudentStatus
}

type StudentDetail = StudentSummary & {
  gender: string | null
  dob: string | null
  registration_date: string | null
  notes: string | null
  parents: Array<{
    id: number
    full_name: string
    phone: string | null
    email: string | null
    relationship: string | null
    is_primary_contact: boolean
  }>
}

type StudentForm = {
  student_no: string
  full_name: string
  level_group: LevelGroup
  gender: string
  dob: string
  registration_date: string
  status: StudentStatus
  notes: string
}

type PaymentPlan = 'monthly' | 'termly' | 'yearly'
type DiscountType = 'percentage' | 'fixed_amount'
type DiscountScope = 'tuition_only' | 'total_payable' | 'selected_fee_items'

type FeeItem = {
  id: number
  code: string
  name: string
  category: string
  fee_type: string
  default_amount: number
}

type FeeAgreement = {
  id: number
  academic_year: string
  version_no: number
  payment_plan: PaymentPlan
  effective_from: string
  effective_to: string | null
  is_current: boolean
  status: string
  remarks: string | null
  items: Array<{
    id: number
    fee_item_id: number
    fee_code: string
    fee_category: string
    description: string
    amount: number
    is_mandatory: boolean
  }>
  discounts: Array<{
    id: number
    discount_label: string
    discount_type: DiscountType
    scope: DiscountScope
    value: number
    remark: string
    selected_fee_codes: string[]
  }>
}

type FeeAgreementItemDraft = {
  fee_item_id: number
  code: string
  name: string
  enabled: boolean
  amount: string
  description: string
}

type FeeAgreementDiscountDraft = {
  enabled: boolean
  discount_label: string
  discount_type: DiscountType
  scope: DiscountScope
  value: string
  remark: string
  selected_fee_codes: string[]
}

type FeeAgreementForm = {
  academic_year: string
  payment_plan: PaymentPlan
  effective_from: string
  effective_to: string
  remarks: string
  items: FeeAgreementItemDraft[]
  discount: FeeAgreementDiscountDraft
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'duitnow_qr' | 'cheque' | 'credit_card' | 'fpx'
type PaymentStatus = 'pending_verification' | 'verified' | 'voided'

type PaymentUser = {
  id: number
  name: string
}

type StudentPayment = {
  id: number
  student_id: number
  payment_method: PaymentMethod
  payment_date: string
  received_date: string | null
  amount: number
  bank_account: string | null
  reference_no: string | null
  payment_proof: string | null
  remark: string | null
  status: PaymentStatus
  recorded_by: PaymentUser | null
  verified_by: PaymentUser | null
  verified_at: string | null
  voided_by: PaymentUser | null
  voided_at: string | null
  void_reason: string | null
  allocations: Array<{
    id: number
    fee_item_id: number | null
    fee_agreement_item_id: number | null
    fee_code: string | null
    description: string
    amount: number
    sort_order: number
  }>
}

type PaymentAllocationDraft = {
  key: string
  fee_item_id: number | null
  fee_agreement_item_id: number | null
  description: string
  amount: string
}

type PaymentForm = {
  payment_method: PaymentMethod
  payment_date: string
  received_date: string
  amount: string
  bank_account: string
  reference_no: string
  payment_proof: string
  remark: string
  allocations: PaymentAllocationDraft[]
}

type VerifyPaymentForm = {
  received_date: string
  bank_account: string
  reference_no: string
  remark: string
}

type ValidationErrors = Record<string, string[]>

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
  recent_payments: [],
  outstanding_students: [],
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

const parents = [
  {
    name: 'Michelle Tan',
    phone: '012-345 6789',
    email: 'michelle@example.test',
    address: 'Matahari family contact',
  },
  {
    name: 'Jonathan Lim',
    phone: '012-222 4411',
    email: 'jonathan@example.test',
    address: 'Matahari family contact',
  },
]

const feeStructures = [
  { item: 'Tuition Fee', type: 'Mandatory Fee Item', amount: 'TBD', status: 'Configured in Fee Agreement' },
  { item: 'Misc Fee', type: 'Mandatory Fee Item', amount: 'TBD', status: 'Configured in Fee Agreement' },
  { item: 'Transport', type: 'Optional Fee Item', amount: 'TBD', status: 'Optional' },
]

const reports = [
  { name: 'Daily Collection', owner: 'Finance', period: 'Future phase', output: 'TBD' },
  { name: 'Outstanding Fees', owner: 'Admin', period: 'Future phase', output: 'TBD' },
  { name: 'Student Ledger', owner: 'Finance', period: 'Future phase', output: 'TBD' },
]

const emptyStudentForm: StudentForm = {
  student_no: '',
  full_name: '',
  level_group: 'primary',
  gender: '',
  dob: '',
  registration_date: '',
  status: 'active',
  notes: '',
}

const statusOptions: Array<{ value: StudentFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'inactive', label: 'Suspended / Inactive' },
  { value: 'all', label: 'All statuses' },
]

const levelGroupOptions: Array<{ value: LevelGroup; label: string }> = [
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'stp', label: 'STP' },
]

const paymentPlanOptions: Array<{ value: PaymentPlan; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
]

const discountTypeOptions: Array<{ value: DiscountType; label: string }> = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
]

const discountScopeOptions: Array<{ value: DiscountScope; label: string }> = [
  { value: 'tuition_only', label: 'Tuition Only' },
  { value: 'total_payable', label: 'Total Payable' },
  { value: 'selected_fee_items', label: 'Selected Fee Items' },
]

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'duitnow_qr', label: 'DuitNow QR' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'fpx', label: 'FPX' },
]

function formatCurrency(amount: number | null) {
  if (amount === null) {
    return 'TBD'
  }

  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('MYR', 'RM')
}

function formatStatus(status: string) {
  if (status === 'inactive') {
    return 'Suspended / Inactive'
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatLevelGroup(levelGroup: string) {
  return levelGroupOptions.find((option) => option.value === levelGroup)?.label ?? levelGroup
}

function formatValidationError(errors: ValidationErrors | undefined, field: string) {
  return errors?.[field]?.[0]
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('overdue') || normalized.includes('inactive') || normalized.includes('withdraw')) {
    return 'danger'
  }
  if (normalized.includes('paid') || normalized.includes('active') || normalized.includes('confirmed')) {
    return 'paid'
  }
  if (normalized.includes('partial') || normalized.includes('optional') || normalized.includes('graduate')) {
    return 'partial'
  }
  return 'neutral'
}

function paymentStatusClass(status: PaymentStatus) {
  if (status === 'verified') {
    return 'paid'
  }

  if (status === 'voided') {
    return 'danger'
  }

  return 'partial'
}

function hasPermission(user: CurrentUser, permission: string) {
  return user.permissions.includes(permission)
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function mapError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'Request failed. Please try again.'
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function draftKey() {
  return Math.random().toString(36).slice(2)
}

function moneyToCents(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value || 0)

  return Math.round(amount * 100)
}

function allocationTotal(allocations: PaymentAllocationDraft[]) {
  return allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
}

function defaultManualAllocation(): PaymentAllocationDraft {
  return {
    key: draftKey(),
    fee_item_id: null,
    fee_agreement_item_id: null,
    description: '',
    amount: '',
  }
}

function defaultPaymentForm(currentFeeAgreement: FeeAgreement | null): PaymentForm {
  const agreementAllocations =
    currentFeeAgreement?.items.map((item) => ({
      key: draftKey(),
      fee_item_id: item.fee_item_id,
      fee_agreement_item_id: item.id,
      description: item.description,
      amount: String(item.amount),
    })) ?? []
  const allocations = agreementAllocations.length > 0 ? agreementAllocations : [defaultManualAllocation()]
  const total = allocationTotal(allocations)

  return {
    payment_method: 'bank_transfer',
    payment_date: todayDate(),
    received_date: '',
    amount: total > 0 ? String(total) : '',
    bank_account: '',
    reference_no: '',
    payment_proof: '',
    remark: '',
    allocations,
  }
}

function defaultVerifyForm(payment?: StudentPayment): VerifyPaymentForm {
  return {
    received_date: todayDate(),
    bank_account: payment?.bank_account ?? '',
    reference_no: payment?.reference_no ?? '',
    remark: payment?.remark ?? '',
  }
}

function tomorrowAfter(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function defaultAgreementForm(feeItems: FeeItem[]): FeeAgreementForm {
  return {
    academic_year: '2026',
    payment_plan: 'monthly',
    effective_from: todayDate(),
    effective_to: '',
    remarks: '',
    items: feeItems.map((item) => ({
      fee_item_id: item.id,
      code: item.code,
      name: item.name,
      enabled: ['TUITION', 'MISC'].includes(item.code),
      amount: String(item.default_amount || ''),
      description: '',
    })),
    discount: {
      enabled: false,
      discount_label: '',
      discount_type: 'fixed_amount',
      scope: 'total_payable',
      value: '',
      remark: '',
      selected_fee_codes: [],
    },
  }
}

function agreementToForm(agreement: FeeAgreement, feeItems: FeeItem[]): FeeAgreementForm {
  const agreementItemsByCode = new Map(agreement.items.map((item) => [item.fee_code, item]))
  const firstDiscount = agreement.discounts[0]

  return {
    academic_year: agreement.academic_year,
    payment_plan: agreement.payment_plan,
    effective_from: tomorrowAfter(agreement.effective_from),
    effective_to: '',
    remarks: agreement.remarks ?? '',
    items: feeItems.map((item) => {
      const agreementItem = agreementItemsByCode.get(item.code)

      return {
        fee_item_id: item.id,
        code: item.code,
        name: item.name,
        enabled: Boolean(agreementItem) || ['TUITION', 'MISC'].includes(item.code),
        amount: String(agreementItem?.amount ?? item.default_amount ?? ''),
        description: item.code === 'OTHERS' ? agreementItem?.description ?? '' : '',
      }
    }),
    discount: firstDiscount
      ? {
          enabled: true,
          discount_label: firstDiscount.discount_label,
          discount_type: firstDiscount.discount_type,
          scope: firstDiscount.scope,
          value: String(firstDiscount.value),
          remark: firstDiscount.remark,
          selected_fee_codes: firstDiscount.selected_fee_codes,
        }
      : {
          enabled: false,
          discount_label: '',
          discount_type: 'fixed_amount',
          scope: 'total_payable',
          value: '',
          remark: '',
          selected_fee_codes: [],
        },
  }
}

function agreementPreview(form: FeeAgreementForm) {
  const enabledItems = form.items.filter((item) => item.enabled)
  const subtotal = enabledItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const tuitionAmount = enabledItems
    .filter((item) => item.code === 'TUITION')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const selectedAmount = enabledItems
    .filter((item) => form.discount.selected_fee_codes.includes(item.code))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  let discountAmount = 0

  if (form.discount.enabled) {
    const value = Number(form.discount.value || 0)

    if (form.discount.discount_type === 'percentage') {
      const base =
        form.discount.scope === 'total_payable'
          ? subtotal
          : form.discount.scope === 'selected_fee_items'
            ? selectedAmount
            : tuitionAmount

      discountAmount = (base * value) / 100
    } else {
      discountAmount = value
    }
  }

  return {
    subtotal,
    discountAmount,
    total: Math.max(subtotal - discountAmount, 0),
  }
}

function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function Message({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success'
  children: ReactNode
}) {
  return (
    <div className={`message-card ${tone}`}>
      <AlertTriangle size={17} />
      <span>{children}</span>
    </div>
  )
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (user: CurrentUser) => void
}) {
  const [email, setEmail] = useState('admin@mis.test')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<ValidationErrors>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setErrors(undefined)
    setIsSubmitting(true)

    try {
      const response = await apiRequest<{ user: CurrentUser }>('/login', {
        method: 'POST',
        body: { email, password },
      })
      onLogin(response.user)
    } catch (loginError) {
      if (loginError instanceof ApiError) {
        setErrors(loginError.errors)
      }
      setError(mapError(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submitLogin}>
        <img src={misLogo} alt="MIS logo" />
        <div>
          <p className="eyebrow">Matahari School ERP</p>
          <h1>Admin Login</h1>
        </div>

        {error && <Message tone="error">{error}</Message>}

        <label className="form-field">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
          {formatValidationError(errors, 'email') && (
            <small>{formatValidationError(errors, 'email')}</small>
          )}
        </label>

        <label className="form-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {formatValidationError(errors, 'password') && (
            <small>{formatValidationError(errors, 'password')}</small>
          )}
        </label>

        <button className="primary-action full-width" disabled={isSubmitting}>
          <LockKeyhole size={18} />
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  )
}

function StudentsPage({
  user,
  onUnauthorized,
}: {
  user: CurrentUser
  onUnauthorized: () => void
}) {
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null)
  const [statusFilter, setStatusFilter] = useState<StudentFilter>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<StudentForm>(emptyStudentForm)
  const [formErrors, setFormErrors] = useState<ValidationErrors>()
  const [statusDraft, setStatusDraft] = useState<StudentStatus>('active')
  const [feeItems, setFeeItems] = useState<FeeItem[]>([])
  const [feeAgreements, setFeeAgreements] = useState<FeeAgreement[]>([])
  const [feeAgreementMode, setFeeAgreementMode] = useState<'create' | 'supersede'>('create')
  const [showFeeAgreementForm, setShowFeeAgreementForm] = useState(false)
  const [feeAgreementForm, setFeeAgreementForm] = useState<FeeAgreementForm>(defaultAgreementForm([]))
  const [feeAgreementErrors, setFeeAgreementErrors] = useState<ValidationErrors>()
  const [isSavingFeeAgreement, setIsSavingFeeAgreement] = useState(false)
  const [payments, setPayments] = useState<StudentPayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(defaultPaymentForm(null))
  const [paymentErrors, setPaymentErrors] = useState<ValidationErrors>()
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<number | null>(null)
  const [verifyForm, setVerifyForm] = useState<VerifyPaymentForm>(defaultVerifyForm())
  const [verifyErrors, setVerifyErrors] = useState<ValidationErrors>()
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidErrors, setVoidErrors] = useState<ValidationErrors>()
  const [isVoidingPayment, setIsVoidingPayment] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canCreateStudents = hasPermission(user, 'students.create')
  const canUpdateStatus = hasPermission(user, 'students.update_status')
  const canCreateFeeAgreement = hasPermission(user, 'fee_agreements.create')
  const canUpdateFeeAgreement = hasPermission(user, 'fee_agreements.update')
  const canEditFeeAgreement = canCreateFeeAgreement || canUpdateFeeAgreement
  const canViewPayments = hasPermission(user, 'payments.view')
  const canCreatePayments = hasPermission(user, 'payments.create')
  const canVerifyPayments = hasPermission(user, 'payments.verify')
  const canVoidPayments = hasPermission(user, 'payments.void')
  const currentFeeAgreement = feeAgreements.find((agreement) => agreement.is_current) ?? null
  const paymentAllocationTotal = allocationTotal(paymentForm.allocations)
  const paymentAmountCents = moneyToCents(paymentForm.amount)
  const allocationTotalCents = moneyToCents(paymentAllocationTotal)

  const handleApiError = (apiError: unknown) => {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized()
      return
    }

    setError(mapError(apiError))
  }

  const loadStudents = async (filter = statusFilter) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await apiRequest<{ data: StudentSummary[] }>(`/students?status=${filter}`)
      setStudents(response.data)
    } catch (loadError) {
      handleApiError(loadError)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStudentDetail = async (studentId: number) => {
    setError('')

    try {
      const response = await apiRequest<{ student: StudentDetail }>(`/students/${studentId}`)
      setSelectedStudent(response.student)
      setStatusDraft(response.student.status)
      await loadFeeAgreementData(response.student.id)
      await loadPaymentData(response.student.id)
    } catch (detailError) {
      handleApiError(detailError)
    }
  }

  const loadFeeAgreementData = async (studentId: number) => {
    try {
      const agreementsResponse = await apiRequest<{ data: FeeAgreement[] }>(`/students/${studentId}/fee-agreements`)
      setFeeAgreements(agreementsResponse.data)
      setShowFeeAgreementForm(false)
      setFeeAgreementErrors(undefined)

      if (canEditFeeAgreement) {
        const itemsResponse = await apiRequest<{ data: FeeItem[] }>('/fee-items')
        setFeeItems(itemsResponse.data)
        setFeeAgreementForm(defaultAgreementForm(itemsResponse.data))
      } else {
        setFeeItems([])
        setFeeAgreementForm(defaultAgreementForm([]))
      }
    } catch (agreementError) {
      handleApiError(agreementError)
    }
  }

  const loadPaymentData = async (studentId: number) => {
    if (!canViewPayments) {
      setPayments([])
      return
    }

    setIsLoadingPayments(true)

    try {
      const response = await apiRequest<{ data: StudentPayment[] }>(`/students/${studentId}/payments`)
      setPayments(response.data)
    } catch (paymentLoadError) {
      handleApiError(paymentLoadError)
    } finally {
      setIsLoadingPayments(false)
    }
  }

  useEffect(() => {
    void loadStudents(statusFilter)
  }, [statusFilter])

  const updateForm = (field: keyof StudentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submitStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormErrors(undefined)
    setError('')
    setMessage('')
    setIsCreating(true)

    const body = {
      student_no: form.student_no,
      full_name: form.full_name,
      level_group: form.level_group,
      gender: form.gender || null,
      dob: form.dob || null,
      registration_date: form.registration_date || null,
      status: form.status,
      notes: form.notes || null,
    }

    try {
      const response = await apiRequest<{ student: StudentDetail }>('/students', {
        method: 'POST',
        body,
      })
      setForm(emptyStudentForm)
      setShowCreateForm(false)
      setSelectedStudent(response.student)
      setStatusDraft(response.student.status)
      await loadFeeAgreementData(response.student.id)
      await loadPaymentData(response.student.id)
      setMessage(`Created student ${response.student.student_no}.`)
      await loadStudents(statusFilter)
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 422) {
        setFormErrors(createError.errors)
      }
      handleApiError(createError)
    } finally {
      setIsCreating(false)
    }
  }

  const updateStudentStatus = async () => {
    if (!selectedStudent) {
      return
    }

    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{
        student: Pick<StudentSummary, 'id' | 'student_no' | 'full_name' | 'status'>
      }>(
        `/students/${selectedStudent.id}/status`,
        {
          method: 'PATCH',
          body: { status: statusDraft },
        },
      )
      setSelectedStudent({
        ...selectedStudent,
        status: response.student.status,
      })
      setStatusDraft(response.student.status)
      setMessage(`Updated status for ${response.student.student_no}.`)
      await loadStudents(statusFilter)
    } catch (statusError) {
      handleApiError(statusError)
    }
  }

  const updateFeeAgreementItem = (
    feeItemId: number,
    field: keyof Pick<FeeAgreementItemDraft, 'enabled' | 'amount' | 'description'>,
    value: string | boolean,
  ) => {
    setFeeAgreementForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.fee_item_id === feeItemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }))
  }

  const updateFeeAgreementDiscount = (field: keyof FeeAgreementDiscountDraft, value: string | boolean | string[]) => {
    setFeeAgreementForm((current) => {
      const nextDiscount = {
        ...current.discount,
        [field]: value,
      }

      if (field === 'discount_type') {
        nextDiscount.scope = value === 'percentage' ? 'tuition_only' : 'total_payable'
      }

      return {
        ...current,
        discount: nextDiscount,
      }
    })
  }

  const beginCreateFeeAgreement = () => {
    setFeeAgreementMode('create')
    setFeeAgreementForm(defaultAgreementForm(feeItems))
    setFeeAgreementErrors(undefined)
    setShowFeeAgreementForm(true)
  }

  const beginSupersedeFeeAgreement = () => {
    if (!currentFeeAgreement) {
      return
    }

    setFeeAgreementMode('supersede')
    setFeeAgreementForm(agreementToForm(currentFeeAgreement, feeItems))
    setFeeAgreementErrors(undefined)
    setShowFeeAgreementForm(true)
  }

  const submitFeeAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedStudent) {
      return
    }

    setIsSavingFeeAgreement(true)
    setFeeAgreementErrors(undefined)
    setError('')
    setMessage('')

    const items = feeAgreementForm.items
      .filter((item) => item.enabled)
      .map((item) => ({
        fee_item_id: item.fee_item_id,
        amount: Number(item.amount || 0),
        description: item.code === 'OTHERS' ? item.description : item.description || undefined,
      }))

    const discounts =
      feeAgreementForm.discount.enabled
        ? [
            {
              discount_label: feeAgreementForm.discount.discount_label,
              discount_type: feeAgreementForm.discount.discount_type,
              scope: feeAgreementForm.discount.scope,
              value: Number(feeAgreementForm.discount.value || 0),
              remark: feeAgreementForm.discount.remark,
              selected_fee_codes: feeAgreementForm.discount.selected_fee_codes,
            },
          ]
        : []

    const baseBody = {
      payment_plan: feeAgreementForm.payment_plan,
      effective_from: feeAgreementForm.effective_from,
      effective_to: feeAgreementForm.effective_to || null,
      remarks: feeAgreementForm.remarks || null,
      items,
      discounts,
    }

    const body =
      feeAgreementMode === 'create'
        ? {
            ...baseBody,
            academic_year: feeAgreementForm.academic_year,
          }
        : baseBody

    try {
      const response = await apiRequest<{ fee_agreement: FeeAgreement }>(
        feeAgreementMode === 'create'
          ? `/students/${selectedStudent.id}/fee-agreements`
          : `/fee-agreements/${currentFeeAgreement?.id}/supersede`,
        {
          method: 'POST',
          body,
        },
      )

      await loadFeeAgreementData(selectedStudent.id)
      setShowFeeAgreementForm(false)
      setMessage(
        feeAgreementMode === 'create'
          ? `Created Fee Agreement v${response.fee_agreement.version_no}.`
          : `Superseded Fee Agreement with v${response.fee_agreement.version_no}.`,
      )
    } catch (agreementError) {
      if (agreementError instanceof ApiError && agreementError.status === 422) {
        setFeeAgreementErrors(agreementError.errors)
      }
      handleApiError(agreementError)
    } finally {
      setIsSavingFeeAgreement(false)
    }
  }

  const beginCreatePayment = () => {
    setPaymentForm(defaultPaymentForm(currentFeeAgreement))
    setPaymentErrors(undefined)
    setShowPaymentForm(true)
  }

  const updatePaymentForm = (field: keyof Omit<PaymentForm, 'allocations'>, value: string) => {
    setPaymentForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updatePaymentAllocation = (
    key: string,
    field: keyof Pick<PaymentAllocationDraft, 'description' | 'amount'>,
    value: string,
  ) => {
    setPaymentForm((current) => ({
      ...current,
      allocations: current.allocations.map((allocation) =>
        allocation.key === key
          ? {
              ...allocation,
              [field]: value,
            }
          : allocation,
      ),
    }))
  }

  const selectPaymentAllocationSource = (key: string, value: string) => {
    setPaymentForm((current) => ({
      ...current,
      allocations: current.allocations.map((allocation) => {
        if (allocation.key !== key) {
          return allocation
        }

        if (value === 'manual') {
          return {
            ...allocation,
            fee_item_id: null,
            fee_agreement_item_id: null,
            description: '',
          }
        }

        const feeAgreementItemId = Number(value)
        const feeAgreementItem = currentFeeAgreement?.items.find((item) => item.id === feeAgreementItemId)

        if (!feeAgreementItem) {
          return allocation
        }

        return {
          ...allocation,
          fee_item_id: feeAgreementItem.fee_item_id,
          fee_agreement_item_id: feeAgreementItem.id,
          description: feeAgreementItem.description,
          amount: allocation.amount || String(feeAgreementItem.amount),
        }
      }),
    }))
  }

  const addPaymentAllocation = () => {
    setPaymentForm((current) => ({
      ...current,
      allocations: [...current.allocations, defaultManualAllocation()],
    }))
  }

  const removePaymentAllocation = (key: string) => {
    setPaymentForm((current) => ({
      ...current,
      allocations:
        current.allocations.length === 1
          ? [defaultManualAllocation()]
          : current.allocations.filter((allocation) => allocation.key !== key),
    }))
  }

  const validatePaymentForm = () => {
    const nextErrors: ValidationErrors = {}

    if (paymentForm.payment_method === 'cash' && !paymentForm.received_date) {
      nextErrors.received_date = ['Received date is required for cash payments.']
    }

    if (paymentForm.allocations.length === 0) {
      nextErrors.allocations = ['At least one allocation row is required.']
    }

    if (paymentAmountCents <= 0) {
      nextErrors.amount = ['Payment amount must be more than zero.']
    }

    if (paymentAmountCents !== allocationTotalCents) {
      nextErrors.allocations = ['Allocation total must equal payment amount.']
    }

    paymentForm.allocations.forEach((allocation, index) => {
      if (!allocation.fee_item_id && !allocation.fee_agreement_item_id && !allocation.description.trim()) {
        nextErrors[`allocations.${index}.description`] = ['Manual allocation rows require a description.']
      }
    })

    setPaymentErrors(Object.keys(nextErrors).length > 0 ? nextErrors : undefined)

    return Object.keys(nextErrors).length === 0
  }

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedStudent || !validatePaymentForm()) {
      return
    }

    setIsSavingPayment(true)
    setError('')
    setMessage('')

    try {
      await apiRequest<{ payment: StudentPayment }>(`/students/${selectedStudent.id}/payments`, {
        method: 'POST',
        body: {
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          received_date: paymentForm.received_date || null,
          amount: Number(paymentForm.amount),
          bank_account: paymentForm.bank_account || null,
          reference_no: paymentForm.reference_no || null,
          payment_proof: paymentForm.payment_proof || null,
          remark: paymentForm.remark || null,
          allocations: paymentForm.allocations.map((allocation) => ({
            fee_item_id: allocation.fee_item_id,
            fee_agreement_item_id: allocation.fee_agreement_item_id,
            description: allocation.description || null,
            amount: Number(allocation.amount || 0),
          })),
        },
      })
      setShowPaymentForm(false)
      setPaymentForm(defaultPaymentForm(currentFeeAgreement))
      setPaymentErrors(undefined)
      await loadPaymentData(selectedStudent.id)
      setMessage(
        paymentForm.payment_method === 'cash'
          ? 'Cash payment recorded as verified.'
          : 'Payment recorded and pending finance verification.',
      )
    } catch (paymentError) {
      if (paymentError instanceof ApiError && paymentError.status === 422) {
        setPaymentErrors(paymentError.errors)
      }
      handleApiError(paymentError)
    } finally {
      setIsSavingPayment(false)
    }
  }

  const beginVerifyPayment = (payment: StudentPayment) => {
    setVerifyingPaymentId(payment.id)
    setVerifyForm(defaultVerifyForm(payment))
    setVerifyErrors(undefined)
    setVoidingPaymentId(null)
  }

  const submitVerifyPayment = async (event: FormEvent<HTMLFormElement>, paymentId: number) => {
    event.preventDefault()

    if (!selectedStudent) {
      return
    }

    setIsVerifyingPayment(true)
    setVerifyErrors(undefined)
    setError('')
    setMessage('')

    try {
      await apiRequest<{ payment: StudentPayment }>(`/payments/${paymentId}/verify`, {
        method: 'POST',
        body: {
          received_date: verifyForm.received_date,
          bank_account: verifyForm.bank_account || null,
          reference_no: verifyForm.reference_no || null,
          remark: verifyForm.remark || null,
        },
      })
      setVerifyingPaymentId(null)
      await loadPaymentData(selectedStudent.id)
      setMessage('Payment verified.')
    } catch (verifyError) {
      if (verifyError instanceof ApiError && verifyError.status === 422) {
        setVerifyErrors(verifyError.errors)
      }
      handleApiError(verifyError)
    } finally {
      setIsVerifyingPayment(false)
    }
  }

  const beginVoidPayment = (payment: StudentPayment) => {
    setVoidingPaymentId(payment.id)
    setVoidReason(payment.void_reason ?? '')
    setVoidErrors(undefined)
    setVerifyingPaymentId(null)
  }

  const submitVoidPayment = async (event: FormEvent<HTMLFormElement>, paymentId: number) => {
    event.preventDefault()

    if (!selectedStudent) {
      return
    }

    setIsVoidingPayment(true)
    setVoidErrors(undefined)
    setError('')
    setMessage('')

    try {
      await apiRequest<{ payment: StudentPayment }>(`/payments/${paymentId}/void`, {
        method: 'POST',
        body: {
          void_reason: voidReason,
        },
      })
      setVoidingPaymentId(null)
      setVoidReason('')
      await loadPaymentData(selectedStudent.id)
      setMessage('Payment voided.')
    } catch (voidError) {
      if (voidError instanceof ApiError && voidError.status === 422) {
        setVoidErrors(voidError.errors)
      }
      handleApiError(voidError)
    } finally {
      setIsVoidingPayment(false)
    }
  }

  const feeAgreementPreview = agreementPreview(feeAgreementForm)

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Student management"
        title="Students"
        action={
          canCreateStudents ? (
            <button className="primary-action compact" onClick={() => setShowCreateForm((value) => !value)}>
              <UserPlus size={18} />
              {showCreateForm ? 'Close Form' : 'Add Student'}
            </button>
          ) : (
            <span className="permission-note">View only</span>
          )
        }
      />

      <section className="summary-grid three">
        <article className="metric-card positive">
          <span>Visible Students</span>
          <strong>{students.length}</strong>
        </article>
        <article className="metric-card">
          <span>Status Filter</span>
          <strong>{statusOptions.find((option) => option.value === statusFilter)?.label}</strong>
        </article>
        <article className="metric-card">
          <span>Fee / Outstanding</span>
          <strong>TBD</strong>
        </article>
      </section>

      {error && <Message tone="error">{error}</Message>}
      {message && <Message tone="success">{message}</Message>}

      {showCreateForm && canCreateStudents && (
        <form className="panel student-form" onSubmit={submitStudent}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">New student</p>
              <h2>Create Student Profile</h2>
            </div>
            <Plus size={20} />
          </div>

          <div className="form-grid">
            <label className="form-field">
              Student ID
              <input value={form.student_no} onChange={(event) => updateForm('student_no', event.target.value)} />
              {formatValidationError(formErrors, 'student_no') && (
                <small>{formatValidationError(formErrors, 'student_no')}</small>
              )}
            </label>

            <label className="form-field">
              Student Name
              <input value={form.full_name} onChange={(event) => updateForm('full_name', event.target.value)} />
              {formatValidationError(formErrors, 'full_name') && (
                <small>{formatValidationError(formErrors, 'full_name')}</small>
              )}
            </label>

            <label className="form-field">
              Level Group
              <select
                value={form.level_group}
                onChange={(event) => updateForm('level_group', event.target.value)}
              >
                {levelGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {formatValidationError(formErrors, 'level_group') && (
                <small>{formatValidationError(formErrors, 'level_group')}</small>
              )}
            </label>

            <label className="form-field">
              Initial Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statusOptions
                  .filter((option) => option.value !== 'all')
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>

            <label className="form-field">
              Gender
              <input value={form.gender} onChange={(event) => updateForm('gender', event.target.value)} />
            </label>

            <label className="form-field">
              Date of Birth
              <input type="date" value={form.dob} onChange={(event) => updateForm('dob', event.target.value)} />
            </label>

            <label className="form-field">
              Registration Date
              <input
                type="date"
                value={form.registration_date}
                onChange={(event) => updateForm('registration_date', event.target.value)}
              />
            </label>

            <label className="form-field wide">
              Remarks
              <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
            </label>
          </div>

          <button className="primary-action" disabled={isCreating}>
            <UserPlus size={18} />
            {isCreating ? 'Creating...' : 'Create Student'}
          </button>
        </form>
      )}

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Operational list</p>
            <h2>Student List</h2>
          </div>
          <div className="toolbar-actions">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StudentFilter)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="secondary-action" onClick={() => void loadStudents()}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Class</th>
                <th>Fee Amount</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.student_no}</td>
                  <td>{student.class?.name ?? formatLevelGroup(student.level_group)}</td>
                  <td>{formatCurrency(student.fee_amount)}</td>
                  <td>{formatCurrency(student.outstanding_balance)}</td>
                  <td>
                    <span className={`badge ${statusClass(student.status)}`}>{formatStatus(student.status)}</span>
                  </td>
                  <td>
                    <button className="table-action" onClick={() => void loadStudentDetail(student.id)}>
                      <Eye size={16} />
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan={7}>No students found for this filter.</td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7}>Loading students...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {selectedStudent && (
        <article className="panel student-detail">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Student detail</p>
              <h2>
                {selectedStudent.full_name} <span>{selectedStudent.student_no}</span>
              </h2>
            </div>
            <span className={`badge ${statusClass(selectedStudent.status)}`}>
              {formatStatus(selectedStudent.status)}
            </span>
          </div>

          <section className="detail-grid">
            <div className="detail-block">
              <h3>Student Profile</h3>
              <dl>
                <div>
                  <dt>Student ID</dt>
                  <dd>{selectedStudent.student_no}</dd>
                </div>
                <div>
                  <dt>Level Group</dt>
                  <dd>{formatLevelGroup(selectedStudent.level_group)}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>{selectedStudent.class?.name ?? 'TBD'}</dd>
                </div>
                <div>
                  <dt>DOB</dt>
                  <dd>{selectedStudent.dob ?? 'TBD'}</dd>
                </div>
              </dl>
            </div>

            <div className="detail-block">
              <h3>Parent / Guardian</h3>
              {selectedStudent.parents.length > 0 ? (
                selectedStudent.parents.map((parent) => (
                  <p key={parent.id}>
                    {parent.full_name}
                    {parent.relationship ? ` / ${parent.relationship}` : ''}
                  </p>
                ))
              ) : (
                <p>TBD</p>
              )}
            </div>

            <div className="detail-block">
              <h3>Finance Placeholders</h3>
              <dl>
                <div>
                  <dt>Fee Amount</dt>
                  <dd>{formatCurrency(selectedStudent.fee_amount)}</dd>
                </div>
                <div>
                  <dt>Outstanding</dt>
                  <dd>{formatCurrency(selectedStudent.outstanding_balance)}</dd>
                </div>
              </dl>
            </div>

            <div className="detail-block">
              <h3>Status Action</h3>
              {canUpdateStatus ? (
                <div className="status-editor">
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as StudentStatus)}>
                    {statusOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                  <button className="secondary-action" onClick={() => void updateStudentStatus()}>
                    Update Status
                  </button>
                </div>
              ) : (
                <p>You do not have permission to update student status.</p>
              )}
            </div>
          </section>

          <div className="remarks-block">
            <h3>Remarks</h3>
            <p>{selectedStudent.notes || 'TBD'}</p>
          </div>

          <section className="fee-agreement-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Fee Agreement</p>
                <h2>Agreement Snapshot and History</h2>
              </div>
              {canEditFeeAgreement ? (
                <div className="toolbar-actions">
                  <button className="secondary-action" onClick={beginCreateFeeAgreement}>
                    Create Agreement
                  </button>
                  <button className="secondary-action" disabled={!currentFeeAgreement} onClick={beginSupersedeFeeAgreement}>
                    Supersede Current
                  </button>
                </div>
              ) : (
                <span className="permission-note">Finance view only</span>
              )}
            </div>

            {currentFeeAgreement ? (
              <div className="agreement-current">
                <div>
                  <span className="badge paid">Current</span>
                  <h3>
                    {currentFeeAgreement.academic_year} / v{currentFeeAgreement.version_no}
                  </h3>
                  <p>
                    {currentFeeAgreement.payment_plan} from {currentFeeAgreement.effective_from}
                  </p>
                </div>
                <strong>{formatCurrency(currentFeeAgreement.items.reduce((sum, item) => sum + item.amount, 0))}</strong>
              </div>
            ) : (
              <Message tone="info">No Fee Agreement has been created for this student yet.</Message>
            )}

            {showFeeAgreementForm && canEditFeeAgreement && (
              <form className="agreement-form" onSubmit={submitFeeAgreement}>
                <div className="form-grid">
                  {feeAgreementMode === 'create' && (
                    <label className="form-field">
                      Academic Year
                      <input
                        value={feeAgreementForm.academic_year}
                        onChange={(event) =>
                          setFeeAgreementForm((current) => ({ ...current, academic_year: event.target.value }))
                        }
                      />
                      {formatValidationError(feeAgreementErrors, 'academic_year') && (
                        <small>{formatValidationError(feeAgreementErrors, 'academic_year')}</small>
                      )}
                    </label>
                  )}

                  <label className="form-field">
                    Payment Plan
                    <select
                      value={feeAgreementForm.payment_plan}
                      onChange={(event) =>
                        setFeeAgreementForm((current) => ({
                          ...current,
                          payment_plan: event.target.value as PaymentPlan,
                        }))
                      }
                    >
                      {paymentPlanOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    Effective From
                    <input
                      type="date"
                      value={feeAgreementForm.effective_from}
                      onChange={(event) =>
                        setFeeAgreementForm((current) => ({ ...current, effective_from: event.target.value }))
                      }
                    />
                    {formatValidationError(feeAgreementErrors, 'effective_from') && (
                      <small>{formatValidationError(feeAgreementErrors, 'effective_from')}</small>
                    )}
                  </label>

                  <label className="form-field">
                    Effective To
                    <input
                      type="date"
                      value={feeAgreementForm.effective_to}
                      onChange={(event) =>
                        setFeeAgreementForm((current) => ({ ...current, effective_to: event.target.value }))
                      }
                    />
                  </label>

                  <label className="form-field wide">
                    Agreement Remarks
                    <textarea
                      value={feeAgreementForm.remarks}
                      onChange={(event) =>
                        setFeeAgreementForm((current) => ({ ...current, remarks: event.target.value }))
                      }
                    />
                  </label>
                </div>

                {formatValidationError(feeAgreementErrors, 'items') && (
                  <Message tone="error">{formatValidationError(feeAgreementErrors, 'items')}</Message>
                )}

                <div className="agreement-items-grid">
                  {feeAgreementForm.items.map((item) => {
                    const isMandatory = ['TUITION', 'MISC'].includes(item.code)

                    return (
                      <div className="agreement-item-row" key={item.fee_item_id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            disabled={isMandatory}
                            onChange={(event) => updateFeeAgreementItem(item.fee_item_id, 'enabled', event.target.checked)}
                          />
                          <span>
                            {item.name}
                            {isMandatory ? ' *' : ''}
                          </span>
                        </label>
                        {item.code === 'OTHERS' && (
                          <input
                            placeholder="Custom description"
                            value={item.description}
                            onChange={(event) => updateFeeAgreementItem(item.fee_item_id, 'description', event.target.value)}
                          />
                        )}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(event) => updateFeeAgreementItem(item.fee_item_id, 'amount', event.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="discount-editor">
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={feeAgreementForm.discount.enabled}
                      onChange={(event) => updateFeeAgreementDiscount('enabled', event.target.checked)}
                    />
                    Manual discount
                  </label>

                  {feeAgreementForm.discount.enabled && (
                    <div className="form-grid">
                      <label className="form-field">
                        Discount Label
                        <input
                          value={feeAgreementForm.discount.discount_label}
                          onChange={(event) => updateFeeAgreementDiscount('discount_label', event.target.value)}
                        />
                      </label>
                      <label className="form-field">
                        Discount Type
                        <select
                          value={feeAgreementForm.discount.discount_type}
                          onChange={(event) => updateFeeAgreementDiscount('discount_type', event.target.value as DiscountType)}
                        >
                          {discountTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        Scope
                        <select
                          value={feeAgreementForm.discount.scope}
                          onChange={(event) => updateFeeAgreementDiscount('scope', event.target.value as DiscountScope)}
                        >
                          {discountScopeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        Value
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={feeAgreementForm.discount.value}
                          onChange={(event) => updateFeeAgreementDiscount('value', event.target.value)}
                        />
                      </label>
                      <label className="form-field wide">
                        Discount Remark
                        <textarea
                          value={feeAgreementForm.discount.remark}
                          onChange={(event) => updateFeeAgreementDiscount('remark', event.target.value)}
                        />
                        {formatValidationError(feeAgreementErrors, 'discounts.0.remark') && (
                          <small>{formatValidationError(feeAgreementErrors, 'discounts.0.remark')}</small>
                        )}
                      </label>
                      {feeAgreementForm.discount.scope === 'selected_fee_items' && (
                        <div className="form-field wide">
                          Selected Fee Items
                          <div className="permission-list">
                            {feeAgreementForm.items
                              .filter((item) => item.enabled)
                              .map((item) => (
                                <label className="checkbox-line" key={item.code}>
                                  <input
                                    type="checkbox"
                                    checked={feeAgreementForm.discount.selected_fee_codes.includes(item.code)}
                                    onChange={(event) => {
                                      const nextCodes = event.target.checked
                                        ? [...feeAgreementForm.discount.selected_fee_codes, item.code]
                                        : feeAgreementForm.discount.selected_fee_codes.filter((code) => code !== item.code)
                                      updateFeeAgreementDiscount('selected_fee_codes', nextCodes)
                                    }}
                                  />
                                  {item.name}
                                </label>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="agreement-preview">
                  <span>Subtotal {formatCurrency(feeAgreementPreview.subtotal)}</span>
                  <span>Manual Discount {formatCurrency(feeAgreementPreview.discountAmount)}</span>
                  <strong>Preview Total {formatCurrency(feeAgreementPreview.total)}</strong>
                </div>

                <button className="primary-action" disabled={isSavingFeeAgreement}>
                  {isSavingFeeAgreement
                    ? 'Saving...'
                    : feeAgreementMode === 'create'
                      ? 'Create Fee Agreement'
                      : 'Supersede Agreement'}
                </button>
              </form>
            )}

            <div className="agreement-history">
              <h3>Version History</h3>
              {feeAgreements.length === 0 ? (
                <p>No agreement history yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Academic Year</th>
                        <th>Plan</th>
                        <th>Effective</th>
                        <th>Status</th>
                        <th>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeAgreements.map((agreement) => (
                        <tr key={agreement.id}>
                          <td>v{agreement.version_no}</td>
                          <td>{agreement.academic_year}</td>
                          <td>{agreement.payment_plan}</td>
                          <td>
                            {agreement.effective_from}
                            {agreement.effective_to ? ` to ${agreement.effective_to}` : ''}
                          </td>
                          <td>
                            <span className={`badge ${agreement.is_current ? 'paid' : 'neutral'}`}>
                              {agreement.status}
                            </span>
                          </td>
                          <td>{agreement.items.map((item) => item.fee_code).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="payment-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Payments</p>
                <h2>Payment History</h2>
              </div>
              {canCreatePayments ? (
                <button className="secondary-action" onClick={showPaymentForm ? () => setShowPaymentForm(false) : beginCreatePayment}>
                  {showPaymentForm ? 'Close Payment Form' : 'Create Payment'}
                </button>
              ) : (
                <span className="permission-note">Payment create unavailable</span>
              )}
            </div>

            {!canViewPayments && <Message tone="info">You do not have permission to view payments.</Message>}

            {showPaymentForm && canCreatePayments && (
              <form className="payment-form" onSubmit={submitPayment}>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Admin recording</p>
                    <h3>Create Payment</h3>
                  </div>
                  <span className={`badge ${paymentForm.payment_method === 'cash' ? 'paid' : 'partial'}`}>
                    {paymentForm.payment_method === 'cash' ? 'Cash verifies on save' : 'Pending verification'}
                  </span>
                </div>

                <div className="form-grid">
                  <label className="form-field">
                    Payment Method
                    <select
                      value={paymentForm.payment_method}
                      onChange={(event) => updatePaymentForm('payment_method', event.target.value)}
                    >
                      {paymentMethodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    Payment Date
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(event) => updatePaymentForm('payment_date', event.target.value)}
                    />
                    {formatValidationError(paymentErrors, 'payment_date') && (
                      <small>{formatValidationError(paymentErrors, 'payment_date')}</small>
                    )}
                  </label>

                  <label className="form-field">
                    Received Date
                    <input
                      type="date"
                      value={paymentForm.received_date}
                      onChange={(event) => updatePaymentForm('received_date', event.target.value)}
                    />
                    {formatValidationError(paymentErrors, 'received_date') && (
                      <small>{formatValidationError(paymentErrors, 'received_date')}</small>
                    )}
                  </label>

                  <label className="form-field">
                    Amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) => updatePaymentForm('amount', event.target.value)}
                    />
                    {formatValidationError(paymentErrors, 'amount') && (
                      <small>{formatValidationError(paymentErrors, 'amount')}</small>
                    )}
                  </label>

                  <label className="form-field">
                    Bank Account
                    <input
                      value={paymentForm.bank_account}
                      onChange={(event) => updatePaymentForm('bank_account', event.target.value)}
                    />
                  </label>

                  <label className="form-field">
                    Reference No
                    <input
                      value={paymentForm.reference_no}
                      onChange={(event) => updatePaymentForm('reference_no', event.target.value)}
                    />
                  </label>

                  <label className="form-field wide">
                    Payment Proof Text / Reference
                    <textarea
                      value={paymentForm.payment_proof}
                      onChange={(event) => updatePaymentForm('payment_proof', event.target.value)}
                    />
                  </label>

                  <label className="form-field wide">
                    Remark
                    <textarea
                      value={paymentForm.remark}
                      onChange={(event) => updatePaymentForm('remark', event.target.value)}
                    />
                  </label>
                </div>

                <div className="payment-allocation-block">
                  <div className="payment-subheader">
                    <div>
                      <h3>Allocation Rows</h3>
                      <p>
                        Allocated {formatCurrency(paymentAllocationTotal)} of {formatCurrency(Number(paymentForm.amount || 0))}
                      </p>
                    </div>
                    <button type="button" className="table-action" onClick={addPaymentAllocation}>
                      Add Row
                    </button>
                  </div>

                  {formatValidationError(paymentErrors, 'allocations') && (
                    <Message tone="error">{formatValidationError(paymentErrors, 'allocations')}</Message>
                  )}

                  <div className="allocation-rows">
                    {paymentForm.allocations.map((allocation, index) => (
                      <div className="allocation-row" key={allocation.key}>
                        <label className="form-field">
                          Source
                          <select
                            value={allocation.fee_agreement_item_id ?? 'manual'}
                            onChange={(event) => selectPaymentAllocationSource(allocation.key, event.target.value)}
                          >
                            <option value="manual">Manual allocation</option>
                            {currentFeeAgreement?.items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.fee_code} / {item.description}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="form-field">
                          Description
                          <input
                            value={allocation.description}
                            onChange={(event) => updatePaymentAllocation(allocation.key, 'description', event.target.value)}
                          />
                          {formatValidationError(paymentErrors, `allocations.${index}.description`) && (
                            <small>{formatValidationError(paymentErrors, `allocations.${index}.description`)}</small>
                          )}
                        </label>

                        <label className="form-field">
                          Amount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={allocation.amount}
                            onChange={(event) => updatePaymentAllocation(allocation.key, 'amount', event.target.value)}
                          />
                        </label>

                        <button type="button" className="table-action danger-action" onClick={() => removePaymentAllocation(allocation.key)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`agreement-preview ${paymentAmountCents === allocationTotalCents ? '' : 'warning'}`}>
                  <span>Payment {formatCurrency(Number(paymentForm.amount || 0))}</span>
                  <span>Allocation {formatCurrency(paymentAllocationTotal)}</span>
                  <strong>{paymentAmountCents === allocationTotalCents ? 'Balanced' : 'Mismatch'}</strong>
                </div>

                <button className="primary-action" disabled={isSavingPayment}>
                  {isSavingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </form>
            )}

            {canViewPayments && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Received Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Reference No</th>
                      <th>Recorded By</th>
                      <th>Verified By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <Fragment key={payment.id}>
                        <tr>
                          <td>{payment.payment_date}</td>
                          <td>{payment.received_date ?? 'TBD'}</td>
                          <td>{formatStatus(payment.payment_method)}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>
                            <span className={`badge ${paymentStatusClass(payment.status)}`}>{formatStatus(payment.status)}</span>
                          </td>
                          <td>{payment.reference_no ?? 'TBD'}</td>
                          <td>{payment.recorded_by?.name ?? 'TBD'}</td>
                          <td>{payment.verified_by?.name ?? 'TBD'}</td>
                          <td>
                            <div className="payment-actions">
                              {canVerifyPayments && payment.status === 'pending_verification' && (
                                <button className="table-action" onClick={() => beginVerifyPayment(payment)}>
                                  Verify
                                </button>
                              )}
                              {canVoidPayments && payment.status !== 'voided' && (
                                <button className="table-action danger-action" onClick={() => beginVoidPayment(payment)}>
                                  Void
                                </button>
                              )}
                              {(!canVerifyPayments || payment.status !== 'pending_verification') &&
                                (!canVoidPayments || payment.status === 'voided') && <span className="permission-note">No action</span>}
                            </div>
                          </td>
                        </tr>
                        {payment.allocations.length > 0 && (
                          <tr className="payment-allocation-summary">
                            <td colSpan={9}>
                              Allocations:{' '}
                              {payment.allocations
                                .map((allocation) => `${allocation.fee_code ?? 'Manual'} ${allocation.description} ${formatCurrency(allocation.amount)}`)
                                .join(' / ')}
                            </td>
                          </tr>
                        )}
                        {verifyingPaymentId === payment.id && (
                          <tr className="payment-action-row">
                            <td colSpan={9}>
                              <form className="inline-payment-form" onSubmit={(event) => submitVerifyPayment(event, payment.id)}>
                                <label className="form-field">
                                  Received Date
                                  <input
                                    type="date"
                                    value={verifyForm.received_date}
                                    onChange={(event) => setVerifyForm((current) => ({ ...current, received_date: event.target.value }))}
                                  />
                                  {formatValidationError(verifyErrors, 'received_date') && (
                                    <small>{formatValidationError(verifyErrors, 'received_date')}</small>
                                  )}
                                </label>
                                <label className="form-field">
                                  Bank Account
                                  <input
                                    value={verifyForm.bank_account}
                                    onChange={(event) => setVerifyForm((current) => ({ ...current, bank_account: event.target.value }))}
                                  />
                                </label>
                                <label className="form-field">
                                  Reference No
                                  <input
                                    value={verifyForm.reference_no}
                                    onChange={(event) => setVerifyForm((current) => ({ ...current, reference_no: event.target.value }))}
                                  />
                                </label>
                                <label className="form-field wide">
                                  Remark
                                  <textarea
                                    value={verifyForm.remark}
                                    onChange={(event) => setVerifyForm((current) => ({ ...current, remark: event.target.value }))}
                                  />
                                  {formatValidationError(verifyErrors, 'payment') && (
                                    <small>{formatValidationError(verifyErrors, 'payment')}</small>
                                  )}
                                </label>
                                <div className="toolbar-actions">
                                  <button className="primary-action compact" disabled={isVerifyingPayment}>
                                    {isVerifyingPayment ? 'Verifying...' : 'Confirm Verify'}
                                  </button>
                                  <button type="button" className="secondary-action" onClick={() => setVerifyingPaymentId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                        {voidingPaymentId === payment.id && (
                          <tr className="payment-action-row">
                            <td colSpan={9}>
                              <form className="inline-payment-form" onSubmit={(event) => submitVoidPayment(event, payment.id)}>
                                <label className="form-field wide">
                                  Void Reason
                                  <textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
                                  {formatValidationError(voidErrors, 'void_reason') && (
                                    <small>{formatValidationError(voidErrors, 'void_reason')}</small>
                                  )}
                                  {formatValidationError(voidErrors, 'payment') && (
                                    <small>{formatValidationError(voidErrors, 'payment')}</small>
                                  )}
                                </label>
                                <div className="toolbar-actions">
                                  <button className="primary-action compact" disabled={isVoidingPayment}>
                                    {isVoidingPayment ? 'Voiding...' : 'Confirm Void'}
                                  </button>
                                  <button type="button" className="secondary-action" onClick={() => setVoidingPaymentId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {!isLoadingPayments && payments.length === 0 && (
                      <tr>
                        <td colSpan={9}>No payments recorded for this student yet.</td>
                      </tr>
                    )}
                    {isLoadingPayments && (
                      <tr>
                        <td colSpan={9}>Loading payments...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </article>
      )}
    </section>
  )
}

function ParentsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Parent module" title="Parent Contacts" />
      <section className="cards-grid">
        {parents.map((parent) => (
          <article className="contact-card" key={parent.email}>
            <div className="contact-avatar">{initials(parent.name)}</div>
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
              Parent module remains prototype
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
      <PageHeader eyebrow="Fee structure" title="Fee Agreement Foundation" />
      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {feeStructures.map((fee) => (
                <tr key={fee.item}>
                  <td>{fee.item}</td>
                  <td>{fee.type}</td>
                  <td>{fee.amount}</td>
                  <td>
                    <span className={`badge ${statusClass(fee.status)}`}>{fee.status}</span>
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

function PrototypePage({ title, label }: { title: string; label: string }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow={label} title={title} />
      <Message tone="info">This module is intentionally not implemented in this MVP phase.</Message>
    </section>
  )
}

function ReportsPage() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Reports" title="Basic Reports" />
      <section className="cards-grid report-grid">
        {reports.map((report) => (
          <article className="report-card" key={report.name}>
            <BarChart3 size={22} />
            <h3>{report.name}</h3>
            <p>
              {report.owner} / {report.period}
            </p>
            <strong>{report.output}</strong>
          </article>
        ))}
      </section>
    </section>
  )
}

function SettingsPage({ user }: { user: CurrentUser }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Settings" title="Users and Permissions" />
      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Current user</p>
              <h2>{user.name}</h2>
            </div>
            <Building2 size={22} />
          </div>
          <div className="rule-list">
            <div>
              Email <b>{user.email}</b>
            </div>
            <div>
              Roles <b>{user.roles.join(', ')}</b>
            </div>
            <div>
              School ID <b>{user.school_id ?? 'Global'}</b>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">RBAC</p>
              <h2>Permissions</h2>
            </div>
            <LockKeyhole size={22} />
          </div>
          <div className="permission-list">
            {user.permissions.map((permission) => (
              <span className="badge neutral" key={permission}>
                {permission}
              </span>
            ))}
          </div>
        </article>
      </section>
    </section>
  )
}

function DashboardPage({
  dashboard,
  setActivePage,
}: {
  dashboard: DashboardResponse
  setActivePage: (page: PageKey) => void
}) {
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
        value: 'TBD',
        tone: 'neutral',
      },
      {
        label: 'Active Students',
        value: String(dashboard.metrics.active_students),
        tone: 'neutral',
      },
    ],
    [dashboard],
  )

  return (
    <>
      <section className="hero-strip">
        <div>
          <p className="eyebrow">MVP phase</p>
          <h2>Authentication and Student Management are connected to the backend</h2>
          <p>Finance totals remain placeholders until Payment, Receipt and General Fee Record are approved.</p>
        </div>
        <button className="primary-action" onClick={() => setActivePage('students')}>
          <GraduationCap size={18} />
          Open Students
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
    </>
  )
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard)
  const [apiState, setApiState] = useState<'live' | 'demo' | 'loading'>('loading')
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authenticated'>('checking')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activePage, setActivePage] = useState<PageKey>('dashboard')

  const loadDashboard = async () => {
    try {
      const response = await apiRequest<DashboardResponse>('/dashboard/school?school_id=1&invoice_month=2026-07')
      setDashboard(response)
      setApiState('live')
    } catch {
      setDashboard(fallbackDashboard)
      setApiState('demo')
    }
  }

  const loadCurrentUser = async () => {
    setAuthState('checking')

    try {
      const response = await apiRequest<{ user: CurrentUser }>('/me')
      setUser(response.user)
      setAuthState('authenticated')
      void loadDashboard()
    } catch (currentUserError) {
      if (currentUserError instanceof ApiError && currentUserError.status !== 401) {
        setApiState('demo')
      }
      setUser(null)
      setAuthState('guest')
    }
  }

  useEffect(() => {
    void loadCurrentUser()
  }, [])

  const handleLogin = (loggedInUser: CurrentUser) => {
    setUser(loggedInUser)
    setAuthState('authenticated')
    void loadDashboard()
  }

  const handleLogout = async () => {
    try {
      await apiRequest<{ message: string }>('/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setAuthState('guest')
      setActivePage('dashboard')
    }
  }

  const handleUnauthorized = () => {
    setUser(null)
    setAuthState('guest')
  }

  const pageTitle = navItems.find((item) => item.key === activePage)?.label ?? 'Dashboard'

  if (authState === 'checking') {
    return (
      <main className="login-screen">
        <section className="login-card">
          <img src={misLogo} alt="MIS logo" />
          <p className="eyebrow">Matahari School ERP</p>
          <h1>Checking session...</h1>
        </section>
      </main>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  const renderPage = () => {
    if (activePage === 'students') {
      return <StudentsPage user={user} onUnauthorized={handleUnauthorized} />
    }

    if (activePage === 'parents') {
      return <ParentsPage />
    }

    if (activePage === 'fees') {
      return <FeesPage />
    }

    if (activePage === 'invoices') {
      return <PrototypePage label="Invoices" title="Invoice Module" />
    }

    if (activePage === 'payments') {
      return <PrototypePage label="Payments" title="Payment Module" />
    }

    if (activePage === 'receipts') {
      return <PrototypePage label="Receipts" title="Receipt Builder" />
    }

    if (activePage === 'reports') {
      return <ReportsPage />
    }

    if (activePage === 'settings') {
      return <SettingsPage user={user} />
    }

    return <DashboardPage dashboard={dashboard} setActivePage={setActivePage} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={misLogo} alt="MIS logo" />
          <div>
            <strong>MIS</strong>
            <span>School ERP</span>
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
            <p className="eyebrow">Matahari School ERP / {dashboard.school.name}</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className={`api-pill ${apiState}`}>{apiState === 'live' ? 'Live API' : 'Demo data'}</div>
            <label className="search-box">
              <Search size={17} />
              <input placeholder="Search is coming in the next frontend pass" />
            </label>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <div className="user-chip">
              <span>{initials(user.name)}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.roles.join(', ')}</small>
              </div>
            </div>
            <button className="icon-button" aria-label="Logout" onClick={() => void handleLogout()}>
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  )
}

export default App
