/**
 * Portal API client — typed fetch wrappers for the /api/v1/portal endpoints.
 * Uses the same session/CSRF auth as the Admin Panel.
 */

import { apiRequest } from '../api'

const BASE = '/v1/portal'

type PortalRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & { body?: unknown }

function portalRequest<T>(path: string, options: PortalRequestOptions = {}): Promise<T> {
  return apiRequest<T>(`${BASE}${path}`, options)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalChild {
  id: number
  student_no: string
  full_name: string
  status: string
  class: { id: number; name: string } | null
  can_view_finance: boolean
  can_view_academics: boolean
}

export interface GuardianMe {
  data: { id: number; full_name: string; phone: string | null; email: string | null } | null
  children: PortalChild[]
}

export interface OutstandingCharge {
  id: number
  fee_code: string
  description: string
  billing_month: string
  expected_amount: number
  paid_amount: number
  outstanding_amount: number
  billing_status: string
  collection_status: string
}

export interface ReceiptItem {
  fee_code: string
  description: string
  amount: number
}

export interface PortalReceipt {
  id: number
  receipt_no: string
  receipt_date: string
  amount: number
  paid_by: string | null
  payment_method: string | null
  status: string
  items: ReceiptItem[]
}

export interface PortalPayment {
  id: number
  payment_date: string
  amount: number
  paid_by: string | null
  payment_method: string | null
  status: string
  issued_receipt: { id: number; receipt_no: string; receipt_date: string; status: string } | null
}

export interface StudentMe {
  data: {
    id: number
    student_no: string
    full_name: string
    gender: string | null
    dob: string | null
    status: string
    class: { id: number; name: string } | null
  } | null
}

export interface SubjectEntry {
  subject_id: number | null
  subject_code: string | null
  subject_name: string | null
  teacher_name: string | null
}

export interface StudentEnrolment {
  id: number
  academic_year: { id: number; code: string; name: string } | null
  class: { id: number; name: string } | null
  starts_on: string | null
  status: string
  subjects: SubjectEntry[]
}

export interface PortalNotification {
  id: number
  type: string
  title: string
  body: string
  context_json: Record<string, unknown> | null
  read_at: string | null
  created_at: string | null
}

export interface NotificationListResponse {
  data: PortalNotification[]
  meta: { unread_count: number }
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export interface AttendanceRecord {
  id: number
  student_id?: number
  student_name?: string
  attendance_date?: string
  session_type?: string
  status: AttendanceStatus
  public_note: string | null
  class?: { id: number; name: string }
  corrected_at?: string | null
}

export interface AttendanceSession {
  id: number
  session_type: string
  attendance_date: string
  status: string
  academic_year_id: number
  class: { id: number; name: string }
  records: AttendanceRecord[]
}

export interface TeacherAssignment {
  id: number
  academic_year: { id: number; code: string }
  class: { id: number; name: string }
  subject: { id: number; code: string; name: string }
}

export interface TeacherStudent {
  id: number
  student_no: string
  full_name: string
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const portalApi = {
  getGuardianMe: () => portalRequest<GuardianMe>('/parent/me'),
  getChildOutstanding: (studentId: number, academicYear: string) =>
    portalRequest<{ data: OutstandingCharge[] }>(`/parent/children/${studentId}/outstanding?academic_year=${academicYear}`),
  getChildPayments: (studentId: number) =>
    portalRequest<{ data: PortalPayment[] }>(`/parent/children/${studentId}/payments`),
  getChildReceipts: (studentId: number) =>
    portalRequest<{ data: PortalReceipt[] }>(`/parent/children/${studentId}/receipts`),
  getChildAttendance: (studentId: number) =>
    portalRequest<{ data: AttendanceRecord[] }>(`/parent/children/${studentId}/attendance`),

  getStudentMe: () => portalRequest<StudentMe>('/student/me'),
  getStudentEnrolments: () => portalRequest<{ data: StudentEnrolment[] }>('/student/enrolments'),
  getStudentAttendance: () => portalRequest<{ data: AttendanceRecord[] }>('/student/attendance'),

  getTeacherAssignments: () => apiRequest<{ data: TeacherAssignment[] }>('/v1/teacher/teaching-assignments'),
  getTeacherStudents: (assignment: TeacherAssignment) =>
    apiRequest<{ data: TeacherStudent[] }>(`/v1/teacher/classes/${assignment.class.id}/students?academic_year_id=${assignment.academic_year.id}&subject_id=${assignment.subject.id}`),
  getDailyAttendance: (assignment: TeacherAssignment, attendanceDate: string) =>
    apiRequest<{ data: AttendanceSession | null }>(`/v1/teacher/attendance/daily?academic_year_id=${assignment.academic_year.id}&class_id=${assignment.class.id}&attendance_date=${attendanceDate}`),
  saveDailyAttendance: (assignment: TeacherAssignment, attendanceDate: string, records: Array<{ student_id: number; status: AttendanceStatus; public_note?: string | null }>, correctionReason?: string) =>
    apiRequest<{ data: AttendanceSession }>('/v1/teacher/attendance/daily', {
      method: 'POST',
      body: {
        academic_year_id: assignment.academic_year.id,
        class_id: assignment.class.id,
        attendance_date: attendanceDate,
        records,
        correction_reason: correctionReason || undefined,
      },
    }),

  getNotifications: () => portalRequest<NotificationListResponse>('/notifications'),
  markNotificationRead: (id: number) =>
    portalRequest<{ data: PortalNotification }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllNotificationsRead: () =>
    portalRequest<{ success: boolean }>('/notifications/mark-all-read', {
      method: 'POST',
    }),
}
