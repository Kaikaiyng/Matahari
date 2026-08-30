import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { ApiError, apiRequest } from './api'
import { productBrand } from './branding'
import { BrandMark } from './components/BrandMark'
import { AdminShell } from './components/AdminShell'
import type { NavigationGroup } from './components/AdminShell'
import { DeploymentBanner } from './components/DeploymentBanner'
import {
  IconlyDashboard,
  IconlyCalendar,
  IconlyGraduationCap,
  IconlyClasses,
  IconlyParents,
  IconlyFees,
  IconlyFeeRecord,
  IconlyAudit,
  IconlySettings,
  IconlyStaff,
} from './components/icons/IconlyIcons'
import { StaffPage } from './components/StaffPage'
import { ParentsPage } from './components/ParentsPage'
import { LoginPage } from './components/LoginPage'
import { SettingsPage as SettingsWorkspace } from './features/settings/SettingsPage'
import {
  CustomSelect,
  DatePicker,
  DataPanel,
  FieldError,
  FilterToolbar,
  ModalContextSummary,
  ModalFrame,
  PageHeader,
  SessionLoader,
  StatCard,
  StatusBadge,
  fieldErrorProps,
  focusFirstDialogError,
} from './components/AdminUi'
import type { UiTone } from './components/AdminUi'
import { CalendarPage } from './components/CalendarPage'
import { ClassesPage } from './components/ClassesPage'
import { SchedulePage } from './components/SchedulePage'
import type { SchoolClassOption } from './components/ClassesPage'
import {
  isFeeAgreementFormDirty,
  validateFeeAgreementBillingConfig,
} from './features/fee-agreements/feeAgreementEditorModel'
import { FeeAgreementEditor } from './features/fee-agreements/FeeAgreementEditor'
import { AuditTrailPage } from './features/audit/AuditTrailPage'
import { ApplicationLogsPage } from './features/logs/ApplicationLogsPage'
import { AttendanceHubPage } from './features/attendance/AttendanceHubPage'
import { UgcModerationPage } from './features/moderation/UgcModerationPage'
import { PaymentAllocationEditor } from './features/payments/PaymentAllocationEditor'
import { FeeCataloguePage } from './features/fees/FeeCataloguePage'
import type {
  FeeAgreement,
  FeeAgreementForm,
  FeeAgreementItemDraft,
  FeeItem,
  PaymentPlan,
  ValidationErrors,
} from './features/fee-agreements/types'
import {
  createChargeAllocation,
  createOneTimeChargeDraft,
  createUnclassifiedAllocation,
  feeRecordCategoryOptions,
  hasIncompleteUnclassifiedAllocation,
  type FeeRecordCategory,
  type OneTimeChargeDraft,
  type OutstandingChargeCell,
  type PaymentAllocationDraft,
} from './features/payments/paymentAllocationModel'
import './App.css'
import './PersonalAdminPattern.css'
import './AdminTypography.css'
import { useTenantConfiguration } from './tenant'

type PageKey =
  | 'dashboard'
  | 'calendar'
  | 'students'
  | 'classes'
  | 'schedule'
  | 'attendance'
  | 'parents'
  | 'employees'
  | 'fees'
  | 'fee-record'
  | 'audit'
  | 'application-logs'
  | 'moderation'
  | 'settings'

type CurrentUser = {
  id: number
  name: string
  username: string
  school_id: number | null
  is_platform_owner: boolean
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
  class_id: string
  gender: string
  dob: string
  registration_date: string
  status: StudentStatus
  notes: string
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
  paid_by: string | null
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
  issued_receipt: ReceiptSummary | null
  allocations: Array<{
    id: number
    fee_item_id: number | null
    fee_agreement_item_id: number | null
    fee_record_charge_id: number | null
    allocation_type: 'charge' | 'manual' | 'legacy' | null
    fee_code: string | null
    description: string
    amount: number
    sort_order: number
  }>
}

type FeeRecordPreviewCharge = {
  fee_agreement_id: number
  fee_agreement_item_id: number | null
  fee_item_id: number | null
  academic_year: string
  billing_month: string
  fee_record_category: string
  fee_code: string | null
  description: string
  expected_amount: number
  billing_status: string
  collection_status: string
  charge_origin: string
  source_type: string | null
  requires_preview_confirmation: boolean
  warning: string | null
}

type FeeRecordPreviewWarning = {
  fee_agreement_item_id: number
  fee_code: string | null
  description: string
  reason: string
  message: string
}

type FeeRecordPreviewResponse = {
  fee_agreement: {
    id: number
    academic_year: string
    payment_plan: PaymentPlan
    effective_from: string
    effective_to: string | null
  }
  needs_confirmation: boolean
  warnings: FeeRecordPreviewWarning[]
  charges: FeeRecordPreviewCharge[]
}

type FeeRecordSummaryRow = {
  student_id: number
  student_no: string
  student_name: string
  level_group: string
  class_name: string | null
  student_status: StudentStatus
  academic_year: string
  total_expected: number
  total_paid: number
  total_outstanding: number
  outstanding_months: string[]
  outstanding_categories: string[]
  latest_receipt_no: string | null
  latest_receipt_date: string | null
  collection_status_summary: 'paid' | 'partial' | 'unpaid' | 'no_charges'
}

type FeeRecordModuleView = 'summary' | 'category-monthly'

type FeeRecordMonthCell = {
  month: string
  month_number: number
  expected_amount: number
  paid_amount: number
  outstanding_amount: number
  collection_status: 'paid' | 'partial' | 'unpaid' | 'no_charge'
  receipt_refs: string[]
  charge_count: number
  raw_categories: string[]
  fee_codes: string[]
}

type FeeRecordCategoryMonthlyRow = {
  student_id: number
  student_no: string
  student_name: string
  level_group: string
  class_name: string | null
  student_status: StudentStatus
  academic_year: string
  category: FeeRecordCategory
  months: FeeRecordMonthCell[]
  total_expected: number
  total_paid: number
  total_outstanding: number
}

type ReceiptStatus = 'issued' | 'voided'

type ReceiptSummary = {
  id: number
  receipt_no: string
  receipt_date: string
  status: ReceiptStatus
}

type StudentReceipt = ReceiptSummary & {
  school_id: number
  payment_id: number
  active_payment_id: number | null
  student_id: number
  student_no: string
  student_name: string
  paid_by: string
  payment_method: PaymentMethod
  payment_date: string
  received_date: string | null
  amount: number
  amount_in_words: string
  issued_by: PaymentUser | null
  issued_at: string | null
  voided_by: PaymentUser | null
  voided_at: string | null
  void_reason: string | null
  items: Array<{
    id: number
    payment_allocation_id: number | null
    fee_code: string | null
    description: string
    amount: number
    sort_order: number
  }>
}

type PaymentForm = {
  academic_year: string
  payment_method: PaymentMethod
  payment_date: string
  received_date: string
  amount: string
  paid_by: string
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

const navGroups: NavigationGroup<PageKey>[] = [
  {
    label: 'Dashboard',
    icon: IconlyDashboard as any,
    standalone: true,
    items: [{ key: 'dashboard', label: 'Dashboard', icon: IconlyDashboard as any, requiredPermission: 'fee_record.view' }],
  },
  {
    label: 'Calendar',
    icon: IconlyCalendar as any,
    standalone: true,
    items: [{ key: 'calendar', label: 'Calendar', icon: IconlyCalendar as any, requiredPermission: 'calendar.view' }],
  },
  {
    label: 'Attendance',
    icon: ClipboardList,
    standalone: true,
    items: [{ key: 'attendance', label: 'Attendance', icon: ClipboardList, requiredPermission: 'attendance.view_school' }],
  },
  {
    label: 'People',
    icon: IconlyGraduationCap as any,
    items: [
      { key: 'students', label: 'Students', icon: IconlyGraduationCap as any, requiredPermission: 'students.view' },
      { key: 'classes', label: 'Classes', icon: IconlyClasses as any, requiredPermission: 'students.view' },
      { key: 'schedule', label: 'Schedule', icon: IconlyCalendar as any, requiredPermission: 'schedule.manage' },
      { key: 'parents', label: 'Parents', icon: IconlyParents as any, requiredPermission: 'parents.view' },
      { key: 'employees', label: 'Employees', icon: IconlyStaff as any, requiredPermission: 'foundation_accounts.manage' },
    ],
  },
  {
    label: 'Finance',
    icon: IconlyFees as any,
    items: [
      { key: 'fees', label: 'Fees', icon: IconlyFees as any, requiredPermission: 'fee_items.view' },
      { key: 'fee-record', label: 'Fee Record', icon: IconlyFeeRecord as any, requiredPermission: 'fee_record.view' },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck as any,
    items: [
      { key: 'moderation', label: 'Post Reports', icon: ShieldCheck as any, requiredPermission: 'community.moderate' },
    ],
  },
  {
    label: 'System',
    icon: IconlySettings as any,
    items: [
      { key: 'audit', label: 'Audit Trail', icon: IconlyAudit as any, requiredPermission: 'audit.view' },
      { key: 'application-logs', label: 'Application Logs', icon: FileText, requiredPermission: 'logs.view' },
      { key: 'settings', label: 'Settings', icon: IconlySettings as any, requiredPermission: 'foundation_accounts.manage' },
    ],
  },
]

const navItems = navGroups.flatMap((group) => group.items)

const emptyStudentForm: StudentForm = {
  student_no: '',
  full_name: '',
  level_group: 'primary',
  class_id: '',
  gender: 'male',
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

const monthShortLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLongLabels = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
    return 'Not set'
  }

  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('MYR', 'RM')
}

function formatBillingMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return month
  }

  return new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
  }).format(date)
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

