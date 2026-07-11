import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { ApiError, apiRequest } from './api'
import misLogo from './assets/mis-logo.jpg'
import './App.css'

type PageKey =
  | 'dashboard'
  | 'students'
  | 'parents'
  | 'fees'
  | 'fee-record'
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
type FeeAgreementItemClassification = 'recurring' | 'optional_service' | 'one_time' | 'manual'
type BillingFrequency = 'monthly' | 'termly' | 'yearly' | 'custom' | 'one_time'
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
    classification: FeeAgreementItemClassification | null
    billing_frequency: BillingFrequency | null
    billing_months: number[] | null
    requires_preview_confirmation: boolean
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
  classification: FeeAgreementItemClassification
  billing_frequency: BillingFrequency
  billing_months: number[]
  requires_preview_confirmation: boolean
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

type OutstandingChargeCell = {
  id: number
  student_id: number
  fee_agreement_id: number
  fee_agreement_item_id: number | null
  fee_item_id: number | null
  academic_year: string
  billing_month: string
  fee_record_category: string
  fee_code: string | null
  description: string
  expected_amount: number
  paid_amount: number
  outstanding_amount: number
  billing_status: string
  collection_status: string
  charge_origin: string
  source_type: string | null
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

type FeeRecordCategory = 'SF+MF' | 'TR' | 'MP' | 'HS' | 'HT' | 'PAYMENT' | 'OTHERS'

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

type PaymentAllocationDraft = {
  key: string
  allocation_type: 'charge' | 'manual'
  fee_record_charge_id: number | null
  fee_item_id: number | null
  fee_agreement_item_id: number | null
  fee_code: string | null
  billing_month: string | null
  fee_record_category: string | null
  outstanding_amount: number | null
  description: string
  amount: string
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

type ManualFeeRecordChargeForm = {
  academic_year: string
  billing_month: string
  fee_record_category: FeeRecordCategory
  description: string
  expected_amount: string
  remark: string
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
  { key: 'fee-record', label: 'Fee Record', icon: ClipboardList },
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
  { item: 'Tuition Fee', type: 'Mandatory Fee Item', amount: 'Configured per agreement', status: 'Configured in Fee Agreement' },
  { item: 'Misc Fee', type: 'Mandatory Fee Item', amount: 'Configured per agreement', status: 'Configured in Fee Agreement' },
  { item: 'Transport', type: 'Optional Fee Item', amount: 'Configured per agreement', status: 'Optional' },
]

const reports = [
  { name: 'Daily Collection', owner: 'Finance', period: 'Future phase', output: 'Planned' },
  { name: 'Outstanding Fees', owner: 'Admin', period: 'Future phase', output: 'Use Fee Record' },
  { name: 'Student Ledger', owner: 'Finance', period: 'Future phase', output: 'Planned' },
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

const feeRecordCategories: Array<{ value: FeeRecordCategory; label: string }> = [
  { value: 'SF+MF', label: 'SF+MF' },
  { value: 'TR', label: 'TR' },
  { value: 'MP', label: 'MP' },
  { value: 'HS', label: 'HS' },
  { value: 'HT', label: 'HT' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OTHERS', label: 'Others' },
]

const monthShortLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const paymentPlanOptions: Array<{ value: PaymentPlan; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
]

const feeAgreementClassificationOptions: Array<{ value: FeeAgreementItemClassification; label: string }> = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'optional_service', label: 'Optional Service' },
  { value: 'one_time', label: 'One-time' },
  { value: 'manual', label: 'Manual' },
]

const billingFrequencyOptions: Array<{ value: BillingFrequency; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
  { value: 'one_time', label: 'One-time' },
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

function paymentStatusClass(status: PaymentStatus) {
  if (status === 'verified') {
    return 'paid'
  }

  if (status === 'voided') {
    return 'danger'
  }

  return 'partial'
}

function receiptStatusClass(status: ReceiptStatus) {
  return status === 'issued' ? 'paid' : 'danger'
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
    allocation_type: 'manual',
    fee_record_charge_id: null,
    fee_item_id: null,
    fee_agreement_item_id: null,
    fee_code: null,
    billing_month: null,
    fee_record_category: null,
    outstanding_amount: null,
    description: '',
    amount: '',
  }
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

function defaultManualFeeRecordChargeForm(academicYear = '2026'): ManualFeeRecordChargeForm {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

  return {
    academic_year: academicYear,
    billing_month: `${academicYear}-${currentMonth}`,
    fee_record_category: 'OTHERS',
    description: '',
    expected_amount: '',
    remark: '',
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

  return {
    academic_year: agreement.academic_year,
    payment_plan: agreement.payment_plan,
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
  initialStudentId,
}: {
  user: CurrentUser
  onUnauthorized: () => void
  initialStudentId?: number | null
}) {
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null)
  const [pendingInitialStudentId, setPendingInitialStudentId] = useState<number | null>(initialStudentId ?? null)
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
  const [outstandingCharges, setOutstandingCharges] = useState<OutstandingChargeCell[]>([])
  const [outstandingChargesYear, setOutstandingChargesYear] = useState('')
  const [isLoadingOutstandingCharges, setIsLoadingOutstandingCharges] = useState(false)
  const [outstandingChargeError, setOutstandingChargeError] = useState('')
  const [studentListFeeRecordSummaries, setStudentListFeeRecordSummaries] = useState<FeeRecordSummaryRow[]>([])
  const [studentListFeeRecordSummaryYear, setStudentListFeeRecordSummaryYear] = useState('')
  const [isLoadingStudentListFeeRecordSummary, setIsLoadingStudentListFeeRecordSummary] = useState(false)
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
  const [manualChargeForm, setManualChargeForm] = useState<ManualFeeRecordChargeForm>(defaultManualFeeRecordChargeForm())
  const [manualChargeErrors, setManualChargeErrors] = useState<ValidationErrors>()
  const [isSavingManualCharge, setIsSavingManualCharge] = useState(false)
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<number | null>(null)
  const [verifyForm, setVerifyForm] = useState<VerifyPaymentForm>(defaultVerifyForm())
  const [verifyErrors, setVerifyErrors] = useState<ValidationErrors>()
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidErrors, setVoidErrors] = useState<ValidationErrors>()
  const [isVoidingPayment, setIsVoidingPayment] = useState(false)
  const [receipts, setReceipts] = useState<StudentReceipt[]>([])
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<StudentReceipt | null>(null)
  const [printedAt, setPrintedAt] = useState('')
  const [generatingPaymentId, setGeneratingPaymentId] = useState<number | null>(null)
  const [generatePaidBy, setGeneratePaidBy] = useState('')
  const [generateErrors, setGenerateErrors] = useState<ValidationErrors>()
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false)
  const [voidingReceiptId, setVoidingReceiptId] = useState<number | null>(null)
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
  const canActivateFeeRecord = hasPermission(user, 'fee_record.generate') || hasPermission(user, 'fee_record.manage')
  const canManageFeeRecord = hasPermission(user, 'fee_record.manage')
  const canViewPayments = hasPermission(user, 'payments.view')
  const canCreatePayments = hasPermission(user, 'payments.create')
  const canVerifyPayments = hasPermission(user, 'payments.verify')
  const canVoidPayments = hasPermission(user, 'payments.void')
  const canViewReceipts = hasPermission(user, 'receipts.view')
  const canCreateReceipts = hasPermission(user, 'receipts.create')
  const canVoidReceipts = hasPermission(user, 'receipts.void')
  const canPrintReceipts = hasPermission(user, 'receipts.print')
  const currentFeeAgreement = feeAgreements.find((agreement) => agreement.is_current) ?? null
  const paymentAllocationTotal = allocationTotal(paymentForm.allocations)
  const paymentAmountCents = moneyToCents(paymentForm.amount)
  const allocationTotalCents = moneyToCents(paymentAllocationTotal)
  const selectedChargeIds = new Set(
    paymentForm.allocations
      .map((allocation) => allocation.fee_record_charge_id)
      .filter((id): id is number => id !== null),
  )
  const groupedOutstandingCharges = useMemo(() => {
    const groups = new Map<string, Map<string, OutstandingChargeCell[]>>()

    outstandingCharges.forEach((charge) => {
      if (!groups.has(charge.billing_month)) {
        groups.set(charge.billing_month, new Map())
      }

      const monthGroup = groups.get(charge.billing_month)!

      if (!monthGroup.has(charge.fee_record_category)) {
        monthGroup.set(charge.fee_record_category, [])
      }

      monthGroup.get(charge.fee_record_category)!.push(charge)
    })

    return Array.from(groups.entries()).map(([billingMonth, categories]) => ({
      billingMonth,
      categories: Array.from(categories.entries()).map(([category, charges]) => ({
        category,
        charges,
      })),
    }))
  }, [outstandingCharges])
  const previewBlockedByWarnings = Boolean(feeRecordPreview?.needs_confirmation || feeRecordPreview?.warnings.length)
  const canActivateCurrentPreview = Boolean(
    canActivateFeeRecord &&
      feeRecordPreview &&
      feeRecordPreview.charges.length > 0 &&
      !previewBlockedByWarnings,
  )
  const outstandingStatusLabel =
    outstandingChargesYear === feeRecordAcademicYear
      ? `${outstandingCharges.length} outstanding charge cell${outstandingCharges.length === 1 ? '' : 's'}`
      : 'Outstanding charge status not loaded'
  const currentFeeRecordSummary =
    studentFeeRecordSummaryYear === feeRecordAcademicYear ? studentFeeRecordSummary : null
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
            totalOutstanding: totals.totalOutstanding + (summary?.total_outstanding ?? 0),
          }
        },
        { totalExpected: 0, totalOutstanding: 0 },
      ),
    [studentListFeeRecordSummaryByStudentId, students],
  )
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

  const loadStudentListFeeRecordSummary = async (academicYear = feeRecordAcademicYear) => {
    if (!canViewFeeRecord) {
      setStudentListFeeRecordSummaries([])
      setStudentListFeeRecordSummaryYear('')
      return
    }

    setIsLoadingStudentListFeeRecordSummary(true)

    try {
      const params = new URLSearchParams({ academic_year: academicYear })
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
      await loadStudentListFeeRecordSummary(feeRecordAcademicYear)

      if (pendingInitialStudentId) {
        const studentId = pendingInitialStudentId
        setPendingInitialStudentId(null)
        await loadStudentDetail(studentId)
      }
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
      handleApiError(detailError)
    }
  }

  const loadFeeAgreementData = async (studentId: number) => {
    try {
      const agreementsResponse = await apiRequest<{ data: FeeAgreement[] }>(`/students/${studentId}/fee-agreements`)
      setFeeAgreements(agreementsResponse.data)
      setShowFeeAgreementForm(false)
      setFeeAgreementErrors(undefined)
      setFeeRecordPreview(null)
      setFeeRecordPreviewError('')

      const activeAgreement = agreementsResponse.data.find((agreement) => agreement.is_current)

      if (activeAgreement) {
        setFeeRecordAcademicYear(activeAgreement.academic_year)
        setManualChargeForm(defaultManualFeeRecordChargeForm(activeAgreement.academic_year))
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
        setManualChargeForm(defaultManualFeeRecordChargeForm())
        setShowManualChargeForm(false)
        setManualChargeErrors(undefined)
      }

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
      await previewFeeRecordCharges()
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

  const updateManualChargeForm = (field: keyof ManualFeeRecordChargeForm, value: string) => {
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
      setManualChargeForm(defaultManualFeeRecordChargeForm(manualChargeForm.academic_year))
      await loadOutstandingCharges(selectedStudent.id, response.data.academic_year)
      setMessage(`Added manual charge ${response.data.description} for ${formatCurrency(response.data.expected_amount)}.`)
    } catch (manualChargeError) {
      if (manualChargeError instanceof ApiError && manualChargeError.status === 422) {
        setManualChargeErrors(manualChargeError.errors)
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
    field: keyof Pick<
      FeeAgreementItemDraft,
      'enabled' | 'amount' | 'description' | 'classification' | 'billing_frequency' | 'requires_preview_confirmation'
    >,
    value: string | boolean,
  ) => {
    setFeeAgreementForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.fee_item_id === feeItemId
          ? {
              ...item,
              [field]: value,
              ...(field === 'classification' && value === 'one_time'
                ? { billing_frequency: 'one_time' as BillingFrequency, requires_preview_confirmation: true }
                : {}),
              ...(field === 'billing_frequency' && value === 'monthly' ? { billing_months: [] } : {}),
            }
          : item,
      ),
    }))
  }

  const toggleFeeAgreementItemBillingMonth = (feeItemId: number, month: number) => {
    setFeeAgreementForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.fee_item_id !== feeItemId) {
          return item
        }

        const hasMonth = item.billing_months.includes(month)
        const billing_months = hasMonth
          ? item.billing_months.filter((selectedMonth) => selectedMonth !== month)
          : [...item.billing_months, month].sort((left, right) => left - right)

        return {
          ...item,
          billing_months,
        }
      }),
    }))
  }

  const validateFeeAgreementBillingConfig = (items: FeeAgreementItemDraft[]): ValidationErrors => {
    return items.reduce<ValidationErrors>((errors, item, index) => {
      const monthCount = item.billing_months.length

      if ((item.billing_frequency === 'termly' || item.billing_frequency === 'custom') && monthCount === 0) {
        errors[`items.${index}.billing_months`] = ['Billing months are required for termly and custom billing.']
      }

      if ((item.billing_frequency === 'yearly' || item.billing_frequency === 'one_time') && monthCount !== 1) {
        errors[`items.${index}.billing_months`] = ['Yearly and one-time billing require exactly one billing month.']
      }

      return errors
    }, {})
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
    const nextForm = defaultPaymentForm(currentFeeAgreement)
    setPaymentForm(nextForm)
    setPaymentErrors(undefined)
    setOutstandingCharges([])
    setOutstandingChargeError('')
    setShowPaymentForm(true)

    if (selectedStudent) {
      void loadOutstandingCharges(selectedStudent.id, nextForm.academic_year)
    }
  }

  const updatePaymentForm = (field: keyof Omit<PaymentForm, 'allocations'>, value: string) => {
    setPaymentForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'academic_year' ? { allocations: current.allocations.filter((allocation) => allocation.allocation_type === 'manual') } : {}),
    }))

    if (field === 'academic_year' && selectedStudent) {
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
      allocations: [
        ...current.allocations,
        {
          key: draftKey(),
          allocation_type: 'charge' as const,
          fee_record_charge_id: charge.id,
          fee_item_id: charge.fee_item_id,
          fee_agreement_item_id: charge.fee_agreement_item_id,
          fee_code: charge.fee_code,
          billing_month: charge.billing_month,
          fee_record_category: charge.fee_record_category,
          outstanding_amount: charge.outstanding_amount,
          description: charge.description,
          amount: String(charge.outstanding_amount),
        },
      ],
      amount: String(allocationTotal(current.allocations) + charge.outstanding_amount),
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
      allocations: current.allocations.filter((allocation) => allocation.key !== key),
      amount: String(allocationTotal(current.allocations.filter((allocation) => allocation.key !== key)) || ''),
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
      }
      handleApiError(voidReceiptError)
    } finally {
      setIsVoidingReceipt(false)
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
          <strong>
            {!canViewFeeRecord
              ? 'No access'
              : isLoadingStudentListFeeRecordSummary
                ? 'Loading...'
                : `${formatCurrency(studentListFeeTotals.totalExpected)} / ${formatCurrency(
                    studentListFeeTotals.totalOutstanding,
                  )}`}
          </strong>
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
              {students.map((student) => {
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
                      <span className={`badge ${statusClass(student.status)}`}>{formatStatus(student.status)}</span>
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
              {!isLoading && students.length === 0 && (
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
                    const enabledItemIndex = feeAgreementForm.items.filter((candidate) => candidate.enabled).findIndex((candidate) => candidate.fee_item_id === item.fee_item_id)
                    const monthError =
                      enabledItemIndex >= 0
                        ? formatValidationError(feeAgreementErrors, `items.${enabledItemIndex}.billing_months`)
                        : undefined

                    return (
                      <div className="agreement-item-row" key={item.fee_item_id}>
                        <div className="agreement-item-main">
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

                        {item.enabled && (
                          <div className="agreement-billing-config">
                            <label className="form-field">
                              Charge Type
                              <select
                                value={item.classification}
                                onChange={(event) =>
                                  updateFeeAgreementItem(item.fee_item_id, 'classification', event.target.value as FeeAgreementItemClassification)
                                }
                              >
                                {feeAgreementClassificationOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              Billing Pattern
                              <select
                                value={item.billing_frequency}
                                onChange={(event) =>
                                  updateFeeAgreementItem(item.fee_item_id, 'billing_frequency', event.target.value as BillingFrequency)
                                }
                              >
                                {billingFrequencyOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="checkbox-line billing-confirmation-line">
                              <input
                                type="checkbox"
                                checked={item.requires_preview_confirmation}
                                onChange={(event) => updateFeeAgreementItem(item.fee_item_id, 'requires_preview_confirmation', event.target.checked)}
                              />
                              Preview confirmation
                            </label>
                            <div className="billing-month-selector">
                              <span>{item.billing_frequency === 'monthly' ? 'Billing months override' : 'Billing months'}</span>
                              <div className="billing-month-options">
                                {monthShortLabels.map((label, monthIndex) => {
                                  const month = monthIndex + 1

                                  return (
                                    <label className={item.billing_months.includes(month) ? 'selected' : ''} key={label}>
                                      <input
                                        type="checkbox"
                                        checked={item.billing_months.includes(month)}
                                        onChange={() => toggleFeeAgreementItemBillingMonth(item.fee_item_id, month)}
                                      />
                                      {label}
                                    </label>
                                  )
                                })}
                              </div>
                              {monthError && <small>{monthError}</small>}
                            </div>
                          </div>
                        )}
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

          <section className="fee-record-charge-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Fee Record</p>
                <h2>Charge Preview and Activation</h2>
              </div>
              <span className={`badge ${outstandingCharges.length > 0 ? 'partial' : 'neutral'}`}>{outstandingStatusLabel}</span>
            </div>

            {!canViewFeeRecord && <Message tone="info">You do not have permission to view Fee Record charges.</Message>}
            {feeRecordPreviewError && <Message tone="error">{feeRecordPreviewError}</Message>}

            {canViewFeeRecord && (
              <>
                <div className="fee-record-activation-bar">
                  <label className="form-field">
                    Academic Year
                    <input
                      value={feeRecordAcademicYear}
                      onChange={(event) => {
                        setFeeRecordAcademicYear(event.target.value)
                        setFeeRecordPreview(null)
                        setFeeRecordPreviewError('')
                      }}
                    />
                  </label>
                  <div className="fee-record-action-group">
                    <button className="secondary-action" onClick={() => void previewFeeRecordCharges()} disabled={isPreviewingFeeRecord}>
                      {isPreviewingFeeRecord ? 'Previewing...' : 'Preview Charges'}
                    </button>
                    {canActivateFeeRecord && (
                      <button
                        className="primary-action compact"
                        onClick={() => void activateFeeRecordCharges()}
                        disabled={!canActivateCurrentPreview || isActivatingFeeRecord}
                      >
                        {isActivatingFeeRecord ? 'Activating...' : 'Activate Charges'}
                      </button>
                    )}
                    <button
                      className="table-action"
                      onClick={() => selectedStudent && void loadOutstandingCharges(selectedStudent.id, feeRecordAcademicYear)}
                    >
                      View Outstanding
                    </button>
                    {canManageFeeRecord && (
                      <button
                        className="table-action"
                        onClick={() => {
                          setShowManualChargeForm((value) => !value)
                          setManualChargeErrors(undefined)
                        }}
                      >
                        {showManualChargeForm ? 'Close Manual Charge' : 'Add Manual Charge'}
                      </button>
                    )}
                  </div>
                </div>

                {!canActivateFeeRecord && (
                  <Message tone="info">Activation is hidden for this role. Users need fee_record.generate or fee_record.manage.</Message>
                )}

                {showManualChargeForm && canManageFeeRecord && (
                  <form className="manual-charge-form" onSubmit={submitManualCharge} noValidate>
                    <div className="payment-subheader">
                      <div>
                        <h3>Add Manual Charge</h3>
                        <p>Use this for one-time or ad-hoc charge cells such as Uniform, Books, Worksheet, PE, deposits, or old balances.</p>
                      </div>
                    </div>

                    <div className="form-grid">
                      <label className="form-field">
                        Academic Year
                        <input value={manualChargeForm.academic_year} onChange={(event) => updateManualChargeForm('academic_year', event.target.value)} />
                        {formatValidationError(manualChargeErrors, 'academic_year') && (
                          <small>{formatValidationError(manualChargeErrors, 'academic_year')}</small>
                        )}
                      </label>

                      <label className="form-field">
                        Billing Month
                        <input type="month" value={manualChargeForm.billing_month} onChange={(event) => updateManualChargeForm('billing_month', event.target.value)} />
                        {formatValidationError(manualChargeErrors, 'billing_month') && (
                          <small>{formatValidationError(manualChargeErrors, 'billing_month')}</small>
                        )}
                      </label>

                      <label className="form-field">
                        Category
                        <select
                          value={manualChargeForm.fee_record_category}
                          onChange={(event) => updateManualChargeForm('fee_record_category', event.target.value as FeeRecordCategory)}
                        >
                          {feeRecordCategories.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {formatValidationError(manualChargeErrors, 'fee_record_category') && (
                          <small>{formatValidationError(manualChargeErrors, 'fee_record_category')}</small>
                        )}
                      </label>

                      <label className="form-field">
                        Amount
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={manualChargeForm.expected_amount}
                          onChange={(event) => updateManualChargeForm('expected_amount', event.target.value)}
                        />
                        {formatValidationError(manualChargeErrors, 'expected_amount') && (
                          <small>{formatValidationError(manualChargeErrors, 'expected_amount')}</small>
                        )}
                      </label>

                      <label className="form-field wide">
                        Description
                        <input
                          value={manualChargeForm.description}
                          onChange={(event) => updateManualChargeForm('description', event.target.value)}
                          placeholder="Uniform, Books, Worksheet, PE, Application, Deposit, Enrolment, Old Balance"
                        />
                        {formatValidationError(manualChargeErrors, 'description') && (
                          <small>{formatValidationError(manualChargeErrors, 'description')}</small>
                        )}
                      </label>

                      <label className="form-field wide">
                        Remark
                        <textarea value={manualChargeForm.remark} onChange={(event) => updateManualChargeForm('remark', event.target.value)} />
                      </label>
                    </div>

                    <button className="primary-action compact" disabled={isSavingManualCharge}>
                      {isSavingManualCharge ? 'Adding...' : 'Add Manual Charge'}
                    </button>
                  </form>
                )}

                {feeRecordPreview?.warnings.length ? (
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

                {feeRecordPreview && (
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

                {outstandingChargesYear === feeRecordAcademicYear && (
                  <div className="fee-record-outstanding-strip">
                    <strong>{outstandingCharges.length}</strong>
                    <span>outstanding charge cells available for payment allocation in {feeRecordAcademicYear}</span>
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
              <form className="payment-form" onSubmit={submitPayment} noValidate>
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
                    Academic Year
                    <input
                      value={paymentForm.academic_year}
                      onChange={(event) => updatePaymentForm('academic_year', event.target.value)}
                    />
                  </label>

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
                    Paid By
                    <input
                      value={paymentForm.paid_by}
                      onChange={(event) => updatePaymentForm('paid_by', event.target.value)}
                    />
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
                      <h3>Outstanding Charge Cells</h3>
                      <p>
                        Select the exact month/category cells this payment clears.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => selectedStudent && void loadOutstandingCharges(selectedStudent.id, paymentForm.academic_year)}
                    >
                      Refresh
                    </button>
                  </div>

                  {formatValidationError(paymentErrors, 'allocations') && (
                    <Message tone="error">{formatValidationError(paymentErrors, 'allocations')}</Message>
                  )}
                  {outstandingChargeError && <Message tone="error">{outstandingChargeError}</Message>}
                  {isLoadingOutstandingCharges && <div className="empty-state">Loading outstanding charge cells...</div>}

                  {!isLoadingOutstandingCharges && groupedOutstandingCharges.length === 0 && (
                    <div className="empty-state">No outstanding charge cells found for {paymentForm.academic_year}.</div>
                  )}

                  <div className="charge-picker">
                    {groupedOutstandingCharges.map((monthGroup) => (
                      <section className="charge-month-group" key={monthGroup.billingMonth}>
                        <h4>{formatBillingMonth(monthGroup.billingMonth)}</h4>
                        {monthGroup.categories.map((categoryGroup) => (
                          <div className="charge-category-group" key={`${monthGroup.billingMonth}-${categoryGroup.category}`}>
                            <span>{categoryGroup.category}</span>
                            {categoryGroup.charges.map((charge) => {
                              const selected = selectedChargeIds.has(charge.id)

                              return (
                                <label className="charge-cell-row" key={charge.id}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(event) =>
                                      event.target.checked
                                        ? selectChargeAllocation(charge)
                                        : removePaymentAllocation(
                                            paymentForm.allocations.find((allocation) => allocation.fee_record_charge_id === charge.id)?.key ?? '',
                                          )
                                    }
                                  />
                                  <span>
                                    <strong>{charge.description}</strong>
                                    <small>
                                      {charge.fee_code ?? 'Manual'} / Outstanding {formatCurrency(charge.outstanding_amount)}
                                    </small>
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                </div>

                <div className="payment-allocation-block">
                  <div className="payment-subheader">
                    <div>
                      <h3>Selected Allocations</h3>
                      <p>
                        Allocated {formatCurrency(paymentAllocationTotal)} of {formatCurrency(Number(paymentForm.amount || 0))}
                      </p>
                    </div>
                    <button type="button" className="table-action" onClick={addPaymentAllocation}>
                      Add manual allocation (does not clear Fee Record outstanding)
                    </button>
                  </div>

                  <div className="allocation-rows">
                    {paymentForm.allocations.length === 0 && (
                      <div className="empty-state">
                        Select charge cells, or add a manual allocation only for legacy/unclassified payments.
                      </div>
                    )}

                    {paymentForm.allocations.map((allocation, index) => (
                      <div className={`allocation-row ${allocation.allocation_type}`} key={allocation.key}>
                        <div className="allocation-source-summary">
                          <span className={`badge ${allocation.allocation_type === 'charge' ? 'paid' : 'neutral'}`}>
                            {allocation.allocation_type === 'charge' ? 'Charge cell' : 'Manual allocation'}
                          </span>
                          <strong>{allocation.description || 'Manual allocation (does not clear Fee Record outstanding)'}</strong>
                          <small>
                            {allocation.allocation_type === 'charge'
                              ? `${allocation.billing_month} / ${allocation.fee_record_category} / Outstanding ${formatCurrency(
                                  allocation.outstanding_amount,
                                )}`
                              : 'Use only for legacy/unclassified payments. This will not reduce Fee Record charge cells.'}
                          </small>
                        </div>

                        {allocation.allocation_type === 'manual' && (
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
                        )}

                        <label className="form-field">
                          Amount
                          <input
                            type="number"
                            min="0"
                            max={allocation.outstanding_amount ?? undefined}
                            step="0.01"
                            value={allocation.amount}
                            onChange={(event) => updatePaymentAllocation(allocation.key, 'amount', event.target.value)}
                          />
                          {formatValidationError(paymentErrors, `allocations.${index}.amount`) && (
                            <small>{formatValidationError(paymentErrors, `allocations.${index}.amount`)}</small>
                          )}
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
                          <td>{payment.payment_date}</td>
                          <td>{payment.received_date ?? 'Not recorded'}</td>
                          <td>{formatStatus(payment.payment_method)}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>
                            <span className={`badge ${paymentStatusClass(payment.status)}`}>{formatStatus(payment.status)}</span>
                          </td>
                          <td>{payment.reference_no ?? 'Not recorded'}</td>
                          <td>{issuedReceipt ? issuedReceipt.receipt_no : 'No issued receipt'}</td>
                          <td>{payment.recorded_by?.name ?? 'Not recorded'}</td>
                          <td>{payment.verified_by?.name ?? 'Not verified'}</td>
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
                        {verifyingPaymentId === payment.id && (
                          <tr className="payment-action-row">
                            <td colSpan={10}>
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
                            <td colSpan={10}>
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
                      )
                    })}
                    {!isLoadingPayments && payments.length === 0 && (
                      <tr>
                        <td colSpan={10}>No payments recorded for this student yet.</td>
                      </tr>
                    )}
                    {isLoadingPayments && (
                      <tr>
                        <td colSpan={10}>Loading payments...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel receipt-workspace">
            <div className="panel-header no-print">
              <div>
                <p className="eyebrow">Receipts</p>
                <h2>Receipt History</h2>
              </div>
              {!canViewReceipts && <span className="permission-note">No receipt access</span>}
            </div>

            {!canViewReceipts && <Message tone="info">You do not have permission to view receipts.</Message>}

            {canViewReceipts && (
              <div className="table-wrap receipt-history no-print">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Paid By</th>
                      <th>Issued By</th>
                      <th>Void Details</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingReceipts && (
                      <tr>
                        <td colSpan={8}>Loading receipts...</td>
                      </tr>
                    )}
                    {!isLoadingReceipts && receipts.map((receipt) => (
                      <Fragment key={receipt.id}>
                        <tr>
                          <td>{receipt.receipt_no}</td>
                          <td>{receipt.receipt_date}</td>
                          <td>{formatCurrency(receipt.amount)}</td>
                          <td>
                            <span className={`badge ${receiptStatusClass(receipt.status)}`}>{formatStatus(receipt.status)}</span>
                          </td>
                          <td>{receipt.paid_by}</td>
                          <td>{receipt.issued_by?.name ?? 'Not recorded'}</td>
                          <td>
                            {receipt.status === 'voided'
                              ? `${receipt.voided_by?.name ?? 'Not recorded'} / ${receipt.void_reason ?? 'No reason'}`
                              : 'Not voided'}
                          </td>
                          <td>
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
                              {canVoidReceipts && receipt.status === 'issued' && (
                                <button className="table-action danger-action" onClick={() => beginVoidReceipt(receipt.id)}>
                                  Void
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {voidingReceiptId === receipt.id && (
                          <tr className="payment-action-row">
                            <td colSpan={8}>
                              <form className="inline-payment-form" onSubmit={(event) => submitVoidReceipt(event, receipt.id)}>
                                <label className="form-field wide">
                                  Void Reason
                                  <textarea value={receiptVoidReason} onChange={(event) => setReceiptVoidReason(event.target.value)} />
                                  {formatValidationError(receiptVoidErrors, 'void_reason') && (
                                    <small>{formatValidationError(receiptVoidErrors, 'void_reason')}</small>
                                  )}
                                  {formatValidationError(receiptVoidErrors, 'receipt') && (
                                    <small>{formatValidationError(receiptVoidErrors, 'receipt')}</small>
                                  )}
                                </label>
                                <div className="toolbar-actions">
                                  <button className="primary-action compact" disabled={isVoidingReceipt}>
                                    {isVoidingReceipt ? 'Voiding...' : 'Confirm Void Receipt'}
                                  </button>
                                  <button type="button" className="secondary-action" onClick={() => setVoidingReceiptId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {!isLoadingReceipts && receipts.length === 0 && (
                      <tr>
                        <td colSpan={8}>No receipts generated for this student yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReceipt && (
              <article className="receipt-print-scope">
                <div className="receipt-sheet">
                  <div className="receipt-brand">
                    <img src={misLogo} alt="MIS logo" />
                    <div>
                      <p className="eyebrow">Official Receipt</p>
                      <h2>Matahari International School</h2>
                      <span>Payment made is not refundable.</span>
                    </div>
                  </div>

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

          <section className="summary-grid three">
            <article>
              <span>Total Expected</span>
              <strong>{formatCurrency(totals.expected)}</strong>
            </article>
            <article>
              <span>Total Paid</span>
              <strong>{formatCurrency(totals.paid)}</strong>
            </article>
            <article className={totals.outstanding > 0 ? 'warning' : ''}>
              <span>Total Outstanding</span>
              <strong>{formatCurrency(totals.outstanding)}</strong>
            </article>
          </section>

          <section className={`panel fee-record-filters ${activeView === 'category-monthly' ? 'has-category' : ''}`}>
            <label className="form-field">
              Academic Year
              <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
            </label>
            {activeView === 'category-monthly' && (
              <label className="form-field">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value as FeeRecordCategory)}>
                  {feeRecordCategories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-field">
              Level Group
              <select value={levelGroup} onChange={(event) => setLevelGroup(event.target.value)}>
                <option value="">All level groups</option>
                {levelGroupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Student Status
              <select value={studentStatus} onChange={(event) => setStudentStatus(event.target.value as StudentStatus)}>
                {statusOptions
                  .filter((option) => option.value !== 'all')
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-field wide">
              Search
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student name or ID" />
            </label>
            <label className="toggle-field">
              <input type="checkbox" checked={outstandingOnly} onChange={(event) => setOutstandingOnly(event.target.checked)} />
              Outstanding only
            </label>
          </section>

          {activeView === 'summary' ? (
            <section className="panel fee-record-ledger">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Working ledger</p>
                  <h2>Read-only charge-cell summary</h2>
                </div>
                {isLoading && <span className="permission-note">Loading...</span>}
              </div>
              <p className="ledger-note">
                Balances come from Fee Record charge cells. Corrections happen through Fee Agreement, Payment, or Receipt flows.
              </p>

              <div className="table-wrap">
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
                          <span className={`badge ${statusClass(row.collection_status_summary)}`}>
                            {formatStatus(row.collection_status_summary)}
                          </span>
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
            </section>
          ) : (
            <section className="panel fee-record-ledger monthly-ledger">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Category monthly</p>
                  <h2>Read-only {category} month cells</h2>
                </div>
                {isLoading && <span className="permission-note">Loading...</span>}
              </div>
              <p className="ledger-note">
                Month cells aggregate charge cells by student, mapped category and billing month. The category mapper is temporary until real fee
                item codes are confirmed.
              </p>

              <div className="table-wrap">
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
            </section>
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
          <span>E {formatCurrency(cell.expected_amount)}</span>
          <span>P {formatCurrency(cell.paid_amount)}</span>
          <strong>O {formatCurrency(cell.outstanding_amount)}</strong>
          {cell.receipt_refs.length > 0 && <small>{cell.receipt_refs.join(', ')}</small>}
        </>
      )}
    </div>
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
        value: 'View Fee Record',
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
          <p>Use Fee Record for the working finance ledger; dashboard finance widgets remain future phase.</p>
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
  const [focusedStudentId, setFocusedStudentId] = useState<number | null>(null)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreNavigationFocusRef = useRef(false)

  const closeNavigation = useCallback(() => {
    if (isNarrowViewport && isNavOpen) {
      shouldRestoreNavigationFocusRef.current = true
    }

    setIsNavOpen(false)
  }, [isNavOpen, isNarrowViewport])

  const selectPage = (page: PageKey) => {
    setActivePage(page)
    closeNavigation()
  }

  useEffect(() => {
    document.body.classList.toggle('nav-open', isNavOpen)

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNavigation()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.classList.remove('nav-open')
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeNavigation, isNavOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')

    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      setIsNarrowViewport(event.matches)

      if (!event.matches) {
        setIsNavOpen(false)
      }
    }

    setIsNarrowViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleBreakpointChange)

    return () => mediaQuery.removeEventListener('change', handleBreakpointChange)
  }, [])

  useEffect(() => {
    if (!isNavOpen && isNarrowViewport && shouldRestoreNavigationFocusRef.current) {
      shouldRestoreNavigationFocusRef.current = false
      menuButtonRef.current?.focus()
    }
  }, [isNavOpen, isNarrowViewport])

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
      closeNavigation()
    }
  }

  const handleUnauthorized = () => {
    setUser(null)
    setAuthState('guest')
  }

  const openStudentDetail = (studentId: number) => {
    setFocusedStudentId(studentId)
    setActivePage('students')
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
      return <StudentsPage key={focusedStudentId ?? 'students'} user={user} onUnauthorized={handleUnauthorized} initialStudentId={focusedStudentId} />
    }

    if (activePage === 'parents') {
      return <ParentsPage />
    }

    if (activePage === 'fees') {
      return <FeesPage />
    }

    if (activePage === 'fee-record') {
      return <FeeRecordSummaryPage user={user} onUnauthorized={handleUnauthorized} onOpenStudent={openStudentDetail} />
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
      <button
        className="sidebar-backdrop"
        aria-label="Close navigation"
        tabIndex={isNavOpen ? 0 : -1}
        onClick={closeNavigation}
      />

      <aside
        aria-hidden={isNarrowViewport && !isNavOpen ? true : undefined}
        className={isNavOpen ? 'sidebar open' : 'sidebar'}
        id="main-navigation"
        inert={isNarrowViewport && !isNavOpen ? true : undefined}
      >
        <div className="sidebar-heading">
          <div className="brand">
            <img src={misLogo} alt="MIS logo" />
            <div>
              <strong>MIS</strong>
              <span>School ERP</span>
            </div>
          </div>
          <button className="icon-button drawer-close" aria-label="Close navigation" onClick={closeNavigation}>
            <X size={20} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                aria-current={activePage === item.key ? 'page' : undefined}
                aria-label={item.label}
                className={activePage === item.key ? 'nav-item active' : 'nav-item'}
                key={item.label}
                onClick={() => selectPage(item.key)}
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
          <button
            className="icon-button menu-button"
            aria-controls="main-navigation"
            aria-expanded={isNavOpen}
            aria-label="Open navigation"
            onClick={() => setIsNavOpen(true)}
            ref={menuButtonRef}
          >
            <Menu size={20} />
          </button>
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