function statusTone(status: string): UiTone {
  const normalized = status.toLowerCase().replaceAll('_', ' ')

  if (['active', 'paid', 'verified', 'issued', 'confirmed'].some((token) => normalized.includes(token))) {
    return 'positive'
  }

  if (['pending', 'partial', 'optional', 'graduate'].some((token) => normalized.includes(token))) {
    return 'warning'
  }

  if (['voided', 'withdraw', 'inactive', 'overdue', 'rejected', 'cancelled'].some((token) => normalized.includes(token))) {
    return 'danger'
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
  return user.is_platform_owner || user.permissions.includes(permission)
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

function moneyToCents(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value || 0)

  return Math.round(amount * 100)
}

function allocationTotal(allocations: PaymentAllocationDraft[]) {
  return allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
}

function defaultPaymentForm(currentFeeAgreement: FeeAgreement | null): PaymentForm {
  return {
    academic_year: currentFeeAgreement?.academic_year ?? '2026',
    payment_method: 'bank_transfer',
    payment_date: todayDate(),
    received_date: '',
    amount: '',
    paid_by: '',
    bank_account: '',
    reference_no: '',
    payment_proof: '',
    remark: '',
    allocations: [],
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
  const [year, month, day] = dateText.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function defaultBillingConfiguration(item: FeeItem): Pick<
  FeeAgreementItemDraft,
  'classification' | 'billing_frequency' | 'billing_months' | 'requires_preview_confirmation'
> {
  const oneTimeCodePattern = /(UNIFORM|BOOK|WORKSHEET|PE|APPLICATION|DEPOSIT|ENROL|OLD_BALANCE|OTHERS)/i
  const isOneTime = item.fee_type === 'one_time' || oneTimeCodePattern.test(item.code)
  const isCoreRecurring = ['TUITION', 'MISC', 'TRANSPORT', 'MEAL', 'MEAL_PLAN', 'HOSTEL', 'HIGH_SCOPE', 'HS'].includes(item.code)

  if (isOneTime) {
    return {
      classification: 'one_time',
      billing_frequency: 'one_time',
      billing_months: [],
      requires_preview_confirmation: true,
    }
  }

  return {
    classification: isCoreRecurring || item.category === 'mandatory' ? 'recurring' : 'optional_service',
    billing_frequency: 'monthly',
    billing_months: [],
    requires_preview_confirmation: false,
  }
}

function defaultAgreementForm(feeItems: FeeItem[]): FeeAgreementForm {
  return {
    academic_year: '2026',
    payment_plan: 'monthly',
    effective_from: todayDate(),
    effective_to: '',
    remarks: '',
    items: feeItems.map((item) => ({
      ...defaultBillingConfiguration(item),
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
  const paymentPlan: PaymentPlan =
    agreement.payment_plan === 'termly' || agreement.payment_plan === 'yearly'
      ? agreement.payment_plan
      : 'monthly'

  return {
    academic_year: agreement.academic_year,
    payment_plan: paymentPlan,
    effective_from: tomorrowAfter(agreement.effective_from),
    effective_to: '',
    remarks: agreement.remarks ?? '',
    items: feeItems.map((item) => {
      const agreementItem = agreementItemsByCode.get(item.code)
      const defaultConfig = defaultBillingConfiguration(item)

      return {
        fee_item_id: item.id,
        code: item.code,
        name: item.name,
        enabled: Boolean(agreementItem) || ['TUITION', 'MISC'].includes(item.code),
        amount: String(agreementItem?.amount ?? item.default_amount ?? ''),
        description: item.code === 'OTHERS' ? agreementItem?.description ?? '' : '',
        classification: agreementItem?.classification ?? defaultConfig.classification,
        billing_frequency: agreementItem?.billing_frequency ?? defaultConfig.billing_frequency,
        billing_months: agreementItem?.billing_months ?? defaultConfig.billing_months,
        requires_preview_confirmation: agreementItem?.requires_preview_confirmation ?? defaultConfig.requires_preview_confirmation,
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





function StudentsPage({
  user,
  onUnauthorized,
  initialStudentId,
  detailReturn,
}: {
  user: CurrentUser
  onUnauthorized: () => void
  initialStudentId?: number | null
  detailReturn?: {
    label: string
    onReturn: () => void
  }
}) {
  const tenant = useTenantConfiguration()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null)
  const initialStudentIdRef = useRef<number | null>(initialStudentId ?? null)
  const startedWithFocusedStudentRef = useRef(Boolean(initialStudentId))
  const [statusFilter, setStatusFilter] = useState<StudentFilter>('active')
  const [studentSearch, setStudentSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const createStudentIdRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<StudentForm>(emptyStudentForm)
  const [formErrors, setFormErrors] = useState<ValidationErrors>()
  const [statusDraft, setStatusDraft] = useState<StudentStatus>('active')
  const [feeItems, setFeeItems] = useState<FeeItem[]>([])
  const [feeAgreements, setFeeAgreements] = useState<FeeAgreement[]>([])
  const [feeAgreementMode, setFeeAgreementMode] = useState<'create' | 'supersede'>('create')
  const [showFeeAgreementForm, setShowFeeAgreementForm] = useState(false)
  const feeAgreementPaymentPlanRef = useRef<HTMLButtonElement>(null)
  const [feeAgreementForm, setFeeAgreementForm] = useState<FeeAgreementForm>(defaultAgreementForm([]))
  const [initialFeeAgreementForm, setInitialFeeAgreementForm] = useState<FeeAgreementForm>(
    defaultAgreementForm([]),
  )
  const [isLoadingFeeAgreementEditorData, setIsLoadingFeeAgreementEditorData] = useState(false)
  const [feeAgreementErrors, setFeeAgreementErrors] = useState<ValidationErrors>()
  const [isSavingFeeAgreement, setIsSavingFeeAgreement] = useState(false)
  const [payments, setPayments] = useState<StudentPayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [isSendingPaymentReminder, setIsSendingPaymentReminder] = useState(false)
  const [showPaymentReminderConfirm, setShowPaymentReminderConfirm] = useState(false)
  const paymentReminderCancelRef = useRef<HTMLButtonElement>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const paymentAmountRef = useRef<HTMLInputElement>(null)
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(defaultPaymentForm(null))
  const [paymentErrors, setPaymentErrors] = useState<ValidationErrors>()
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [showPaymentOneTimeCharge, setShowPaymentOneTimeCharge] = useState(false)
  const [paymentOneTimeCharge, setPaymentOneTimeCharge] = useState<OneTimeChargeDraft>(
    createOneTimeChargeDraft('2026'),
  )
  const [paymentOneTimeChargeErrors, setPaymentOneTimeChargeErrors] = useState<ValidationErrors>()
  const [paymentOneTimeChargeNotice, setPaymentOneTimeChargeNotice] = useState('')
  const [isSavingPaymentOneTimeCharge, setIsSavingPaymentOneTimeCharge] = useState(false)
  const [outstandingCharges, setOutstandingCharges] = useState<OutstandingChargeCell[]>([])
  const [outstandingChargesYear, setOutstandingChargesYear] = useState('')
  const [showOutstandingCharges, setShowOutstandingCharges] = useState(false)
  const [isLoadingOutstandingCharges, setIsLoadingOutstandingCharges] = useState(false)
  const [outstandingChargeError, setOutstandingChargeError] = useState('')
  const [studentListFeeRecordSummaries, setStudentListFeeRecordSummaries] = useState<FeeRecordSummaryRow[]>([])
  const [studentListFeeRecordSummaryYear, setStudentListFeeRecordSummaryYear] = useState('')
  const [isLoadingStudentListFeeRecordSummary, setIsLoadingStudentListFeeRecordSummary] = useState(false)
  const [studentFeePeriod, setStudentFeePeriod] = useState('')
  const [studentFeeRecordSummary, setStudentFeeRecordSummary] = useState<FeeRecordSummaryRow | null>(null)
  const [studentFeeRecordSummaryYear, setStudentFeeRecordSummaryYear] = useState('')
  const [isLoadingStudentFeeRecordSummary, setIsLoadingStudentFeeRecordSummary] = useState(false)
  const [studentFeeRecordSummaryError, setStudentFeeRecordSummaryError] = useState('')
  const [feeRecordAcademicYear, setFeeRecordAcademicYear] = useState('2026')
  const [feeRecordPreview, setFeeRecordPreview] = useState<FeeRecordPreviewResponse | null>(null)
  const [feeRecordPreviewError, setFeeRecordPreviewError] = useState('')
  const [isPreviewingFeeRecord, setIsPreviewingFeeRecord] = useState(false)
  const [isActivatingFeeRecord, setIsActivatingFeeRecord] = useState(false)
  const [showManualChargeForm, setShowManualChargeForm] = useState(false)
  const oneTimeChargeYearRef = useRef<HTMLInputElement>(null)
  const [manualChargeForm, setManualChargeForm] = useState<OneTimeChargeDraft>(createOneTimeChargeDraft('2026'))
  const [manualChargeErrors, setManualChargeErrors] = useState<ValidationErrors>()
  const [isSavingManualCharge, setIsSavingManualCharge] = useState(false)
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<number | null>(null)
  const verifyReceivedDateRef = useRef<HTMLButtonElement>(null)
  const [verifyForm, setVerifyForm] = useState<VerifyPaymentForm>(defaultVerifyForm())
  const [verifyErrors, setVerifyErrors] = useState<ValidationErrors>()
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null)
  const voidPaymentCancelRef = useRef<HTMLButtonElement>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidErrors, setVoidErrors] = useState<ValidationErrors>()
  const [isVoidingPayment, setIsVoidingPayment] = useState(false)
  const [receipts, setReceipts] = useState<StudentReceipt[]>([])
  const [, setIsLoadingReceipts] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<StudentReceipt | null>(null)
  const [printedAt, setPrintedAt] = useState('')
  const [generatingPaymentId, setGeneratingPaymentId] = useState<number | null>(null)
  const [generatePaidBy, setGeneratePaidBy] = useState('')
  const [generateErrors, setGenerateErrors] = useState<ValidationErrors>()
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false)
  const [voidingReceiptId, setVoidingReceiptId] = useState<number | null>(null)
  const voidReceiptCancelRef = useRef<HTMLButtonElement>(null)
  const [receiptVoidReason, setReceiptVoidReason] = useState('')
  const [receiptVoidErrors, setReceiptVoidErrors] = useState<ValidationErrors>()
  const [isVoidingReceipt, setIsVoidingReceipt] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canCreateStudents = hasPermission(user, 'students.create')
  const canUpdateStatus = hasPermission(user, 'students.update_status')
  const canCreateFeeAgreement = hasPermission(user, 'fee_agreements.create')
  const canUpdateFeeAgreement = hasPermission(user, 'fee_agreements.update')
  const canEditFeeAgreement = canCreateFeeAgreement || canUpdateFeeAgreement
  const canViewFeeRecord = hasPermission(user, 'fee_record.view')
  const canActivateFeeRecord = hasPermission(user, 'fee_record.generate')
  const canManageFeeRecord = hasPermission(user, 'fee_record.manage')
  const canViewPayments = hasPermission(user, 'payments.view')
  const canCreatePayments = hasPermission(user, 'payments.create')
  const canVerifyPayments = hasPermission(user, 'payments.verify')
  const canVoidPayments = hasPermission(user, 'payments.void')
  const canSendPaymentReminders = hasPermission(user, 'payment_reminders.send')
  const canViewReceipts = hasPermission(user, 'receipts.view')
  const canCreateReceipts = hasPermission(user, 'receipts.create')
  const canVoidReceipts = hasPermission(user, 'receipts.void')
  const canPrintReceipts = hasPermission(user, 'receipts.print')
  const currentFeeAgreement = feeAgreements.find((agreement) => agreement.is_current) ?? null
  const paymentAllocationTotal = allocationTotal(paymentForm.allocations)
  const paymentAmountCents = moneyToCents(paymentForm.amount)
  const allocationTotalCents = moneyToCents(paymentAllocationTotal)
  const paymentAdditionalErrorKeys = [
    'received_date',
    'paid_by',
    'bank_account',
    'reference_no',
    'payment_proof',
    'remark',
  ] as const
  const paymentAdditionalHasError = paymentAdditionalErrorKeys.some(
    (key) => Boolean(paymentErrors?.[key]?.length),
  )
  const paymentAdditionalHasValue = [
    paymentForm.received_date,
    paymentForm.paid_by,
    paymentForm.bank_account,
    paymentForm.reference_no,
    paymentForm.payment_proof,
    paymentForm.remark,
  ].some((value) => value.trim() !== '')
  const paymentDifferenceCents = paymentAmountCents - allocationTotalCents
  const paymentBalanceLabel =
    paymentAmountCents <= 0
      ? 'Amount remaining'
      : paymentDifferenceCents === 0
        ? 'Balanced'
        : paymentDifferenceCents > 0
          ? 'Amount remaining'
          : 'Over-allocated'
  const paymentCanSubmit =
    paymentAmountCents > 0 &&
    paymentForm.allocations.length > 0 &&
    paymentDifferenceCents === 0 &&
    !hasIncompleteUnclassifiedAllocation(paymentForm.allocations)
  const paymentToVerify =
    verifyingPaymentId === null
      ? null
      : payments.find((payment) => payment.id === verifyingPaymentId) ?? null
  const paymentToVoid =
    voidingPaymentId === null
      ? null
      : payments.find((payment) => payment.id === voidingPaymentId) ?? null
  const voidedReceipts = receipts.filter((receipt) => receipt.status === 'voided')
  const receiptToVoid =
    voidingReceiptId === null
      ? null
      : receipts.find((receipt) => receipt.id === voidingReceiptId) ?? null
  const paymentVoidBlocked = paymentToVoid?.issued_receipt?.status === 'issued'
  const previewBlockedByWarnings = Boolean(feeRecordPreview?.needs_confirmation || feeRecordPreview?.warnings.length)
  const canActivateCurrentPreview = Boolean(
    canActivateFeeRecord &&
      feeRecordPreview &&
      feeRecordPreview.charges.length > 0 &&
      !previewBlockedByWarnings,
  )
  const currentFeeRecordSummary =
    studentFeeRecordSummaryYear === feeRecordAcademicYear ? studentFeeRecordSummary : null
  const feeRecordIsActivated = currentFeeRecordSummary !== null
  const outstandingStatusLabel = isLoadingStudentFeeRecordSummary
    ? 'Loading charge status'
    : feeRecordIsActivated
      ? `${outstandingCharges.length} outstanding charge${outstandingCharges.length === 1 ? '' : 's'}`
      : 'Not activated'
  const studentListFeeRecordSummaryByStudentId = useMemo(() => {
    if (studentListFeeRecordSummaryYear !== feeRecordAcademicYear) {
      return new Map<number, FeeRecordSummaryRow>()
    }

    return new Map(studentListFeeRecordSummaries.map((summary) => [summary.student_id, summary]))
  }, [feeRecordAcademicYear, studentListFeeRecordSummaries, studentListFeeRecordSummaryYear])
  const studentListFeeTotals = useMemo(
    () =>
      students.reduce(
        (totals, student) => {
          const summary = studentListFeeRecordSummaryByStudentId.get(student.id)

          return {
            totalExpected: totals.totalExpected + (summary?.total_expected ?? 0),
            totalPaid: totals.totalPaid + (summary?.total_paid ?? 0),
            totalOutstanding: totals.totalOutstanding + (summary?.total_outstanding ?? 0),
          }
        },
        { totalExpected: 0, totalPaid: 0, totalOutstanding: 0 },
      ),
    [studentListFeeRecordSummaryByStudentId, students],
  )

  useEffect(() => {
    if (paymentAdditionalHasError || paymentAdditionalHasValue) {
      setPaymentDetailsOpen(true)
    }

    if (paymentAdditionalHasError) {
      focusFirstDialogError()
    }
  }, [paymentAdditionalHasError, paymentAdditionalHasValue])
  const visibleStudents = useMemo(() => {
    const needle = studentSearch.trim().toLowerCase()

    if (!needle) {
      return students
    }

    return students.filter((student) =>
      [student.full_name, student.student_no, student.class?.name ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    )
  }, [studentSearch, students])
  const groupedPreviewCharges = useMemo(() => {
    if (!feeRecordPreview) {
      return []
    }

    const groups = new Map<string, FeeRecordPreviewCharge[]>()

    feeRecordPreview.charges.forEach((charge) => {
      const key = `${charge.fee_code ?? 'Manual'}|${charge.description}|${charge.fee_record_category}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }

      groups.get(key)!.push(charge)
    })

    return Array.from(groups.entries()).map(([key, charges]) => {
      const [feeCode, description, category] = key.split('|')

      return {
        key,
        feeCode,
        description,
        category,
        charges: [...charges].sort((left, right) => left.billing_month.localeCompare(right.billing_month)),
      }
    })
  }, [feeRecordPreview])

  const handleApiError = (apiError: unknown) => {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized()
      return
    }

    setError(mapError(apiError))
  }

  const loadStudentListFeeRecordSummary = async (
    academicYear = feeRecordAcademicYear,
    billingMonth = studentFeePeriod,
  ) => {
    if (!canViewFeeRecord) {
      setStudentListFeeRecordSummaries([])
      setStudentListFeeRecordSummaryYear('')
      return
    }

    setIsLoadingStudentListFeeRecordSummary(true)
    setStudentListFeeRecordSummaries([])

    try {
      const params = new URLSearchParams({ academic_year: academicYear })
      if (billingMonth) params.set('billing_month', billingMonth)
      const response = await apiRequest<{ data: FeeRecordSummaryRow[] }>(`/fee-record/summary?${params.toString()}`)
      setStudentListFeeRecordSummaries(response.data)
      setStudentListFeeRecordSummaryYear(academicYear)
    } catch (summaryError) {
      setStudentListFeeRecordSummaries([])
      setStudentListFeeRecordSummaryYear('')
      handleApiError(summaryError)
    } finally {
      setIsLoadingStudentListFeeRecordSummary(false)
    }
  }

  const loadStudents = async (filter = statusFilter) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await apiRequest<{ data: StudentSummary[] }>(`/students?status=${filter}`)
      setStudents(response.data)
      await loadStudentListFeeRecordSummary(feeRecordAcademicYear, studentFeePeriod)
    } catch (loadError) {
      handleApiError(loadError)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSchoolClasses = async () => {
    try {
      const response = await apiRequest<{ data: SchoolClassOption[] }>('/classes')
      setSchoolClasses(response.data)
    } catch (loadError) {
      handleApiError(loadError)
    }
  }

  const loadStudentDetail = async (studentId: number) => {
    setError('')
    setShowOutstandingCharges(false)
    setIsLoadingFeeAgreementEditorData(true)
    setFeeItems([])
    setFeeAgreements([])

    try {
      const response = await apiRequest<{ student: StudentDetail }>(`/students/${studentId}`)
      setReceipts([])
      setSelectedReceipt(null)
      setIsLoadingReceipts(canViewReceipts)
      setStudentFeeRecordSummary(null)
      setStudentFeeRecordSummaryYear('')
      setStudentFeeRecordSummaryError('')
      setSelectedStudent(response.student)
      setStatusDraft(response.student.status)
      await loadFeeAgreementData(response.student.id)
      await loadPaymentData(response.student.id)
      await loadReceiptData(response.student.id)
    } catch (detailError) {
      setIsLoadingFeeAgreementEditorData(false)
      handleApiError(detailError)
    }
  }

  const loadFeeAgreementData = async (studentId: number) => {
    try {
      setIsLoadingFeeAgreementEditorData(true)
      const [agreementsResponse, itemsResponse] = await Promise.all([
        apiRequest<{ data: FeeAgreement[] }>(`/students/${studentId}/fee-agreements`),
        canEditFeeAgreement
          ? apiRequest<{ data: FeeItem[] }>('/fee-items')
          : Promise.resolve({ data: [] as FeeItem[] }),
      ])

      setFeeItems(itemsResponse.data)
      setFeeAgreementForm(defaultAgreementForm(itemsResponse.data))
      setFeeAgreements(agreementsResponse.data)
      setShowFeeAgreementForm(false)
      setFeeAgreementErrors(undefined)
      setFeeRecordPreview(null)
      setFeeRecordPreviewError('')
      setIsLoadingFeeAgreementEditorData(false)

      const activeAgreement = agreementsResponse.data.find((agreement) => agreement.is_current)

      if (activeAgreement) {
        setFeeRecordAcademicYear(activeAgreement.academic_year)
        setManualChargeForm(createOneTimeChargeDraft(activeAgreement.academic_year))
        setShowManualChargeForm(false)
        setManualChargeErrors(undefined)

        if (canViewFeeRecord) {
          await loadOutstandingCharges(studentId, activeAgreement.academic_year)
        } else {
          setOutstandingCharges([])
          setOutstandingChargesYear('')
          setStudentFeeRecordSummary(null)
          setStudentFeeRecordSummaryYear('')
          setStudentFeeRecordSummaryError('')
        }
      } else {
        setOutstandingCharges([])
        setOutstandingChargesYear('')
        setStudentFeeRecordSummary(null)
        setStudentFeeRecordSummaryYear('')
        setStudentFeeRecordSummaryError('')
        setManualChargeForm(createOneTimeChargeDraft('2026'))
        setShowManualChargeForm(false)
        setManualChargeErrors(undefined)
      }

    } catch (agreementError) {
      setIsLoadingFeeAgreementEditorData(false)
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

  const loadOutstandingCharges = async (studentId: number, academicYear: string) => {
    setIsLoadingOutstandingCharges(true)
    setOutstandingChargeError('')

    try {
      const response = await apiRequest<{ data: OutstandingChargeCell[] }>(
        `/students/${studentId}/fee-record/outstanding?academic_year=${academicYear}`,
      )
      setOutstandingCharges(response.data)
      setOutstandingChargesYear(academicYear)
      await loadStudentFeeRecordSummary(studentId, academicYear)
    } catch (chargeLoadError) {
      if (chargeLoadError instanceof ApiError && chargeLoadError.status === 403) {
        setOutstandingChargeError('You do not have permission to view Fee Record outstanding charges.')
      } else {
        setOutstandingChargeError(mapError(chargeLoadError))
      }
      setOutstandingCharges([])
      setOutstandingChargesYear('')
      handleApiError(chargeLoadError)
    } finally {
      setIsLoadingOutstandingCharges(false)
    }
  }

  const loadStudentFeeRecordSummary = async (studentId: number, academicYear: string) => {
    if (!canViewFeeRecord) {
      setStudentFeeRecordSummary(null)
      setStudentFeeRecordSummaryYear('')
      return
    }

    setIsLoadingStudentFeeRecordSummary(true)
    setStudentFeeRecordSummaryError('')

    try {
      const params = new URLSearchParams({ academic_year: academicYear })
      const response = await apiRequest<{ data: FeeRecordSummaryRow[] }>(`/fee-record/summary?${params.toString()}`)
      setStudentFeeRecordSummary(response.data.find((row) => row.student_id === studentId) ?? null)
      setStudentFeeRecordSummaryYear(academicYear)
      setStudentListFeeRecordSummaries(response.data)
      setStudentListFeeRecordSummaryYear(academicYear)
    } catch (summaryError) {
      setStudentFeeRecordSummary(null)
      setStudentFeeRecordSummaryYear('')
      setStudentFeeRecordSummaryError(mapError(summaryError))
      handleApiError(summaryError)
    } finally {
      setIsLoadingStudentFeeRecordSummary(false)
    }
  }

  const previewFeeRecordCharges = async () => {
    if (!selectedStudent) {
      return
    }

    setIsPreviewingFeeRecord(true)
    setFeeRecordPreviewError('')
    setFeeRecordPreview(null)
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<FeeRecordPreviewResponse>(
        `/students/${selectedStudent.id}/fee-record/preview?academic_year=${feeRecordAcademicYear}`,
      )
      setFeeRecordPreview(response)
      await loadOutstandingCharges(selectedStudent.id, feeRecordAcademicYear)
    } catch (previewError) {
      if (previewError instanceof ApiError && previewError.status === 403) {
        setFeeRecordPreviewError('You do not have permission to preview Fee Record charges.')
      } else {
        setFeeRecordPreviewError(mapError(previewError))
      }
      handleApiError(previewError)
    } finally {
      setIsPreviewingFeeRecord(false)
    }
  }

  const activateFeeRecordCharges = async () => {
    if (!selectedStudent || !feeRecordPreview || previewBlockedByWarnings) {
      return
    }

    setIsActivatingFeeRecord(true)
    setFeeRecordPreviewError('')
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{ created_count: number; data: OutstandingChargeCell[] }>(
        `/students/${selectedStudent.id}/fee-record/activate`,
        {
          method: 'POST',
          body: { academic_year: feeRecordAcademicYear },
        },
      )
      await loadOutstandingCharges(selectedStudent.id, feeRecordAcademicYear)
      setShowOutstandingCharges(true)
      setMessage(`Activated ${response.created_count} Fee Record charge cells.`)
    } catch (activateError) {
      if (activateError instanceof ApiError && activateError.status === 422) {
        setFeeRecordPreviewError(
          formatValidationError(activateError.errors, 'fee_record') ||
            formatValidationError(activateError.errors, 'academic_year') ||
            activateError.message,
        )
      } else if (activateError instanceof ApiError && activateError.status === 403) {
        setFeeRecordPreviewError('You do not have permission to activate Fee Record charges.')
      } else {
        setFeeRecordPreviewError(mapError(activateError))
      }
      handleApiError(activateError)
    } finally {
      setIsActivatingFeeRecord(false)
    }
  }

  const updateManualChargeForm = (field: keyof OneTimeChargeDraft, value: string) => {
    setManualChargeForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'academic_year' && /^\d{4}$/.test(value)
        ? { billing_month: `${value}-${current.billing_month.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')}` }
        : {}),
    }))
  }

  const submitManualCharge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedStudent) {
      return
    }

    setIsSavingManualCharge(true)
    setManualChargeErrors(undefined)
    setFeeRecordPreviewError('')
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{ data: OutstandingChargeCell }>(
        `/students/${selectedStudent.id}/fee-record/manual-charges`,
        {
          method: 'POST',
          body: {
            academic_year: manualChargeForm.academic_year,
            billing_month: manualChargeForm.billing_month,
            fee_record_category: manualChargeForm.fee_record_category,
            description: manualChargeForm.description,
            expected_amount: Number(manualChargeForm.expected_amount || 0),
            remark: manualChargeForm.remark || null,
          },
        },
      )

      setShowManualChargeForm(false)
      setManualChargeForm(createOneTimeChargeDraft(manualChargeForm.academic_year))
      await loadOutstandingCharges(selectedStudent.id, response.data.academic_year)
      setMessage(`Added manual charge ${response.data.description} for ${formatCurrency(response.data.expected_amount)}.`)
    } catch (manualChargeError) {
      if (manualChargeError instanceof ApiError && manualChargeError.status === 422) {
        setManualChargeErrors(manualChargeError.errors)
        focusFirstDialogError()
      } else if (manualChargeError instanceof ApiError && manualChargeError.status === 403) {
        setFeeRecordPreviewError('You do not have permission to add manual Fee Record charges.')
      }
      handleApiError(manualChargeError)
    } finally {
      setIsSavingManualCharge(false)
    }
  }

  const loadReceiptData = async (studentId: number) => {
    if (!canViewReceipts) {
      setReceipts([])
      setSelectedReceipt(null)
      setIsLoadingReceipts(false)
      return
    }

    setIsLoadingReceipts(true)

    try {
      const response = await apiRequest<{ data: StudentReceipt[] }>(`/students/${studentId}/receipts`)
      setReceipts(response.data)
    } catch (receiptLoadError) {
      handleApiError(receiptLoadError)
    } finally {
      setIsLoadingReceipts(false)
    }
  }

  const loadStudentsRef = useRef(loadStudents)
  const loadSchoolClassesRef = useRef(loadSchoolClasses)
  const loadStudentDetailRef = useRef(loadStudentDetail)
  loadStudentsRef.current = loadStudents
  loadSchoolClassesRef.current = loadSchoolClasses
  loadStudentDetailRef.current = loadStudentDetail

  useEffect(() => {
    void loadSchoolClassesRef.current()
    const studentId = initialStudentIdRef.current

    if (studentId) {
      initialStudentIdRef.current = null
      void loadStudentDetailRef.current(studentId)
      return
    }

    if (startedWithFocusedStudentRef.current) {
      return
    }

    void loadStudentsRef.current(statusFilter)
  }, [statusFilter])

  const updateForm = (field: keyof StudentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateStudentLevelGroup = (levelGroup: LevelGroup) => {
    setForm((current) => ({ ...current, level_group: levelGroup, class_id: '' }))
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
      class_id: Number(form.class_id),
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
        focusFirstDialogError()
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

  const openFeeAgreementEditor = (
    mode: 'create' | 'supersede',
    nextForm: FeeAgreementForm,
  ) => {
    setFeeAgreementMode(mode)
    setFeeAgreementForm(nextForm)
    setInitialFeeAgreementForm(structuredClone(nextForm))
    setFeeAgreementErrors(undefined)
    setShowFeeAgreementForm(true)
  }

  const closeFeeAgreementEditor = (force = false) => {
    if (
      !force &&
      isFeeAgreementFormDirty(feeAgreementForm, initialFeeAgreementForm) &&
      !window.confirm('Discard your unsaved Fee Agreement changes?')
    ) {
      return
    }

    setShowFeeAgreementForm(false)
    setFeeAgreementErrors(undefined)
  }

  const beginCreateFeeAgreement = () => {
    openFeeAgreementEditor('create', defaultAgreementForm(feeItems))
  }

  const beginSupersedeFeeAgreement = () => {
    if (!currentFeeAgreement) {
      return
    }

    openFeeAgreementEditor('supersede', agreementToForm(currentFeeAgreement, feeItems))
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

    const enabledItems = feeAgreementForm.items.filter((item) => item.enabled)
    const billingErrors = validateFeeAgreementBillingConfig(enabledItems)

    if (Object.keys(billingErrors).length > 0) {
      setFeeAgreementErrors(billingErrors)
      setIsSavingFeeAgreement(false)
      return
    }

    const items = enabledItems
      .map((item) => ({
        fee_item_id: item.fee_item_id,
        amount: Number(item.amount || 0),
        description: item.code === 'OTHERS' ? item.description : item.description || undefined,
        classification: item.classification,
        billing_frequency: item.billing_frequency,
        billing_months: item.billing_months.length > 0 ? item.billing_months : null,
        requires_preview_confirmation: item.requires_preview_confirmation,
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
      closeFeeAgreementEditor(true)
      setMessage(
        feeAgreementMode === 'create'
          ? `Created Fee Agreement v${response.fee_agreement.version_no}.`
          : `Superseded Fee Agreement with v${response.fee_agreement.version_no}.`,
      )
    } catch (agreementError) {
      if (agreementError instanceof ApiError && agreementError.status === 422) {
        setFeeAgreementErrors(agreementError.errors)
        const firstErrorKey = Object.keys(agreementError.errors ?? {})[0] ?? ''
        if (!/^items\.\d+\./.test(firstErrorKey) && !firstErrorKey.startsWith('discounts.')) {
          focusFirstDialogError()
        }
      }
      handleApiError(agreementError)
    } finally {
      setIsSavingFeeAgreement(false)
    }
  }

  const beginCreatePayment = () => {
    const nextForm = defaultPaymentForm(currentFeeAgreement)
    setPaymentForm(nextForm)
    setPaymentErrors(undefined)
    setPaymentDetailsOpen(false)
    setShowPaymentOneTimeCharge(false)
    setPaymentOneTimeCharge(createOneTimeChargeDraft(nextForm.academic_year))
    setPaymentOneTimeChargeErrors(undefined)
    setPaymentOneTimeChargeNotice('')
    setOutstandingCharges([])
    setOutstandingChargeError('')
    setShowPaymentForm(true)

    if (selectedStudent) {
      void loadOutstandingCharges(selectedStudent.id, nextForm.academic_year)
    }
  }

  const sendPaymentReminder = async () => {
    if (!selectedStudent || !canSendPaymentReminders) return

    setIsSendingPaymentReminder(true)
    setError('')
    setMessage('')
    try {
      const response = await apiRequest<{ data: { recipient_count: number } }>(
        `/students/${selectedStudent.id}/payment-reminders`,
        { method: 'POST' },
      )
      setMessage(`Payment reminder sent to ${response.data.recipient_count} parent account${response.data.recipient_count === 1 ? '' : 's'}.`)
    } catch (reminderError) {
      handleApiError(reminderError)
    } finally {
      setIsSendingPaymentReminder(false)
    }
  }

  const updatePaymentForm = (field: keyof Omit<PaymentForm, 'allocations'>, value: string) => {
    setPaymentForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'academic_year' ? { allocations: current.allocations.filter((allocation) => allocation.allocation_type === 'manual') } : {}),
    }))

    if (field === 'academic_year' && selectedStudent) {
      setShowPaymentOneTimeCharge(false)
      setPaymentOneTimeCharge(createOneTimeChargeDraft(value))
      setPaymentOneTimeChargeErrors(undefined)
      setPaymentOneTimeChargeNotice('')
      void loadOutstandingCharges(selectedStudent.id, value)
    }
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
      ...(field === 'amount'
        ? {
            amount: String(
              allocationTotal(
                current.allocations.map((allocation) =>
                  allocation.key === key
                    ? {
                        ...allocation,
                        amount: value,
                      }
                    : allocation,
                ),
              ),
            ),
          }
        : {}),
    }))
  }

  const selectChargeAllocation = (charge: OutstandingChargeCell) => {
    setPaymentForm((current) => ({
      ...current,
      allocations: [...current.allocations, createChargeAllocation(charge)],
      amount: String(allocationTotal(current.allocations) + charge.outstanding_amount),
    }))
  }

  const addUnclassifiedPaymentAllocation = () => {
    setPaymentForm((current) => {
      if (hasIncompleteUnclassifiedAllocation(current.allocations)) {
        return current
      }

      return {
        ...current,
        allocations: [...current.allocations, createUnclassifiedAllocation()],
      }
    })
  }

  const removePaymentAllocation = (key: string) => {
    setPaymentForm((current) => ({
      ...current,
      allocations: current.allocations.filter((allocation) => allocation.key !== key),
      amount: String(allocationTotal(current.allocations.filter((allocation) => allocation.key !== key)) || ''),
    }))
  }

  const updatePaymentOneTimeCharge = (field: keyof OneTimeChargeDraft, value: string) => {
    setPaymentOneTimeCharge((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const submitPaymentOneTimeCharge = async () => {
    if (!selectedStudent || !canManageFeeRecord) {
      return
    }

    setIsSavingPaymentOneTimeCharge(true)
    setPaymentOneTimeChargeErrors(undefined)
    setPaymentOneTimeChargeNotice('')
    setError('')

    try {
      const response = await apiRequest<{ data: OutstandingChargeCell }>(
        `/students/${selectedStudent.id}/fee-record/manual-charges`,
        {
          method: 'POST',
          body: {
            academic_year: paymentForm.academic_year,
            billing_month: paymentOneTimeCharge.billing_month,
            fee_record_category: paymentOneTimeCharge.fee_record_category,
            description: paymentOneTimeCharge.description,
            expected_amount: Number(paymentOneTimeCharge.expected_amount || 0),
            remark: paymentOneTimeCharge.remark || null,
          },
        },
      )

      setPaymentForm((current) => ({
        ...current,
        allocations: [...current.allocations, createChargeAllocation(response.data)],
        amount: String(allocationTotal(current.allocations) + response.data.outstanding_amount),
      }))
      setShowPaymentOneTimeCharge(false)
      setPaymentOneTimeCharge(createOneTimeChargeDraft(paymentForm.academic_year))
      setPaymentOneTimeChargeNotice('Charge added and selected for this payment.')
      await loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
    } catch (chargeError) {
      if (chargeError instanceof ApiError && chargeError.status === 422) {
        setPaymentOneTimeChargeErrors(chargeError.errors)
        focusFirstDialogError()
      } else {
        handleApiError(chargeError)
      }
    } finally {
      setIsSavingPaymentOneTimeCharge(false)
    }
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
      const allocationAmountCents = moneyToCents(allocation.amount)

      if (allocationAmountCents <= 0) {
        nextErrors[`allocations.${index}.amount`] = ['Allocation amount must be more than zero.']
      }

      if (
        allocation.allocation_type === 'charge' &&
        allocation.outstanding_amount !== null &&
        allocationAmountCents > moneyToCents(allocation.outstanding_amount)
      ) {
        nextErrors[`allocations.${index}.amount`] = ['Allocation amount cannot exceed outstanding amount.']
      }

      if (allocation.allocation_type === 'manual' && !allocation.description.trim()) {
        nextErrors[`allocations.${index}.description`] = ['Manual allocation rows require a description.']
      }
    })

    setPaymentErrors(Object.keys(nextErrors).length > 0 ? nextErrors : undefined)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstDialogError()
    }

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
          paid_by: paymentForm.paid_by || null,
          bank_account: paymentForm.bank_account || null,
          reference_no: paymentForm.reference_no || null,
          payment_proof: paymentForm.payment_proof || null,
          remark: paymentForm.remark || null,
          allocations: paymentForm.allocations.map((allocation) => ({
            allocation_type: allocation.allocation_type,
            fee_record_charge_id: allocation.fee_record_charge_id,
            fee_item_id: allocation.allocation_type === 'manual' ? null : allocation.fee_item_id,
            fee_agreement_item_id: allocation.allocation_type === 'manual' ? null : allocation.fee_agreement_item_id,
            description: allocation.description || null,
            amount: Number(allocation.amount || 0),
          })),
        },
      })
      setShowPaymentForm(false)
      setPaymentForm(defaultPaymentForm(currentFeeAgreement))
      setPaymentErrors(undefined)
      await loadPaymentData(selectedStudent.id)
      await loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
      setMessage(
        paymentForm.payment_method === 'cash'
          ? 'Cash payment recorded as verified.'
          : 'Payment recorded and pending finance verification.',
      )
    } catch (paymentError) {
      if (paymentError instanceof ApiError && paymentError.status === 422) {
        setPaymentErrors(paymentError.errors)
        focusFirstDialogError()
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
      await loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
      setMessage('Payment verified.')
    } catch (verifyError) {
      if (verifyError instanceof ApiError && verifyError.status === 422) {
        setVerifyErrors(verifyError.errors)
        focusFirstDialogError()
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
      await loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
      setMessage('Payment voided.')
    } catch (voidError) {
      if (voidError instanceof ApiError && voidError.status === 422) {
        setVoidErrors(voidError.errors)
        focusFirstDialogError()
        setError(formatValidationError(voidError.errors, 'payment') ?? voidError.message)
        return
      }
      handleApiError(voidError)
    } finally {
      setIsVoidingPayment(false)
    }
  }

  const refreshReceiptRelatedData = async () => {
    if (!selectedStudent) {
      return
    }

    await loadPaymentData(selectedStudent.id)
    await loadReceiptData(selectedStudent.id)
  }

  const beginGenerateReceipt = (payment: StudentPayment) => {
    setGenerateErrors(undefined)
    setError('')
    setMessage('')
    setVerifyingPaymentId(null)
    setVoidingPaymentId(null)
    setVoidingReceiptId(null)

    if (payment.paid_by?.trim()) {
      void submitGenerateReceipt(payment.id)
      return
    }

    setGeneratingPaymentId(payment.id)
    setGeneratePaidBy('')
  }

  const submitGenerateReceipt = async (paymentId: number, paidBy = '') => {
    if (!selectedStudent) {
      return
    }

    setIsGeneratingReceipt(true)
    setGenerateErrors(undefined)
    setError('')
    setMessage('')

    try {
      const body = paidBy.trim() ? { paid_by: paidBy.trim() } : undefined
      const response = await apiRequest<{ receipt: StudentReceipt }>(`/payments/${paymentId}/receipts`, {
        method: 'POST',
        body,
      })

      setSelectedReceipt(response.receipt)
      setPrintedAt(new Date().toLocaleString())
      setGeneratingPaymentId(null)
      setGeneratePaidBy('')
      await refreshReceiptRelatedData()
      setMessage(`Receipt ${response.receipt.receipt_no} generated.`)
    } catch (generateError) {
      if (generateError instanceof ApiError && generateError.status === 422) {
        setGenerateErrors(generateError.errors)
      }
      handleApiError(generateError)
    } finally {
      setIsGeneratingReceipt(false)
    }
  }

  const submitGenerateReceiptWithPaidBy = async (event: FormEvent<HTMLFormElement>, paymentId: number) => {
    event.preventDefault()
    await submitGenerateReceipt(paymentId, generatePaidBy)
  }

  const viewReceipt = async (receiptId: number) => {
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{ receipt: StudentReceipt }>(`/receipts/${receiptId}`)
      setSelectedReceipt(response.receipt)
      setPrintedAt(new Date().toLocaleString())
    } catch (viewError) {
      handleApiError(viewError)
    }
  }

  const printReceipt = async (receiptId: number) => {
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{ receipt: StudentReceipt }>(`/receipts/${receiptId}/print`)
      setSelectedReceipt(response.receipt)
      setPrintedAt(new Date().toLocaleString())
      window.setTimeout(() => window.print(), 100)
    } catch (printError) {
      handleApiError(printError)
    }
  }

  const beginVoidReceipt = (receiptId: number) => {
    setVoidingReceiptId(receiptId)
    setReceiptVoidReason('')
    setReceiptVoidErrors(undefined)
    setGeneratingPaymentId(null)
  }

  const submitVoidReceipt = async (event: FormEvent<HTMLFormElement>, receiptId: number) => {
    event.preventDefault()

    setIsVoidingReceipt(true)
    setReceiptVoidErrors(undefined)
    setError('')
    setMessage('')

    try {
      const response = await apiRequest<{ receipt: StudentReceipt }>(`/receipts/${receiptId}/void`, {
        method: 'POST',
        body: {
          void_reason: receiptVoidReason,
        },
      })

      setSelectedReceipt(response.receipt)
      setPrintedAt(new Date().toLocaleString())
      setVoidingReceiptId(null)
      setReceiptVoidReason('')
      await refreshReceiptRelatedData()
      setMessage(`Receipt ${response.receipt.receipt_no} voided.`)
    } catch (voidReceiptError) {
      if (voidReceiptError instanceof ApiError && voidReceiptError.status === 422) {
        setReceiptVoidErrors(voidReceiptError.errors)
        focusFirstDialogError()
      }
      handleApiError(voidReceiptError)
    } finally {
      setIsVoidingReceipt(false)
    }
  }

  const paymentPostAllocation = (
    <div className="payment-post-allocation">
      <section
        className={`payment-balance-summary payment-balance-summary--${paymentBalanceLabel
          .toLowerCase()
          .replace(/\s+/g, '-')}`}
        aria-live="polite"
        aria-label="Payment balance"
      >
        <span>Payment {formatCurrency(Number(paymentForm.amount || 0))}</span>
        <span>Allocation {formatCurrency(paymentAllocationTotal)}</span>
        <strong>{paymentBalanceLabel}</strong>
        {paymentDifferenceCents !== 0 && (
          <small>{formatCurrency(Math.abs(paymentDifferenceCents) / 100)}</small>
        )}
      </section>

      <details
        className="payment-additional-details"
        open={paymentDetailsOpen}
        onToggle={(event) => setPaymentDetailsOpen(event.currentTarget.open)}
      >
        <summary>Additional payment details</summary>
        <div className="payment-additional-grid">
          {paymentForm.payment_method !== 'cash' && (
            <label className="form-field">
              Received Date
              <DatePicker
                value={paymentForm.received_date}
                onChange={(value) => updatePaymentForm('received_date', value)}
                ariaLabel="Received Date"
                {...fieldErrorProps(
                  'record-payment-received-date-error',
                  formatValidationError(paymentErrors, 'received_date'),
                )}
              />
              <FieldError
                id="record-payment-received-date-error"
                message={formatValidationError(paymentErrors, 'received_date')}
              />
            </label>
          )}
          <label className="form-field">
            Paid By
            <input
              value={paymentForm.paid_by}
              onChange={(event) => updatePaymentForm('paid_by', event.target.value)}
              {...fieldErrorProps(
                'record-payment-paid-by-error',
                formatValidationError(paymentErrors, 'paid_by'),
              )}
            />
            <FieldError
              id="record-payment-paid-by-error"
              message={formatValidationError(paymentErrors, 'paid_by')}
            />
          </label>
          <label className="form-field">
            Bank Account
            <input
              value={paymentForm.bank_account}
              onChange={(event) => updatePaymentForm('bank_account', event.target.value)}
              {...fieldErrorProps(
                'record-payment-bank-account-error',
                formatValidationError(paymentErrors, 'bank_account'),
              )}
            />
            <FieldError
              id="record-payment-bank-account-error"
              message={formatValidationError(paymentErrors, 'bank_account')}
            />
          </label>
          <label className="form-field">
            Reference No
            <input
              aria-label="Reference No"
              value={paymentForm.reference_no}
              onChange={(event) => updatePaymentForm('reference_no', event.target.value)}
              {...fieldErrorProps(
                'record-payment-reference-no-error',
                formatValidationError(paymentErrors, 'reference_no'),
              )}
            />
            <FieldError
              id="record-payment-reference-no-error"
              message={formatValidationError(paymentErrors, 'reference_no')}
            />
          </label>
          <label className="form-field wide">
            Payment Proof Text / Reference
            <textarea
              value={paymentForm.payment_proof}
              onChange={(event) => updatePaymentForm('payment_proof', event.target.value)}
              {...fieldErrorProps(
                'record-payment-proof-error',
                formatValidationError(paymentErrors, 'payment_proof'),
              )}
            />
            <FieldError
              id="record-payment-proof-error"
              message={formatValidationError(paymentErrors, 'payment_proof')}
            />
          </label>
          <label className="form-field wide">
            Remark
            <textarea
              value={paymentForm.remark}
              onChange={(event) => updatePaymentForm('remark', event.target.value)}
              {...fieldErrorProps(
                'record-payment-remark-error',
                formatValidationError(paymentErrors, 'remark'),
              )}
            />
            <FieldError
              id="record-payment-remark-error"
              message={formatValidationError(paymentErrors, 'remark')}
            />
          </label>
        </div>
      </details>
    </div>
  )

  return (
    <section className="page-stack">
      {error && <Message tone="error">{error}</Message>}
      {message && <Message tone="success">{message}</Message>}

      {!selectedStudent && (
        <>
          <PageHeader
            eyebrow="People"
            title="Students"
            description="Manage profiles, enrolment status, and fee visibility."
            action={
              canCreateStudents ? (
                <button className="primary-action compact" onClick={() => setShowCreateForm(true)}>
                  <UserPlus size={18} />
                  Add Student
                </button>
              ) : (
                <span className="permission-note">View only</span>
              )
            }
          />

          <section className="stats-grid three" aria-label="Student metrics">
            <StatCard label="Visible Students" value={visibleStudents.length} tone="positive" icon={<Users size={20} />} />
            <StatCard
              label="Status Filter"
              value={statusOptions.find((option) => option.value === statusFilter)?.label ?? 'All'}
            />
            <StatCard
              label="Paid / Total Fees"
              value={
                !canViewFeeRecord
                  ? 'No access'
                  : isLoadingStudentListFeeRecordSummary
                    ? 'Loading...'
                    : `${formatCurrency(studentListFeeTotals.totalPaid)} / ${formatCurrency(
                        studentListFeeTotals.totalExpected,
                      )}`
              }
            />
          </section>

      {showCreateForm && canCreateStudents && (
        <ModalFrame
          title="Create Student Profile"
          description="Add enrolment and profile details."
          size="standard"
          placement="drawer"
          initialFocusRef={createStudentIdRef}
          onClose={() => setShowCreateForm(false)}
          footer={
            <>
              <button type="button" className="secondary-action" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button
                className="primary-action compact"
                type="submit"
                form="create-student-form"
                disabled={isCreating}
              >
                <UserPlus size={18} />
                {isCreating ? 'Creating...' : 'Create Student'}
              </button>
            </>
          }
        >
          <form id="create-student-form" className="form-grid student-form" onSubmit={submitStudent}>
            <label className="form-field">
              Student ID
              <input
                ref={createStudentIdRef}
                aria-label="Student ID"
                value={form.student_no}
                onChange={(event) => updateForm('student_no', event.target.value)}
                {...fieldErrorProps(
                  'create-student-student-no-error',
                  formatValidationError(formErrors, 'student_no'),
                )}
              />
              <FieldError
                id="create-student-student-no-error"
                message={formatValidationError(formErrors, 'student_no')}
              />
            </label>

            <label className="form-field">
              Student Name
              <input
                aria-label="Student Name"
                value={form.full_name}
                onChange={(event) => updateForm('full_name', event.target.value)}
                {...fieldErrorProps(
                  'create-student-full-name-error',
                  formatValidationError(formErrors, 'full_name'),
                )}
              />
              <FieldError
                id="create-student-full-name-error"
                message={formatValidationError(formErrors, 'full_name')}
              />
            </label>

            <label className="form-field">
              Level Group
              <CustomSelect
                ariaLabel="Level Group"
                value={form.level_group}
                onChange={(value) => updateStudentLevelGroup(value as LevelGroup)}
                options={levelGroupOptions}
                {...fieldErrorProps(
                  'create-student-level-group-error',
                  formatValidationError(formErrors, 'level_group'),
                )}
              />
              <FieldError
                id="create-student-level-group-error"
                message={formatValidationError(formErrors, 'level_group')}
              />
            </label>

            <label className="form-field">
              Class
              <CustomSelect
                ariaLabel="Class"
                value={form.class_id}
                onChange={(value) => updateForm('class_id', value)}
                options={[
                  { value: '', label: 'Select class' },
                  ...schoolClasses
                    .filter((schoolClass) => schoolClass.level_group === form.level_group)
                    .map((schoolClass) => ({ value: String(schoolClass.id), label: schoolClass.name })),
                ]}
                {...fieldErrorProps(
                  'create-student-class-id-error',
                  formatValidationError(formErrors, 'class_id'),
                )}
              />
              <FieldError
                id="create-student-class-id-error"
                message={formatValidationError(formErrors, 'class_id')}
              />
            </label>

            <label className="form-field">
              Initial Status
              <CustomSelect ariaLabel="Initial Status" value={form.status} onChange={(value) => updateForm('status', value)} options={statusOptions.filter((option) => option.value !== 'all')} />
            </label>

            <label className="form-field">
              Gender
              <CustomSelect ariaLabel="Gender" value={form.gender} onChange={(value) => updateForm('gender', value)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            </label>

            <label className="form-field">
              Date of Birth
              <DatePicker value={form.dob} onChange={(value) => updateForm('dob', value)} placeholder="Select date of birth" ariaLabel="Date of Birth" />
            </label>

            <label className="form-field">
              Registration Date
              <DatePicker value={form.registration_date} onChange={(value) => updateForm('registration_date', value)} placeholder="Select registration date" ariaLabel="Registration Date" />
            </label>

            <label className="form-field wide">
              Remarks
              <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
            </label>
          </form>
        </ModalFrame>
      )}

          <FilterToolbar ariaLabel="Student filters">
            <div className="toolbar-search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search students"
                placeholder="Search student name or ID"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>
            <CustomSelect
              ariaLabel="Student status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StudentFilter)}
              options={statusOptions}
            />
            <CustomSelect
              className="fee-period-select"
              ariaLabel="Fee Period"
              value={studentFeePeriod}
              onChange={(nextPeriod) => {
                setStudentFeePeriod(String(nextPeriod))
                void loadStudentListFeeRecordSummary(feeRecordAcademicYear, String(nextPeriod))
              }}
              options={[
                { value: '', label: `All Year (${feeRecordAcademicYear})` },
                ...monthLongLabels.map((month, index) => {
                  const monthNumber = String(index + 1).padStart(2, '0')
                  return {
                    value: `${feeRecordAcademicYear}-${monthNumber}`,
                    label: `${month} ${feeRecordAcademicYear}`,
                  }
                }),
              ]}
            />
            <button className="secondary-action" onClick={() => void loadStudents()}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </FilterToolbar>

          <DataPanel eyebrow="Operational list" title="Student List">
            <div className="table-wrap">
          <table className="student-list-table">
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
              {visibleStudents.map((student) => {
                const summary = studentListFeeRecordSummaryByStudentId.get(student.id)
                const feeAmount = isLoadingStudentListFeeRecordSummary
                  ? 'Loading...'
                  : formatCurrency(summary?.total_expected ?? 0)
                const outstandingAmount = isLoadingStudentListFeeRecordSummary
                  ? 'Loading...'
                  : formatCurrency(summary?.total_outstanding ?? 0)

                return (
                  <tr key={student.id}>
                    <td className="student-primary-cell" data-label="Student Name">{student.full_name}</td>
                    <td data-label="Student ID">{student.student_no}</td>
                    <td data-label="Class">{student.class?.name ?? formatLevelGroup(student.level_group)}</td>
                    <td className="student-secondary-cell" data-label="Fee Amount">{canViewFeeRecord ? feeAmount : 'No access'}</td>
                    <td className="student-secondary-cell" data-label="Outstanding">{canViewFeeRecord ? outstandingAmount : 'No access'}</td>
                    <td data-label="Status">
                      <StatusBadge tone={statusTone(student.status)}>{formatStatus(student.status)}</StatusBadge>
                    </td>
                    <td className="student-open-cell" data-label="Action">
                      <button className="table-action" onClick={() => void loadStudentDetail(student.id)}>
                        <Eye size={15} />
                        Open
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && visibleStudents.length === 0 && (
                <tr className="table-state-row">
                  <td colSpan={7}>No students found for this filter.</td>
                </tr>
              )}
              {isLoading && (
                <tr className="table-state-row">
                  <td colSpan={7}>Loading students...</td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
          </DataPanel>
        </>
      )}

      {selectedStudent && (
        <article className="panel student-detail">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Student detail</p>
              <h2>
                {selectedStudent.full_name} <span>{selectedStudent.student_no}</span>
              </h2>
            </div>
            <div className="toolbar-actions">
              <button
                className="secondary-action"
                onClick={() => {
                  if (detailReturn) {
                    detailReturn.onReturn()
                    return
                  }

                  setSelectedStudent(null)
                  initialStudentIdRef.current = null
                  startedWithFocusedStudentRef.current = false
                  void loadStudentsRef.current(statusFilter)
                }}
              >
                {detailReturn?.label ?? 'Back to students'}
              </button>
              <span className={`badge ${statusClass(selectedStudent.status)}`}>
                {formatStatus(selectedStudent.status)}
              </span>
            </div>
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
                  <dd>{selectedStudent.class?.name ?? 'Not assigned'}</dd>
                </div>
                <div>
                  <dt>DOB</dt>
                  <dd>{selectedStudent.dob ?? 'Not recorded'}</dd>
                </div>
              </dl>
            </div>

            <div className="detail-block">
              <h3>Fee Record Totals</h3>
              <dl>
                <div>
                  <dt>Academic Year</dt>
                  <dd>{feeRecordAcademicYear}</dd>
                </div>
                <div>
                  <dt>Total Expected</dt>
                  <dd>{isLoadingStudentFeeRecordSummary ? 'Loading...' : formatCurrency(currentFeeRecordSummary?.total_expected ?? 0)}</dd>
                </div>
                <div>
                  <dt>Total Paid</dt>
                  <dd>{isLoadingStudentFeeRecordSummary ? 'Loading...' : formatCurrency(currentFeeRecordSummary?.total_paid ?? 0)}</dd>
                </div>
                <div>
                  <dt>Total Outstanding</dt>
                  <dd>{isLoadingStudentFeeRecordSummary ? 'Loading...' : formatCurrency(currentFeeRecordSummary?.total_outstanding ?? 0)}</dd>
                </div>
                <div>
                  <dt>Outstanding Charge Count</dt>
                  <dd>
                    {isLoadingOutstandingCharges
                      ? 'Loading...'
                      : outstandingChargesYear === feeRecordAcademicYear
                        ? outstandingCharges.length
                        : 0}
                  </dd>
                </div>
              </dl>
              {!isLoadingStudentFeeRecordSummary && canViewFeeRecord && !currentFeeRecordSummary && (
                <p>No activated Fee Record charges for {feeRecordAcademicYear}.</p>
              )}
              {!canViewFeeRecord && <p>You do not have permission to view Fee Record totals.</p>}
              {studentFeeRecordSummaryError && <small>{studentFeeRecordSummaryError}</small>}
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
                <p>No parent or guardian recorded.</p>
              )}
            </div>

            <div className="detail-block">
              <h3>Status Action</h3>
              {canUpdateStatus ? (
                <div className="status-editor">
                  <CustomSelect ariaLabel="Student status" value={statusDraft} onChange={(value) => setStatusDraft(value as StudentStatus)} options={statusOptions.filter((option) => option.value !== 'all')} />
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
            <p>{selectedStudent.notes || 'No remarks recorded.'}</p>
          </div>

          <section className="fee-agreement-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Fee Agreement</p>
                <h2>Agreement Snapshot and History</h2>
              </div>
              {canEditFeeAgreement ? (
                <div className="toolbar-actions">
                  <button
                    className="secondary-action"
                    disabled={isLoadingFeeAgreementEditorData}
                    onClick={beginCreateFeeAgreement}
                  >
                    Create Agreement
                  </button>
                  <button
                    className="secondary-action"
                    disabled={isLoadingFeeAgreementEditorData || !currentFeeAgreement}
                    onClick={beginSupersedeFeeAgreement}
                  >
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

            {currentFeeAgreement && (
              <div className="agreement-billing-summary">
                {currentFeeAgreement.items.map((item) => (
                  <div className="agreement-billing-chip" key={item.id}>
                    <strong>{item.fee_code}</strong>
                    <span>{formatStatus(item.classification ?? 'recurring')} / {formatStatus(item.billing_frequency ?? currentFeeAgreement.payment_plan)}</span>
                    <small>
                      {item.billing_months?.length
                        ? item.billing_months.map((month) => monthShortLabels[month - 1] ?? month).join(', ')
                        : item.billing_frequency === 'monthly' || (!item.billing_frequency && currentFeeAgreement.payment_plan === 'monthly')
                          ? 'Jan-Dec'
                          : 'Months not configured'}
                    </small>
                  </div>
                ))}
              </div>
            )}

            {showFeeAgreementForm && canEditFeeAgreement && (
              <ModalFrame
                title={feeAgreementMode === 'create' ? 'Create Fee Agreement' : 'Supersede Fee Agreement'}
                description={
                  feeAgreementMode === 'create'
                    ? 'Set the agreement dates, review the core fees, and add optional fees only when needed.'
                    : 'Create a new version and review every change before it takes effect.'
                }
                size="workflow"
                initialFocusRef={feeAgreementPaymentPlanRef}
                onClose={() => closeFeeAgreementEditor()}
                footer={
                  <>
                    <button type="button" className="secondary-action" onClick={() => closeFeeAgreementEditor()}>
                      Cancel
                    </button>
                    <button
                      className="primary-action compact"
                      type="submit"
                      form="fee-agreement-form"
                      disabled={isSavingFeeAgreement}
                    >
                      {isSavingFeeAgreement
                        ? 'Saving...'
                        : feeAgreementMode === 'create'
                          ? 'Create Agreement'
                          : 'Supersede Agreement'}
                    </button>
                  </>
                }
              >
              <form id="fee-agreement-form" className="agreement-form" onSubmit={submitFeeAgreement}>
                <ModalContextSummary
                  ariaLabel="Student context"
                  items={[
                    { label: 'Student', value: selectedStudent?.full_name ?? 'Not selected' },
                    { label: 'Student ID', value: selectedStudent?.student_no ?? 'Not recorded' },
                  ]}
                />
                {formatValidationError(feeAgreementErrors, 'items') && (
                  <div className="inline-error" role="alert" tabIndex={-1}>
                    {formatValidationError(feeAgreementErrors, 'items')}
                  </div>
                )}

                <FeeAgreementEditor
                  mode={feeAgreementMode}
                  form={feeAgreementForm}
                  errors={feeAgreementErrors}
                  currentAgreement={currentFeeAgreement}
                  onChange={setFeeAgreementForm}
                  paymentPlanRef={feeAgreementPaymentPlanRef}
                />

              </form>
              </ModalFrame>
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

          <section className="fee-record-charge-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Fee Record</p>
                <h2>{feeRecordIsActivated ? 'Charges and Outstanding' : 'Preview and Activate Charges'}</h2>
              </div>
              <span className={`badge ${feeRecordIsActivated && outstandingCharges.length > 0 ? 'partial' : 'neutral'}`}>{outstandingStatusLabel}</span>
            </div>

            {!canViewFeeRecord && <Message tone="info">You do not have permission to view Fee Record charges.</Message>}
            {!feeRecordIsActivated && feeRecordPreviewError && <Message tone="error">{feeRecordPreviewError}</Message>}

            {canViewFeeRecord && (
              <>
                <div className="fee-record-activation-bar">
                  <label className="form-field">
                    Academic Year
                    <input
                      value={feeRecordAcademicYear}
                      readOnly
                    />
                  </label>
                  <div className="fee-record-action-group">
                    {feeRecordIsActivated ? (
                      <>
                        <button
                          className="primary-action compact"
                          onClick={() => {
                            if (showOutstandingCharges) {
                              setShowOutstandingCharges(false)
                              return
                            }
                            if (selectedStudent) {
                              void loadOutstandingCharges(selectedStudent.id, feeRecordAcademicYear).then(() => setShowOutstandingCharges(true))
                            }
                          }}
                          disabled={isLoadingOutstandingCharges}
                        >
                          {isLoadingOutstandingCharges
                            ? 'Loading...'
                            : showOutstandingCharges
                              ? 'Hide Outstanding'
                              : 'View Outstanding'}
                        </button>
                        {canManageFeeRecord && (
                          <button
                            className="secondary-action"
                            onClick={() => {
                              setShowManualChargeForm(true)
                              setManualChargeErrors(undefined)
                            }}
                          >
                            Add One-time Charge
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button className={feeRecordPreview ? 'secondary-action' : 'primary-action compact'} onClick={() => void previewFeeRecordCharges()} disabled={isPreviewingFeeRecord}>
                          {isPreviewingFeeRecord ? 'Previewing...' : 'Preview Charges'}
                        </button>
                        {feeRecordPreview && canActivateFeeRecord && (
                          <button
                            className="primary-action compact"
                            onClick={() => void activateFeeRecordCharges()}
                            disabled={!canActivateCurrentPreview || isActivatingFeeRecord}
                          >
                            {isActivatingFeeRecord ? 'Activating...' : 'Activate Charges'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {!feeRecordIsActivated && !canActivateFeeRecord && (
                  <Message tone="info">Activation is hidden for this role. Users need fee_record.generate.</Message>
                )}

                {feeRecordIsActivated && showManualChargeForm && canManageFeeRecord && (
                  <ModalFrame
                    title="One-time Charge"
                    description="Add a one-time charge to this student account."
                    size="standard"
                    initialFocusRef={oneTimeChargeYearRef}
                    onClose={() => setShowManualChargeForm(false)}
                    footer={
                      <>
                        <button type="button" className="secondary-action" onClick={() => setShowManualChargeForm(false)}>
                          Cancel
                        </button>
                        <button
                          className="primary-action compact"
                          type="submit"
                          form="manual-charge-form"
                          disabled={isSavingManualCharge}
                        >
                          {isSavingManualCharge ? 'Adding...' : 'Add One-time Charge'}
                        </button>
                      </>
                    }
                  >
                  <ModalContextSummary
                    ariaLabel="Student context"
                    items={[
                      { label: 'Student', value: selectedStudent.full_name },
                      { label: 'Student ID', value: selectedStudent.student_no },
                      { label: 'Charge year', value: manualChargeForm.academic_year },
                    ]}
                  />
                  <form id="manual-charge-form" className="manual-charge-form" onSubmit={submitManualCharge} noValidate>
                    <div className="form-grid">
                      <label className="form-field">
                        Academic Year
                        <input
                          ref={oneTimeChargeYearRef}
                          aria-label="Academic Year"
                          value={manualChargeForm.academic_year}
                          onChange={(event) => updateManualChargeForm('academic_year', event.target.value)}
                          {...fieldErrorProps(
                            'one-time-charge-academic-year-error',
                            formatValidationError(manualChargeErrors, 'academic_year'),
                          )}
                        />
                        <FieldError
                          id="one-time-charge-academic-year-error"
                          message={formatValidationError(manualChargeErrors, 'academic_year')}
                        />
                      </label>

                      <label className="form-field">
                        Billing Month
                        <input
                          aria-label="Billing Month"
                          type="month"
                          value={manualChargeForm.billing_month}
                          onChange={(event) => updateManualChargeForm('billing_month', event.target.value)}
                          {...fieldErrorProps(
                            'one-time-charge-billing-month-error',
                            formatValidationError(manualChargeErrors, 'billing_month'),
                          )}
                        />
                        <FieldError
                          id="one-time-charge-billing-month-error"
                          message={formatValidationError(manualChargeErrors, 'billing_month')}
                        />
                      </label>

                      <label className="form-field">
                        Category
                        <CustomSelect
                          ariaLabel="Category"
                          value={manualChargeForm.fee_record_category}
                          onChange={(value) => updateManualChargeForm('fee_record_category', value as FeeRecordCategory)}
                          options={feeRecordCategoryOptions}
                          {...fieldErrorProps(
                            'one-time-charge-fee-record-category-error',
                            formatValidationError(manualChargeErrors, 'fee_record_category'),
                          )}
                        />
                        <FieldError
                          id="one-time-charge-fee-record-category-error"
                          message={formatValidationError(manualChargeErrors, 'fee_record_category')}
                        />
                      </label>

                      <label className="form-field">
                        Amount
                        <input
                          aria-label="Amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={manualChargeForm.expected_amount}
                          onChange={(event) => updateManualChargeForm('expected_amount', event.target.value)}
                          {...fieldErrorProps(
                            'one-time-charge-expected-amount-error',
                            formatValidationError(manualChargeErrors, 'expected_amount'),
                          )}
                        />
                        <FieldError
                          id="one-time-charge-expected-amount-error"
                          message={formatValidationError(manualChargeErrors, 'expected_amount')}
                        />
                      </label>

                      <label className="form-field wide">
                        Description
                        <input
                          aria-label="Description"
                          value={manualChargeForm.description}
                          onChange={(event) => updateManualChargeForm('description', event.target.value)}
                          placeholder="Uniform, Books, Worksheet, PE, Application, Deposit, Enrolment, Old Balance"
                          {...fieldErrorProps(
                            'one-time-charge-description-error',
                            formatValidationError(manualChargeErrors, 'description'),
                          )}
                        />
                        <FieldError
                          id="one-time-charge-description-error"
                          message={formatValidationError(manualChargeErrors, 'description')}
                        />
                      </label>

                      <label className="form-field wide">
                        Remark
                        <textarea value={manualChargeForm.remark} onChange={(event) => updateManualChargeForm('remark', event.target.value)} />
                      </label>
                    </div>

                  </form>
                  </ModalFrame>
                )}

                {!feeRecordIsActivated && feeRecordPreview?.warnings.length ? (
                  <div className="fee-record-warning-list">
                    <div className="payment-subheader">
                      <div>
                        <h3>Activation blocked</h3>
                        <p>Billing months must be configured before these charges can be generated.</p>
                      </div>
                      <AlertTriangle className="warning-icon" size={20} />
                    </div>
                    {feeRecordPreview.warnings.map((warning) => (
                      <div className="warning-row" key={`${warning.fee_agreement_item_id}-${warning.reason}`}>
                        <strong>{warning.fee_code ?? 'Manual'} / {warning.description}</strong>
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!feeRecordIsActivated && feeRecordPreview && (
                  <div className="fee-record-preview-block">
                    <div className="payment-subheader">
                      <div>
                        <h3>Preview Rows</h3>
                        <p>
                          {feeRecordPreview.charges.length} charge cell{feeRecordPreview.charges.length === 1 ? '' : 's'} from agreement v
                          {currentFeeAgreement?.version_no ?? feeRecordPreview.fee_agreement.id}.
                        </p>
                      </div>
                      <span className={`badge ${previewBlockedByWarnings ? 'danger' : 'paid'}`}>
                        {previewBlockedByWarnings ? 'Needs confirmation' : 'Ready'}
                      </span>
                    </div>

                    {groupedPreviewCharges.length === 0 ? (
                      <div className="empty-state">No preview charge rows generated for this academic year.</div>
                    ) : (
                      <div className="preview-charge-groups">
                        {groupedPreviewCharges.map((group) => (
                          <section className="preview-charge-group" key={group.key}>
                            <div className="preview-charge-group-header">
                              <div>
                                <strong>{group.feeCode} / {group.description}</strong>
                                <span>{group.category}</span>
                              </div>
                              <b>{formatCurrency(group.charges.reduce((sum, charge) => sum + charge.expected_amount, 0))}</b>
                            </div>
                            <div className="table-wrap">
                              <table className="preview-charge-table">
                                <thead>
                                  <tr>
                                    <th>Billing Month</th>
                                    <th>Fee Code</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th>Expected Amount</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.charges.map((charge) => (
                                    <tr key={`${charge.fee_agreement_item_id}-${charge.billing_month}-${charge.description}`}>
                                      <td data-label="Month">{formatBillingMonth(charge.billing_month)}</td>
                                      <td data-label="Fee">{charge.fee_code ?? 'Manual'}</td>
                                      <td data-label="Description">{charge.description}</td>
                                      <td data-label="Category">{charge.fee_record_category}</td>
                                      <td data-label="Amount">{formatCurrency(charge.expected_amount)}</td>
                                      <td data-label="Status">
                                        <div className="preview-status-value">
                                          <span className={`badge ${statusClass(charge.collection_status)}`}>
                                            {formatStatus(charge.collection_status)}
                                          </span>
                                          <small>{charge.warning ?? 'None'}</small>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {feeRecordIsActivated && showOutstandingCharges && outstandingChargesYear === feeRecordAcademicYear && (
                  <div className="fee-record-outstanding-panel">
                    <div className="payment-subheader">
                      <div>
                        <h3>Outstanding Charges</h3>
                        <p>{outstandingCharges.length} charge{outstandingCharges.length === 1 ? '' : 's'} awaiting payment.</p>
                      </div>
                    </div>
                    {outstandingCharges.length ? (
                      <div className="fee-record-outstanding-list">
                        {outstandingCharges.map((charge) => (
                          <div className="fee-record-outstanding-row" key={charge.id}>
                            <div>
                              <strong>{charge.description}</strong>
                              <span>{formatBillingMonth(charge.billing_month)} · {charge.fee_code ?? charge.fee_record_category}</span>
                            </div>
                            <b>{formatCurrency(charge.outstanding_amount)}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">No outstanding charges for {feeRecordAcademicYear}.</div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="payment-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Payments</p>
                <h2>Payment History</h2>
              </div>
              <div className="payment-header-actions">
                {canSendPaymentReminders && (
                  <button type="button" className="secondary-action" onClick={() => setShowPaymentReminderConfirm(true)} disabled={isSendingPaymentReminder}>
                    {isSendingPaymentReminder ? 'Sending...' : 'Send payment reminder'}
                  </button>
                )}
                {canCreatePayments ? (
                  <button className="secondary-action" onClick={showPaymentForm ? () => setShowPaymentForm(false) : beginCreatePayment}>
                    {showPaymentForm ? 'Close Payment Form' : 'Create Payment'}
                  </button>
                ) : !canSendPaymentReminders ? (
                  <span className="permission-note">Payment actions unavailable</span>
                ) : null}
              </div>
            </div>

            {!canViewPayments && <Message tone="info">You do not have permission to view payments.</Message>}

            {showPaymentReminderConfirm && selectedStudent && (
              <ModalFrame
                title="Send Payment Reminder"
                description={`Send an in-app payment reminder to linked parent accounts for ${selectedStudent.full_name}.`}
                size="compact"
                tone="default"
                initialFocusRef={paymentReminderCancelRef}
                onClose={() => setShowPaymentReminderConfirm(false)}
                footer={
                  <>
                    <button
                      ref={paymentReminderCancelRef}
                      type="button"
                      className="secondary-action"
                      onClick={() => setShowPaymentReminderConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-action compact"
                      type="button"
                      disabled={isSendingPaymentReminder}
                      onClick={async () => {
                        setShowPaymentReminderConfirm(false)
                        await sendPaymentReminder()
                      }}
                    >
                      {isSendingPaymentReminder ? 'Sending...' : 'Confirm & Send'}
                    </button>
                  </>
                }
              >
                <ModalContextSummary
                  ariaLabel="Payment reminder recipient details"
                  items={[
                    { label: 'Student', value: `${selectedStudent.full_name} (${selectedStudent.student_no})` },
                    { label: 'Class', value: selectedStudent.class?.name ?? 'Unassigned' },
                    {
                      label: 'Outstanding Charges',
                      value: `${outstandingCharges.length} charge${outstandingCharges.length === 1 ? '' : 's'} (${formatCurrency(
                        outstandingCharges.reduce((sum, c) => sum + Number(c.outstanding_amount || 0), 0)
                      )})`,
                    },
                  ]}
                />
                <p className="field-help" style={{ marginTop: '12px' }}>
                  This will send an in-app notification to all verified parents and guardians linked to this student.
                </p>
              </ModalFrame>
            )}

            {showPaymentForm && canCreatePayments && (
              <ModalFrame
                title="Record Payment"
                description="Record the amount, choose the fees it clears, and confirm the balance."
                size="workflow"
                initialFocusRef={paymentAmountRef}
                onClose={() => setShowPaymentForm(false)}
                footer={
                  <>
                    <button type="button" className="secondary-action" onClick={() => setShowPaymentForm(false)}>
                      Cancel
                    </button>
                    <button
                      className="primary-action compact"
                      type="submit"
                      form="payment-record-form"
                      disabled={isSavingPayment || !paymentCanSubmit}
                    >
                      {isSavingPayment ? 'Saving...' : 'Record Payment'}
                    </button>
                  </>
                }
              >
              <form id="payment-record-form" className="payment-form" onSubmit={submitPayment} noValidate>
                <ModalContextSummary
                  ariaLabel="Student context"
                  items={[
                    { label: 'Student', value: selectedStudent?.full_name ?? 'Not selected' },
                    { label: 'Student ID', value: selectedStudent?.student_no ?? 'Not recorded' },
                    {
                      label: 'Status on save',
                      value: paymentForm.payment_method === 'cash' ? 'Verified' : 'Pending verification',
                    },
                  ]}
                />

                <section className="payment-basics" aria-labelledby="payment-basics-heading">
                  <div className="payment-subheader">
                    <div>
                      <p className="eyebrow">Step 1</p>
                      <h3 id="payment-basics-heading">Payment basics</h3>
                    </div>
                  </div>
                  <div className="payment-basics-grid">
                    <label className="form-field">
                      Academic Year
                      <input
                        value={paymentForm.academic_year}
                        onChange={(event) => updatePaymentForm('academic_year', event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      Payment Method
                      <CustomSelect
                        ariaLabel="Payment Method"
                        value={paymentForm.payment_method}
                        onChange={(value) => updatePaymentForm('payment_method', value)}
                        options={paymentMethodOptions}
                      />
                    </label>
                    <label className="form-field">
                      Amount
                      <input
                        ref={paymentAmountRef}
                        aria-label="Amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(event) => updatePaymentForm('amount', event.target.value)}
                        {...fieldErrorProps(
                          'record-payment-amount-error',
                          formatValidationError(paymentErrors, 'amount'),
                        )}
                      />
                      <FieldError
                        id="record-payment-amount-error"
                        message={formatValidationError(paymentErrors, 'amount')}
                      />
                    </label>
                    <label className="form-field">
                      Payment Date
                      <DatePicker
                        ariaLabel="Payment Date"
                        value={paymentForm.payment_date}
                        onChange={(value) => updatePaymentForm('payment_date', value)}
                        {...fieldErrorProps(
                          'record-payment-payment-date-error',
                          formatValidationError(paymentErrors, 'payment_date'),
                        )}
                      />
                      <FieldError
                        id="record-payment-payment-date-error"
                        message={formatValidationError(paymentErrors, 'payment_date')}
                      />
                    </label>
                    {paymentForm.payment_method === 'cash' && (
                      <label className="form-field">
                        Received Date
                        <DatePicker
                          ariaLabel="Received Date"
                          value={paymentForm.received_date}
                          onChange={(value) => updatePaymentForm('received_date', value)}
                          {...fieldErrorProps(
                            'record-payment-received-date-error',
                            formatValidationError(paymentErrors, 'received_date'),
                          )}
                        />
                        <FieldError
                          id="record-payment-received-date-error"
                          message={formatValidationError(paymentErrors, 'received_date')}
                        />
                      </label>
                    )}
                  </div>
                </section>

                <PaymentAllocationEditor
                  academicYear={paymentForm.academic_year}
                  paymentAmount={Number(paymentForm.amount || 0)}
                  allocationTotal={paymentAllocationTotal}
                  allocations={paymentForm.allocations}
                  outstandingCharges={outstandingCharges}
                  isLoadingOutstandingCharges={isLoadingOutstandingCharges}
                  outstandingChargeError={outstandingChargeError}
                  allocationErrors={paymentErrors}
                  canAddOneTimeCharge={canManageFeeRecord}
                  isOneTimeChargeOpen={showPaymentOneTimeCharge}
                  oneTimeCharge={paymentOneTimeCharge}
                  oneTimeChargeErrors={paymentOneTimeChargeErrors}
                  oneTimeChargeNotice={paymentOneTimeChargeNotice}
                  isSavingOneTimeCharge={isSavingPaymentOneTimeCharge}
                  onRefresh={() =>
                    selectedStudent && void loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)
                  }
                  onToggleCharge={(charge, selected) =>
                    selected
                      ? selectChargeAllocation(charge)
                      : removePaymentAllocation(
                          paymentForm.allocations.find(
                            (allocation) => allocation.fee_record_charge_id === charge.id,
                          )?.key ?? '',
                        )
                  }
                  onUpdateAllocation={updatePaymentAllocation}
                  onRemoveAllocation={removePaymentAllocation}
                  onOpenOneTimeCharge={() => {
                    setShowPaymentOneTimeCharge(true)
                    setPaymentOneTimeChargeErrors(undefined)
                    setPaymentOneTimeChargeNotice('')
                  }}
                  onCancelOneTimeCharge={() => {
                    setShowPaymentOneTimeCharge(false)
                    setPaymentOneTimeCharge(createOneTimeChargeDraft(paymentForm.academic_year))
                    setPaymentOneTimeChargeErrors(undefined)
                  }}
                  onUpdateOneTimeCharge={updatePaymentOneTimeCharge}
                  onCreateOneTimeCharge={() => void submitPaymentOneTimeCharge()}
                  onAddUnclassified={addUnclassifiedPaymentAllocation}
                  afterAllocation={paymentPostAllocation}
                />
              </form>
              </ModalFrame>
            )}

            {canViewPayments && (
              <div className="table-wrap">
                <table className="payment-history-table">
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Received Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Reference No</th>
                      <th>Receipt</th>
                      <th>Recorded By</th>
                      <th>Verified By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const issuedReceipt = payment.issued_receipt

                      return (
                          <Fragment key={payment.id}>
                        <tr>
                          <td data-label="Payment Date">{payment.payment_date}</td>
                          <td data-label="Received Date">{payment.received_date ?? 'Not recorded'}</td>
                          <td data-label="Method">{formatStatus(payment.payment_method)}</td>
                          <td data-label="Amount">{formatCurrency(payment.amount)}</td>
                          <td data-label="Status">
                            <span className={`badge ${paymentStatusClass(payment.status)}`}>{formatStatus(payment.status)}</span>
                          </td>
                          <td data-label="Reference">{payment.reference_no ?? 'Not recorded'}</td>
                          <td data-label="Receipt">{issuedReceipt ? issuedReceipt.receipt_no : 'No issued receipt'}</td>
                          <td data-label="Recorded By">{payment.recorded_by?.name ?? 'Not recorded'}</td>
                          <td data-label="Verified By">{payment.verified_by?.name ?? 'Not verified'}</td>
                          <td data-label="Actions">
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
                              {canCreateReceipts && payment.status === 'verified' && !payment.issued_receipt && (
                                <button className="table-action" onClick={() => beginGenerateReceipt(payment)}>
                                  Generate Receipt
                                </button>
                              )}
                              {issuedReceipt && canViewReceipts && (
                                <button className="table-action" onClick={() => void viewReceipt(issuedReceipt.id)}>
                                  View Receipt
                                </button>
                              )}
                              {issuedReceipt && canPrintReceipts && (
                                <button className="table-action" onClick={() => void printReceipt(issuedReceipt.id)}>
                                  Print Receipt
                                </button>
                              )}
                              {issuedReceipt && canVoidReceipts && issuedReceipt.status === 'issued' && (
                                <button className="table-action danger-action" onClick={() => beginVoidReceipt(issuedReceipt.id)}>
                                  Void Receipt
                                </button>
                              )}
                              {(!canVerifyPayments || payment.status !== 'pending_verification') &&
                                (!canVoidPayments || payment.status === 'voided') &&
                                (!canCreateReceipts || payment.status !== 'verified' || Boolean(issuedReceipt)) &&
                                (!issuedReceipt || (!canViewReceipts && !canPrintReceipts && !canVoidReceipts)) && (
                                  <span className="permission-note">No action</span>
                                )}
                            </div>
                          </td>
                        </tr>
                        {payment.allocations.length > 0 && (
                          <tr className="payment-allocation-summary">
                            <td colSpan={10}>
                              Allocations:{' '}
                              {payment.allocations
                                .map(
                                  (allocation) =>
                                    `${allocation.allocation_type === 'charge' ? 'Charge' : 'Manual'} ${allocation.fee_code ?? 'Manual'} ${
                                      allocation.description
                                    } ${formatCurrency(allocation.amount)}`,
                                )
                                .join(' / ')}
                            </td>
                          </tr>
                        )}
                        {generatingPaymentId === payment.id && (
                          <tr className="payment-action-row">
                            <td colSpan={10}>
                              <form className="inline-payment-form" onSubmit={(event) => submitGenerateReceiptWithPaidBy(event, payment.id)}>
                                <label className="form-field wide">
                                  Paid By
                                  <input value={generatePaidBy} onChange={(event) => setGeneratePaidBy(event.target.value)} />
                                  {formatValidationError(generateErrors, 'paid_by') && (
                                    <small>{formatValidationError(generateErrors, 'paid_by')}</small>
                                  )}
                                  {formatValidationError(generateErrors, 'payment') && (
                                    <small>{formatValidationError(generateErrors, 'payment')}</small>
                                  )}
                                </label>
                                <div className="toolbar-actions">
                                  <button className="primary-action compact" disabled={isGeneratingReceipt}>
                                    {isGeneratingReceipt ? 'Generating...' : 'Confirm Generate'}
                                  </button>
                                  <button type="button" className="secondary-action" onClick={() => setGeneratingPaymentId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      )
                    })}
                    {!isLoadingPayments && payments.length === 0 && (
                      <tr className="history-state-row">
                        <td colSpan={10}>No payments recorded for this student yet.</td>
                      </tr>
                    )}
                    {isLoadingPayments && (
                      <tr className="history-state-row">
                        <td colSpan={10}>Loading payments...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {paymentToVerify && (
              <ModalFrame
                title="Verify Payment"
                description="Confirm the received details before verification."
                size="standard"
                initialFocusRef={verifyReceivedDateRef}
                onClose={() => setVerifyingPaymentId(null)}
                footer={
                  <>
                    <button type="button" className="secondary-action" onClick={() => setVerifyingPaymentId(null)}>
                      Cancel
                    </button>
                    <button
                      className="primary-action compact"
                      type="submit"
                      form="verify-payment-form"
                      disabled={isVerifyingPayment}
                    >
                      {isVerifyingPayment ? 'Verifying...' : 'Verify Payment'}
                    </button>
                  </>
                }
              >
                <ModalContextSummary
                  ariaLabel="Payment to verify"
                  items={[
                    {
                      label: 'Student',
                      value: `${selectedStudent?.full_name} / ${selectedStudent?.student_no}`,
                    },
                    { label: 'Amount', value: formatCurrency(paymentToVerify.amount) },
                    { label: 'Method', value: formatStatus(paymentToVerify.payment_method) },
                    { label: 'Payment date', value: paymentToVerify.payment_date },
                    {
                      label: 'Reference',
                      value: paymentToVerify.reference_no ?? 'Not recorded',
                    },
                    { label: 'Status', value: formatStatus(paymentToVerify.status) },
                  ]}
                />
                <form
                  id="verify-payment-form"
                  className="form-grid inline-payment-form"
                  onSubmit={(event) => submitVerifyPayment(event, paymentToVerify.id)}
                >
                  <label className="form-field">
                    Received Date
                    <DatePicker
                      buttonRef={verifyReceivedDateRef}
                      ariaLabel="Received Date"
                      value={verifyForm.received_date}
                      onChange={(value) => setVerifyForm((current) => ({ ...current, received_date: value }))}
                      {...fieldErrorProps(
                        'verify-payment-received-date-error',
                        formatValidationError(verifyErrors, 'received_date'),
                      )}
                    />
                    <FieldError
                      id="verify-payment-received-date-error"
                      message={formatValidationError(verifyErrors, 'received_date')}
                    />
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
                  </label>
                  {formatValidationError(verifyErrors, 'payment') && (
                    <div className="inline-error wide" role="alert" tabIndex={-1}>
                      {formatValidationError(verifyErrors, 'payment')}
                    </div>
                  )}
                </form>
              </ModalFrame>
            )}

            {paymentToVoid && (
              <ModalFrame
                title="Void Payment"
                description={
                  paymentVoidBlocked
                    ? 'This payment cannot be voided while its receipt is issued.'
                    : 'Review the consequence and record a reason.'
                }
                size="compact"
                tone="danger"
                initialFocusRef={voidPaymentCancelRef}
                onClose={() => setVoidingPaymentId(null)}
                footer={
                  paymentVoidBlocked ? (
                    <button
                      ref={voidPaymentCancelRef}
                      type="button"
                      className="secondary-action"
                      onClick={() => setVoidingPaymentId(null)}
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        ref={voidPaymentCancelRef}
                        type="button"
                        className="secondary-action"
                        onClick={() => setVoidingPaymentId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-action compact modal-danger-action"
                        type="submit"
                        form="void-payment-form"
                        disabled={isVoidingPayment}
                      >
                        {isVoidingPayment ? 'Voiding...' : 'Confirm Void Payment'}
                      </button>
                    </>
                  )
                }
              >
                <ModalContextSummary
                  ariaLabel="Payment to void"
                  tone="danger"
                  items={[
                    {
                      label: 'Student',
                      value: `${selectedStudent?.full_name} / ${selectedStudent?.student_no}`,
                    },
                    { label: 'Amount', value: formatCurrency(paymentToVoid.amount) },
                    { label: 'Method', value: formatStatus(paymentToVoid.payment_method) },
                    { label: 'Payment date', value: paymentToVoid.payment_date },
                    { label: 'Status', value: formatStatus(paymentToVoid.status) },
                    {
                      label: 'Receipt',
                      value: paymentToVoid.issued_receipt?.receipt_no ?? 'No issued receipt',
                    },
                  ]}
                  consequence={
                    paymentVoidBlocked
                      ? 'Void the issued receipt before voiding this payment.'
                      : paymentToVoid.status === 'verified'
                        ? 'Each applied charge will reopen by the amount allocated from this payment.'
                        : 'This pending payment will become void; charge balances have not yet changed.'
                  }
                />
                {!paymentVoidBlocked && (
                  <form
                    id="void-payment-form"
                    className="inline-payment-form"
                    onSubmit={(event) => submitVoidPayment(event, paymentToVoid.id)}
                  >
                    <label className="form-field wide">
                      Void Reason
                      <textarea
                        aria-label="Void Reason"
                        value={voidReason}
                        onChange={(event) => setVoidReason(event.target.value)}
                        {...fieldErrorProps(
                          'void-payment-void-reason-error',
                          formatValidationError(voidErrors, 'void_reason'),
                        )}
                      />
                      <FieldError
                        id="void-payment-void-reason-error"
                        message={formatValidationError(voidErrors, 'void_reason')}
                      />
                    </label>
                    {formatValidationError(voidErrors, 'payment') && (
                      <div className="inline-error wide" role="alert" tabIndex={-1}>
                        {formatValidationError(voidErrors, 'payment')}
                      </div>
                    )}
                  </form>
                )}
              </ModalFrame>
            )}
          </section>

          {(voidedReceipts.length > 0 || receiptToVoid || selectedReceipt) && (
            <section className="panel receipt-workspace">
            {canViewReceipts && voidedReceipts.length > 0 && (
              <>
              <div className="panel-header no-print">
                <div>
                  <p className="eyebrow">Receipts</p>
                  <h2>Voided Receipt Archive</h2>
                </div>
                <span className="badge neutral">{voidedReceipts.length} voided</span>
              </div>
              <div className="table-wrap receipt-history no-print">
                <table className="receipt-history-table">
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Paid By</th>
                      <th>Void Details</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidedReceipts.map((receipt) => (
                      <Fragment key={receipt.id}>
                        <tr>
                          <td data-label="Receipt No">{receipt.receipt_no}</td>
                          <td data-label="Date">{receipt.receipt_date}</td>
                          <td data-label="Amount">{formatCurrency(receipt.amount)}</td>
                          <td data-label="Paid By">{receipt.paid_by}</td>
                          <td data-label="Void Details">
                            {receipt.voided_by?.name ?? 'Not recorded'} / {receipt.void_reason ?? 'No reason'}
                          </td>
                          <td data-label="Actions">
                            <div className="payment-actions">
                              {canViewReceipts && (
                                <button className="table-action" onClick={() => void viewReceipt(receipt.id)}>
                                  View
                                </button>
                              )}
                              {canPrintReceipts && (
                                <button className="table-action" onClick={() => void printReceipt(receipt.id)}>
                                  Print
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {receiptToVoid && (
              <ModalFrame
                title="Void Receipt"
                description="Review the receipt and record a reason."
                size="compact"
                tone="danger"
                initialFocusRef={voidReceiptCancelRef}
                onClose={() => setVoidingReceiptId(null)}
                footer={
                  <>
                    <button
                      ref={voidReceiptCancelRef}
                      type="button"
                      className="secondary-action"
                      onClick={() => setVoidingReceiptId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-action compact modal-danger-action"
                      type="submit"
                      form="void-receipt-form"
                      disabled={isVoidingReceipt}
                    >
                      {isVoidingReceipt ? 'Voiding...' : 'Confirm Void Receipt'}
                    </button>
                  </>
                }
              >
                <ModalContextSummary
                  ariaLabel="Receipt to void"
                  tone="danger"
                  items={[
                    { label: 'Receipt', value: receiptToVoid.receipt_no },
                    {
                      label: 'Student',
                      value: `${receiptToVoid.student_name} / ${receiptToVoid.student_no}`,
                    },
                    { label: 'Receipt date', value: receiptToVoid.receipt_date },
                    { label: 'Amount', value: formatCurrency(receiptToVoid.amount) },
                    {
                      label: 'Payment reference',
                      value:
                        payments.find((payment) => payment.id === receiptToVoid.payment_id)
                          ?.reference_no ?? 'Not recorded',
                    },
                  ]}
                  consequence="The receipt number will not be reused. The linked payment remains verified and balances do not change until the payment is separately voided."
                />
                <form
                  id="void-receipt-form"
                  className="inline-payment-form"
                  onSubmit={(event) => submitVoidReceipt(event, receiptToVoid.id)}
                >
                  <label className="form-field wide">
                    Void Reason
                    <textarea
                      aria-label="Void Reason"
                      value={receiptVoidReason}
                      onChange={(event) => setReceiptVoidReason(event.target.value)}
                      {...fieldErrorProps(
                        'void-receipt-void-reason-error',
                        formatValidationError(receiptVoidErrors, 'void_reason'),
                      )}
                    />
                    <FieldError
                      id="void-receipt-void-reason-error"
                      message={formatValidationError(receiptVoidErrors, 'void_reason')}
                    />
                  </label>
                  {formatValidationError(receiptVoidErrors, 'receipt') && (
                    <div className="inline-error wide" role="alert" tabIndex={-1}>
                      {formatValidationError(receiptVoidErrors, 'receipt')}
                    </div>
                  )}
                </form>
              </ModalFrame>
            )}

            {selectedReceipt && (
              <article className="receipt-print-scope">
                <div className="receipt-sheet">
                  <div className="receipt-brand">
                    <BrandMark className="receipt-brand-mark" size={34} />
                    <div>
                      <p className="eyebrow">Sample Receipt</p>
                      <h2>{tenant.branding.organization_name}</h2>
                      <span>Payment made is not refundable.</span>
                    </div>
                  </div>
                  <p className="receipt-demo-notice" role="note">
                    {productBrand.receiptDisclaimer}
                  </p>

                  <div className="receipt-meta">
                    <div>
                      <span>Receipt No</span>
                      <strong>{selectedReceipt.receipt_no}</strong>
                    </div>
                    <div>
                      <span>Receipt Date</span>
                      <strong>{selectedReceipt.receipt_date}</strong>
                    </div>
                    <div>
                      <span>Printed Time</span>
                      <strong>{printedAt || new Date().toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Issued By</span>
                      <strong>{selectedReceipt.issued_by?.name ?? 'Not recorded'}</strong>
                    </div>
                  </div>

                  <div className="receipt-two-column">
                    <dl>
                      <div>
                        <dt>Paid By</dt>
                        <dd>{selectedReceipt.paid_by}</dd>
                      </div>
                      <div>
                        <dt>Student Name</dt>
                        <dd>{selectedReceipt.student_name}</dd>
                      </div>
                      <div>
                        <dt>Student ID</dt>
                        <dd>{selectedReceipt.student_no}</dd>
                      </div>
                    </dl>
                    <dl>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formatCurrency(selectedReceipt.amount)}</dd>
                      </div>
                      <div>
                        <dt>Payment Method</dt>
                        <dd>{formatStatus(selectedReceipt.payment_method)}</dd>
                      </div>
                      <div>
                        <dt>Payment Date</dt>
                        <dd>{selectedReceipt.payment_date}</dd>
                      </div>
                      <div>
                        <dt>Received Date</dt>
                        <dd>{selectedReceipt.received_date ?? 'Not recorded'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="amount-words">
                    <span>Amount in Words</span>
                    <strong>{selectedReceipt.amount_in_words}</strong>
                  </div>

                  <div className="receipt-items">
                    <h3>Being Payment For</h3>
                    <div className="receipt-items-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>Fee Code</th>
                            <th>Description</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceipt.items.map((item, index) => (
                            <tr key={item.id}>
                              <td>{index + 1}</td>
                              <td>{item.fee_code ?? 'Manual'}</td>
                              <td>{item.description}</td>
                              <td>{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedReceipt.status === 'voided' && (
                    <Message tone="error">
                      Voided by {selectedReceipt.voided_by?.name ?? 'Not recorded'}: {selectedReceipt.void_reason ?? 'No reason provided.'}
                    </Message>
                  )}

                  <footer className="receipt-footer">
                    <p>Payment made is not refundable.</p>
                    <p>This is a computer generated form. No signature is required.</p>
                  </footer>

                  <div className="toolbar-actions no-print">
                    {canPrintReceipts && (
                      <button className="primary-action compact" onClick={() => void printReceipt(selectedReceipt.id)}>
                        Print Receipt
                      </button>
                    )}
                    {canVoidReceipts && selectedReceipt.status === 'issued' && (
                      <button className="secondary-action danger-action" onClick={() => beginVoidReceipt(selectedReceipt.id)}>
                        Void Receipt
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )}
            </section>
          )}
        </article>
      )}
    </section>
  )
}


function FeeRecordSummaryPage({
  user,
  onUnauthorized,
  onOpenStudent,
}: {
  user: CurrentUser
  onUnauthorized: () => void
  onOpenStudent: (studentId: number) => void
}) {
  const [activeView, setActiveView] = useState<FeeRecordModuleView>('summary')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()))
  const [levelGroup, setLevelGroup] = useState('')
  const [studentStatus, setStudentStatus] = useState<StudentStatus>('active')
  const [outstandingOnly, setOutstandingOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FeeRecordCategory>('SF+MF')
  const [summaryRows, setSummaryRows] = useState<FeeRecordSummaryRow[]>([])
  const [monthlyRows, setMonthlyRows] = useState<FeeRecordCategoryMonthlyRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const canViewFeeRecord = hasPermission(user, 'fee_record.view')

  useEffect(() => {
    if (!canViewFeeRecord) {
      setSummaryRows([])
      setMonthlyRows([])
      return
    }

    const loadFeeRecord = async () => {
      setIsLoading(true)
      setError('')

      const params = new URLSearchParams({
        academic_year: academicYear,
        student_status: studentStatus,
      })

      if (levelGroup) {
        params.set('level_group', levelGroup)
      }

      if (outstandingOnly) {
        params.set('outstanding_only', 'true')
      }

      if (search.trim()) {
        params.set('search', search.trim())
      }

      try {
        if (activeView === 'summary') {
          const response = await apiRequest<{ data: FeeRecordSummaryRow[] }>(`/fee-record/summary?${params.toString()}`)
          setSummaryRows(response.data)
        } else {
          params.set('category', category)
          const response = await apiRequest<{ data: FeeRecordCategoryMonthlyRow[] }>(
            `/fee-record/category-monthly?${params.toString()}`,
          )
          setMonthlyRows(response.data)
        }
      } catch (feeRecordError) {
        if (feeRecordError instanceof ApiError && feeRecordError.status === 401) {
          onUnauthorized()
          return
        }

        setError(mapError(feeRecordError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadFeeRecord()
  }, [academicYear, activeView, canViewFeeRecord, category, levelGroup, onUnauthorized, outstandingOnly, search, studentStatus])

  const totals = useMemo(
    () => {
      const rows = activeView === 'summary' ? summaryRows : monthlyRows

      return rows.reduce(
        (summary, row) => ({
          expected: summary.expected + row.total_expected,
          paid: summary.paid + row.total_paid,
          outstanding: summary.outstanding + row.total_outstanding,
        }),
        { expected: 0, paid: 0, outstanding: 0 },
      )
    },
    [activeView, monthlyRows, summaryRows],
  )

  return (
    <section className="page-stack fee-record-page">
      <PageHeader eyebrow="Fee Record" title="Admin Fee Record" />

      {!canViewFeeRecord && <Message tone="info">You do not have permission to view Fee Record.</Message>}
      {error && <Message tone="error">{error}</Message>}

      {canViewFeeRecord && (
        <>
          <div className="fee-record-view-switch" role="group" aria-label="Fee Record views">
            <button className={activeView === 'summary' ? 'active' : ''} onClick={() => setActiveView('summary')}>
              Summary
            </button>
            <button className={activeView === 'category-monthly' ? 'active' : ''} onClick={() => setActiveView('category-monthly')}>
              Category Monthly
            </button>
          </div>

          <section className="stats-grid three" aria-label="Fee Record totals">
            <StatCard label="Total Expected" value={formatCurrency(totals.expected)} />
            <StatCard label="Total Paid" value={formatCurrency(totals.paid)} tone="positive" />
            <StatCard
              label="Total Outstanding"
              value={formatCurrency(totals.outstanding)}
              tone={totals.outstanding > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <FilterToolbar ariaLabel="Fee Record filters">
            <label className="form-field">
              Academic Year
              <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
            </label>
            {activeView === 'category-monthly' && (
              <label className="form-field">
                Category
                <CustomSelect
                  ariaLabel="Category"
                  value={category}
                  onChange={(val) => setCategory(val as FeeRecordCategory)}
                  options={feeRecordCategoryOptions}
                />
              </label>
            )}
            <label className="form-field">
              Level Group
              <CustomSelect
                ariaLabel="Level Group"
                value={levelGroup}
                onChange={(val) => setLevelGroup(String(val))}
                options={[
                  { value: '', label: 'All level groups' },
                  ...levelGroupOptions,
                ]}
              />
            </label>
            <label className="form-field">
              Student Status
              <CustomSelect
                ariaLabel="Student Status"
                value={studentStatus}
                onChange={(val) => setStudentStatus(val as StudentStatus)}
                options={statusOptions.filter((option) => option.value !== 'all')}
              />
            </label>
            <label className="form-field wide">
              Search
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student name or ID" />
            </label>
            <label className="toggle-field">
              <input type="checkbox" checked={outstandingOnly} onChange={(event) => setOutstandingOnly(event.target.checked)} />
              Outstanding only
            </label>
          </FilterToolbar>

          {activeView === 'summary' ? (
            <DataPanel
              className="fee-record-ledger"
              eyebrow="Student accounts"
              title="Student Fee Records"
              action={isLoading ? <span className="permission-note">Loading...</span> : undefined}
            >
              <p className="ledger-note">
                Open a student to review the fee agreement, record a payment, or issue a receipt.
              </p>

              <p className="table-scroll-hint">Swipe horizontally to see all financial columns.</p>
              <div className="table-wrap fee-record-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Class</th>
                      <th>Level Group</th>
                      <th>Total Expected</th>
                      <th>Total Paid</th>
                      <th>Total Outstanding</th>
                      <th>Outstanding Months</th>
                      <th>Outstanding Categories</th>
                      <th>Latest Receipt</th>
                      <th>Collection Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr
                        className={`fee-record-row ${row.total_outstanding > 0 ? 'has-outstanding' : ''}`}
                        key={row.student_id}
                        onClick={() => onOpenStudent(row.student_id)}
                      >
                        <td>
                          <button
                            className="link-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenStudent(row.student_id)
                            }}
                          >
                            {row.student_name}
                          </button>
                        </td>
                        <td>{row.student_no}</td>
                        <td>{row.class_name ?? 'Not assigned'}</td>
                        <td>{formatLevelGroup(row.level_group)}</td>
                        <td>{formatCurrency(row.total_expected)}</td>
                        <td>{formatCurrency(row.total_paid)}</td>
                        <td>{formatCurrency(row.total_outstanding)}</td>
                        <td>{row.outstanding_months.length > 0 ? row.outstanding_months.map(formatBillingMonth).join(', ') : 'None'}</td>
                        <td>{row.outstanding_categories.length > 0 ? row.outstanding_categories.join(', ') : 'None'}</td>
                        <td>{row.latest_receipt_no ? `${row.latest_receipt_no} / ${row.latest_receipt_date}` : 'No receipt'}</td>
                        <td>
                          <StatusBadge tone={statusTone(row.collection_status_summary)}>
                            {formatStatus(row.collection_status_summary)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && summaryRows.length === 0 && (
                      <tr>
                        <td colSpan={11}>No Fee Record charge-cell summaries found for these filters.</td>
                      </tr>
                    )}
                    {isLoading && (
                      <tr>
                        <td colSpan={11}>Loading Fee Record summary...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DataPanel>
          ) : (
            <DataPanel
              className="fee-record-ledger monthly-ledger"
              eyebrow="Monthly breakdown"
              title="Student Fee Records"
              action={isLoading ? <span className="permission-note">Loading...</span> : undefined}
            >
              <p className="ledger-note">
                {feeRecordCategoryOptions.find((option) => option.value === category)?.label} by month. Review expected,
                paid, and outstanding amounts for each student.
              </p>

              <p className="table-scroll-hint">Swipe horizontally to see all financial columns.</p>
              <div className="table-wrap fee-record-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Class</th>
                      {monthShortLabels.map((monthLabel) => (
                        <th key={monthLabel}>{monthLabel}</th>
                      ))}
                      <th>Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row) => (
                      <tr
                        className={`fee-record-row ${row.total_outstanding > 0 ? 'has-outstanding' : ''}`}
                        key={row.student_id}
                        onClick={() => onOpenStudent(row.student_id)}
                      >
                        <td>
                          <button
                            className="link-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenStudent(row.student_id)
                            }}
                          >
                            {row.student_name}
                          </button>
                        </td>
                        <td>{row.student_no}</td>
                        <td>{row.class_name ?? 'Not assigned'}</td>
                        {row.months.map((cell) => (
                          <td key={cell.month}>
                            <FeeRecordMonthCellView cell={cell} />
                          </td>
                        ))}
                        <td>{formatCurrency(row.total_outstanding)}</td>
                      </tr>
                    ))}
                    {!isLoading && monthlyRows.length === 0 && (
                      <tr>
                        <td colSpan={16}>No {category} monthly Fee Record charge cells found for these filters.</td>
                      </tr>
                    )}
                    {isLoading && (
                      <tr>
                        <td colSpan={16}>Loading Category Monthly view...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DataPanel>
          )}
        </>
      )}
    </section>
  )
}

function FeeRecordMonthCellView({ cell }: { cell: FeeRecordMonthCell }) {
  return (
    <div className={`month-cell ${cell.collection_status}`}>
      <span className="month-cell-status">{cell.collection_status === 'no_charge' ? 'No charge' : formatStatus(cell.collection_status)}</span>
      {cell.charge_count > 0 && (
        <>
          <span>Expected {formatCurrency(cell.expected_amount)}</span>
          <span>Paid {formatCurrency(cell.paid_amount)}</span>
          <strong>Due {formatCurrency(cell.outstanding_amount)}</strong>
          {cell.receipt_refs.length > 0 && <small>{cell.receipt_refs.join(', ')}</small>}
        </>
      )}
    </div>
  )
}

function DashboardPage({
  dashboard,
  apiState,
  user,
  setActivePage,
  onRefresh,
}: {
  dashboard: DashboardResponse | null
  apiState: 'live' | 'demo' | 'loading'
  user: CurrentUser
  setActivePage: (page: PageKey) => void
  onRefresh: () => void
}) {
  const canViewFeeRecord = hasPermission(user, 'fee_record.view')
  const canViewStudents = hasPermission(user, 'students.view')
  const canViewCalendar = hasPermission(user, 'calendar.view')
  const unavailableValue = apiState === 'loading' ? 'Loading...' : 'Unavailable'
  const updatedAt = useMemo(
    () => new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date()),
    [apiState, dashboard],
  )
  const todayShare = dashboard && dashboard.metrics.monthly_collection > 0
    ? Math.min(100, Math.round((dashboard.metrics.today_collection / dashboard.metrics.monthly_collection) * 100))
    : 0
  const metrics = useMemo<Array<{
    label: string
    value: string
    tone: 'neutral' | 'positive' | 'warning'
    icon: ReactNode
    meta: string
    onClick?: () => void
    actionLabel?: string
  }>>(
    () => [
      {
        label: "Today's Collection",
        value: dashboard ? formatCurrency(dashboard.metrics.today_collection) : unavailableValue,
        tone: 'positive',
        icon: <CreditCard size={20} />,
        meta: 'Collected today',
      },
      {
        label: 'Monthly Collection',
        value: dashboard ? formatCurrency(dashboard.metrics.monthly_collection) : unavailableValue,
        tone: 'neutral',
        icon: <BarChart3 size={20} />,
        meta: 'Current calendar month',
      },
      {
        label: 'Outstanding Fees',
        value: !canViewFeeRecord
          ? 'No access'
          : dashboard
            ? formatCurrency(dashboard.metrics.outstanding_fees)
            : unavailableValue,
        tone: 'warning',
        icon: <AlertTriangle size={20} />,
        meta: canViewFeeRecord ? 'Open Fee Record balance' : 'Permission required',
        onClick: canViewFeeRecord ? () => setActivePage('fee-record') : undefined,
        actionLabel: canViewFeeRecord ? 'Open Fee Record' : undefined,
      },
      {
        label: 'Active Students',
        value: dashboard ? String(dashboard.metrics.active_students) : unavailableValue,
        tone: 'neutral',
        icon: <GraduationCap size={20} />,
        meta: 'Currently enrolled',
      },
    ],
    [canViewFeeRecord, dashboard, setActivePage, unavailableValue],
  )

  return (
    <section className="page-stack dashboard-page">
      <header className="dashboard-heading">
        <h1>Dashboard</h1>
        <div className={`dashboard-workspace-status ${apiState}`}>
          <span className="dashboard-live-label"><i aria-hidden="true" />{apiState === 'live' ? 'Live Workspace' : apiState === 'loading' ? 'Refreshing' : 'Workspace unavailable'}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {updatedAt}</span>
          <button type="button" aria-label="Refresh dashboard" disabled={apiState === 'loading'} onClick={onRefresh}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {apiState === 'demo' && (
        <Message tone="error">Dashboard data could not be loaded. Please reload the page to try again.</Message>
      )}

      <section className="stats-grid dashboard-metrics" aria-label="Dashboard metrics">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone as 'neutral' | 'positive' | 'warning'}
            icon={metric.icon}
            meta={metric.meta}
            onClick={metric.onClick}
            actionLabel={metric.actionLabel}
          />
        ))}
      </section>

      <section className="dashboard-management-grid">
        <section className="dashboard-financial-card" aria-label="Financial snapshot">
          <div className="dashboard-section-heading">
            <div>
              <p className="eyebrow">Financial snapshot</p>
              <h2>Collection overview</h2>
            </div>
            <span className={`dashboard-live-badge ${apiState}`}>
              <span aria-hidden="true" />
              {apiState === 'live' ? 'Live data' : apiState === 'loading' ? 'Loading' : 'Unavailable'}
            </span>
          </div>

          <div className="dashboard-financial-summary">
            <strong className="dashboard-financial-total">
              {dashboard ? formatCurrency(dashboard.metrics.monthly_collection) : unavailableValue}
            </strong>
            <span className="dashboard-financial-caption">Collected this month</span>
          </div>

          <div
            className="dashboard-progress"
            role="img"
            aria-label={dashboard
              ? `Today's collections are ${todayShare}% of this month's collections`
              : 'Collection progress unavailable'}
          >
            <span style={{ width: `${todayShare}%` }} />
          </div>
          <p className="dashboard-progress-label">
            {dashboard ? `${todayShare}% of this month's collections received today` : 'Waiting for collection data'}
          </p>

          <div className="dashboard-financial-details">
            <div>
              <span>Collected today</span>
              <strong>{dashboard ? formatCurrency(dashboard.metrics.today_collection) : unavailableValue}</strong>
            </div>
            <div>
              <span>Outstanding balance</span>
              <strong>
                {!canViewFeeRecord
                  ? 'No access'
                  : dashboard
                    ? formatCurrency(dashboard.metrics.outstanding_fees)
                    : unavailableValue}
              </strong>
            </div>
          </div>
        </section>

        <section className="dashboard-quick-card" aria-label="Quick actions">
          <div className="dashboard-section-heading">
            <div>
              <p className="eyebrow">Shortcuts</p>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="dashboard-quick-list">
            {canViewStudents && (
              <button type="button" aria-label="Go to Students" onClick={() => setActivePage('students')}>
                <span className="dashboard-quick-icon"><GraduationCap size={19} /></span>
                <span className="dashboard-quick-copy">
                  <strong>Students</strong>
                  <small>Profiles and enrolment</small>
                </span>
                <span className="dashboard-quick-arrow" aria-hidden="true">›</span>
              </button>
            )}
            {canViewFeeRecord && (
              <button type="button" aria-label="Go to Fee Record" onClick={() => setActivePage('fee-record')}>
                <span className="dashboard-quick-icon"><ClipboardList size={19} /></span>
                <span className="dashboard-quick-copy">
                  <strong>Fee Record</strong>
                  <small>Balances and collections</small>
                </span>
                <span className="dashboard-quick-arrow" aria-hidden="true">›</span>
              </button>
            )}
            {canViewCalendar && (
              <button type="button" aria-label="Go to Calendar" onClick={() => setActivePage('calendar')}>
                <span className="dashboard-quick-icon"><CalendarDays size={19} /></span>
                <span className="dashboard-quick-copy">
                  <strong>Calendar</strong>
                  <small>School events and meetings</small>
                </span>
                <span className="dashboard-quick-arrow" aria-hidden="true">›</span>
              </button>
            )}
            {!canViewStudents && !canViewFeeRecord && !canViewCalendar && (
              <p className="dashboard-quick-empty">No shortcuts are available for this account.</p>
            )}
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <DataPanel eyebrow="Latest activity" title="Recent collections">
          {!dashboard ? (
            <div className="empty-state compact">
              <CreditCard size={23} />
              <strong>{apiState === 'loading' ? 'Loading dashboard...' : 'Dashboard unavailable'}</strong>
              <p>{apiState === 'loading' ? 'Fetching current collection data.' : 'No collection data is being shown.'}</p>
            </div>
          ) : dashboard.recent_payments.length > 0 ? (
            <div className="dashboard-list">
              {dashboard.recent_payments.slice(0, 5).map((payment) => (
                <div className="dashboard-list-row" key={payment.id}>
                  <div className="dashboard-list-person">
                    <span className="dashboard-list-avatar" aria-hidden="true">
                      {payment.student.charAt(0).toUpperCase()}
                    </span>
                    <span className="dashboard-list-copy">
                      <strong>{payment.student}</strong>
                      <small>{formatStatus(payment.method)} · {payment.payment_date}</small>
                    </span>
                  </div>
                  <div className="dashboard-list-amount">
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span className="dashboard-status positive">Collected</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <CreditCard size={23} />
              <strong>No collection activity yet</strong>
              <p>Verified payments will appear here.</p>
            </div>
          )}
        </DataPanel>

        <DataPanel
          eyebrow="Attention needed"
          title="Outstanding accounts"
          action={canViewFeeRecord ? (
            <button type="button" className="secondary-action dashboard-panel-action" onClick={() => setActivePage('fee-record')}>
              Review balances
            </button>
          ) : undefined}
        >
          {!dashboard ? (
            <div className="empty-state compact">
              <AlertTriangle size={23} />
              <strong>{apiState === 'loading' ? 'Loading dashboard...' : 'Dashboard unavailable'}</strong>
              <p>{apiState === 'loading' ? 'Fetching current outstanding accounts.' : 'No outstanding data is being shown.'}</p>
            </div>
          ) : dashboard.outstanding_students.length > 0 ? (
            <div className="dashboard-list">
              {dashboard.outstanding_students.slice(0, 5).map((student) => (
                <div className="dashboard-list-row" key={student.invoice_id}>
                  <div className="dashboard-list-person">
                    <span className="dashboard-list-avatar warning" aria-hidden="true">
                      {student.student.charAt(0).toUpperCase()}
                    </span>
                    <span className="dashboard-list-copy">
                      <strong>{student.student}</strong>
                      <small>{student.class_name} · due {student.due_date}</small>
                    </span>
                  </div>
                  <div className="dashboard-list-amount">
                    <strong>{formatCurrency(student.amount)}</strong>
                    <span className="dashboard-status warning">Follow up</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact positive">
              <ShieldCheck size={23} />
              <strong>No urgent outstanding accounts</strong>
              <p>New overdue items will be shown here.</p>
            </div>
          )}
        </DataPanel>
      </section>
    </section>
  )
}

function App() {
  const tenant = useTenantConfiguration()
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [apiState, setApiState] = useState<'live' | 'demo' | 'loading'>('loading')
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authenticated'>('checking')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [focusedStudentId, setFocusedStudentId] = useState<number | null>(null)
  const [classReturnContext, setClassReturnContext] = useState<SchoolClassOption | null>(null)
  const [attendanceClassId, setAttendanceClassId] = useState<number | null>(null)

  const loadDashboard = async (sessionUser: CurrentUser) => {
    setDashboard(null)

    if (sessionUser.school_id === null) {
      setApiState('live')
      return
    }

    setApiState('loading')
    const today = new Date()
    const params = new URLSearchParams({
      school_id: String(sessionUser.school_id),
      invoice_month: today.toISOString().slice(0, 7),
      academic_year: String(today.getFullYear()),
    })

    try {
      const response = await apiRequest<DashboardResponse>(`/dashboard/school?${params.toString()}`)
      setDashboard(response)
      setApiState('live')
    } catch {
      setDashboard(null)
      setApiState('demo')
    }
  }

  const loadCurrentUser = async () => {
    setAuthState('checking')

    try {
      const response = await apiRequest<{ user: CurrentUser }>('/me')
      setUser(response.user)
      setAuthState('authenticated')
      void loadDashboard(response.user)
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
    void loadDashboard(loggedInUser)
  }

  const handleLogout = async () => {
    try {
      await apiRequest<{ message: string }>('/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setAuthState('guest')
      setActivePage('dashboard')
      setFocusedStudentId(null)
      setClassReturnContext(null)
      setAttendanceClassId(null)
    }
  }

  const handleUnauthorized = () => {
    setUser(null)
    setAuthState('guest')
    setActivePage('dashboard')
    setFocusedStudentId(null)
    setClassReturnContext(null)
    setAttendanceClassId(null)
  }

  const openStudentDetail = (studentId: number) => {
    setClassReturnContext(null)
    setFocusedStudentId(studentId)
    setActivePage('students')
  }

  const openClassStudentDetail = (studentId: number, schoolClass: SchoolClassOption) => {
    setClassReturnContext(schoolClass)
    setFocusedStudentId(studentId)
    setActivePage('students')
  }

  const returnToClass = () => {
    setFocusedStudentId(null)
    setActivePage('classes')
  }

  const openClassAttendance = (classId: number) => {
    setClassReturnContext(null)
    setFocusedStudentId(null)
    setAttendanceClassId(classId)
    setActivePage('attendance')
  }

  const handleSelectPage = (page: PageKey) => {
    const featureKey = page === 'schedule' ? 'schedule' : page === 'attendance' ? 'attendance' : null
    if (!user || (featureKey && tenant.features[featureKey] === false) || !navItems.some((item) => item.key === page && (!item.requiredPermission || hasPermission(user, item.requiredPermission)) && (!item.requiredAnyPermissions || item.requiredAnyPermissions.some((permission) => hasPermission(user, permission))))) {
      return
    }

    setClassReturnContext(null)
    setFocusedStudentId(null)
    setAttendanceClassId(null)
    setActivePage(page)
  }

  const availableNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (item.key !== 'schedule' || tenant.features.schedule !== false) && (item.key !== 'attendance' || tenant.features.attendance !== false) && (!item.requiredPermission || (user && hasPermission(user, item.requiredPermission))) && (!item.requiredAnyPermissions || (user && item.requiredAnyPermissions.some((permission) => hasPermission(user, permission))))),
    }))
    .filter((group) => group.items.length > 0)
  const availableNavItems = availableNavGroups.flatMap((group) => group.items)
  const pageTitle = availableNavItems.find((item) => item.key === activePage)?.label ?? 'Dashboard'

  if (authState === 'checking') {
    return <SessionLoader />
  }

  if (!user) {
    return (
      <>
        <DeploymentBanner />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  const adminRoles = ['super-admin', 'school-admin', 'finance']
  const elevatedTeacherAccess = user.permissions.some((permission) => ['employees.view', 'attendance.view_school', 'assessments.manage_school', 'teaching_assignments.view'].includes(permission))
  if (!user.roles.some((role) => adminRoles.includes(role)) && !elevatedTeacherAccess) {
    return (
      <main className="admin-access-unavailable">
        <h1>Admin access unavailable</h1>
        <p>This account belongs to the Community App and cannot enter the Admin Panel.</p>
        <button type="button" className="primary-button" onClick={() => void handleLogout()}>Logout</button>
      </main>
    )
  }

  const renderPage = () => {
    if (activePage === 'calendar') {
      if (user.school_id === null) {
        return (
          <section className="page-stack">
            <PageHeader eyebrow="Overview" title="Calendar" />
            <Message tone="info">A school must be selected before school-scoped calendar data can be loaded.</Message>
          </section>
        )
      }

      return (
        <CalendarPage
          schoolId={dashboard?.school.id ?? user.school_id}
          permissions={user.permissions}
          onUnauthorized={handleUnauthorized}
        />
      )
    }

    if (activePage === 'students') {
      return (
        <StudentsPage
          key={focusedStudentId ?? 'students'}
          user={user}
          onUnauthorized={handleUnauthorized}
          initialStudentId={focusedStudentId}
          detailReturn={
            classReturnContext
              ? { label: `Back to ${classReturnContext.name}`, onReturn: returnToClass }
              : undefined
          }
        />
      )
    }

    if (activePage === 'classes') {
      return (
        <ClassesPage
          permissions={user.permissions}
          initialClassId={classReturnContext?.id}
          onOpenStudent={openClassStudentDetail}
          onOpenAttendance={openClassAttendance}
          onUnauthorized={handleUnauthorized}
        />
      )
    }

    if (activePage === 'schedule') {
      return <SchedulePage />
    }

    if (activePage === 'parents') {
      return <ParentsPage />
    }

    if (activePage === 'employees') {
      return <StaffPage permissions={user.permissions} currentUserId={user.id} />
    }

    if (activePage === 'fees') {
      return <FeeCataloguePage canManage={hasPermission(user, 'fee_items.manage')} schoolId={dashboard?.school.id ?? user.school_id} onUnauthorized={handleUnauthorized} />
    }

    if (activePage === 'fee-record') {
      return <FeeRecordSummaryPage user={user} onUnauthorized={handleUnauthorized} onOpenStudent={openStudentDetail} />
    }

    if (activePage === 'audit') {
      return <AuditTrailPage onUnauthorized={handleUnauthorized} />
    }

    if (activePage === 'attendance') {
      return (
        <AttendanceHubPage
          permissions={user.permissions}
          initialClassId={attendanceClassId}
          onOpenStudent={openClassStudentDetail}
          onUnauthorized={handleUnauthorized}
        />
      )
    }

    if (activePage === 'application-logs') {
      return <ApplicationLogsPage onUnauthorized={handleUnauthorized} />
    }

    if (activePage === 'moderation') {
      return <UgcModerationPage />
    }

    if (activePage === 'settings') {
      return <SettingsWorkspace user={user} dashboard={dashboard} onNavigate={(page) => setActivePage(page)} />
    }

    return (
      <>
        {user.school_id === null && (
          <Message tone="info">A school must be selected before school-scoped dashboard data can be loaded.</Message>
        )}
        <DashboardPage dashboard={dashboard} apiState={apiState} user={user} setActivePage={setActivePage} onRefresh={() => void loadDashboard(user)} />
      </>
    )
  }

  return (
    <>
      <DeploymentBanner />
      <AdminShell
        activePage={activePage}
        pageTitle={pageTitle}
        contextText={dashboard?.school.name ?? (user.school_id === null ? 'School selection required' : 'School ERP')}
        navGroups={availableNavGroups}
        apiState={apiState}
        user={user}
        onSelectPage={handleSelectPage}
        onLogout={() => void handleLogout()}
      >
        {renderPage()}
      </AdminShell>
    </>
  )
}

export default App
