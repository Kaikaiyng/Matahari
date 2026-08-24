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
  academic_year: { id: number; code: string; name: string } | null
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
  student_no: string
  student_name: string
  amount: number
  amount_in_words: string
  paid_by: string | null
  payment_method: string | null
  payment_date: string
  received_date: string | null
  status: string
  issued_at: string | null
  voided_at: string | null
  void_reason: string | null
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

export type AttendanceStatus = 'unmarked' | 'present' | 'late' | 'absent' | 'excused'

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

export interface CampusAttendance {
  date: string
  current_status: 'on_campus' | 'off_campus' | 'no_record'
  first_entry: string | null
  last_exit: string | null
  events: Array<{ id: number; direction: 'entry' | 'exit'; method: string; occurred_at: string; device_name: string | null }>
}

export interface TeacherCampusAttendance {
  date: string
  summary: { recorded_students: number; on_campus: number; off_campus: number; late: number; early_leave: number }
  students: Array<{ student_id: number; student_name: string; class_name: string | null; current_status: 'on_campus' | 'off_campus' }>
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
export interface AcademicYearItem { id: number; code: string; name: string; is_current: boolean }

export type UpdateAudience = { type: 'school' } | { type: 'class'; class_id: number }
export interface PublishingContext { classes: Array<{ id: number; name: string }>; max_images: number; notify_default: true }
export interface AudiencePreview { recipient_count: number; class_ids: number[]; audience_label: string }
export interface SchoolUpdate {
  id: number
  body: string
  status: 'published' | 'hidden' | 'deleted'
  published_at: string | null
  author: { id: number; name: string }
  can_report: boolean
  can_edit: boolean
  can_withdraw: boolean
  audiences: Array<{ type: 'school' | 'class' | 'student'; class_id: number | null; student_id: number | null }>
  media: Array<{ id: number; type: string; name: string | null; url: string }>
  reaction_count: number
  reacted_by_me: boolean
  can_moderate: boolean
}

export interface CommunityPolicy { id: number; title: string; version?: string; public_path?: string; effective_at?: string; accepted: boolean }
export interface CommunityReportSummary { id: number; target_type: 'post'; reason_code: string; status: string; created_at: string | null }

export interface PublishedAssessmentResult { id: number; assessment_id: number; title: string; assessment_type: string; subject: string; score: number; max_score: number; grade_label: string | null; teacher_comment: string | null; published_at: string | null }
export interface ScheduleEntry { id: number; title: string; day_of_week: number; starts_at: string; ends_at: string; location: string | null; subject: string | null; teacher: string | null; effective_from: string | null; effective_to: string | null }
export interface ScheduleDueDate { assessment_id: number; title: string; subject: string; due_at: string }
export interface StudentSchedule { entries: ScheduleEntry[]; due_dates: ScheduleDueDate[] }
export interface FormalQuizAssignment { id: number; quiz_id: number; title: string; instructions: string | null; question_count: number; available_from: string | null; due_at: string | null; attempt_limit: number; attempts_used: number; latest_score: string | null }
export interface FormalQuizAttempt { id: number; title: string; questions: Array<{ id: number; question_type: 'multiple_choice' | 'true_false'; prompt: string; points: number; options: Array<{ id: number; option_text: string }> }> }
export interface AssessmentItem {
  id: number; title: string; assessment_type: string; max_score: number; status: string; due_at: string | null; published_at: string | null
  academic_year: { id: number; code: string }; subject: { id: number; code: string; name: string }; classes: Array<{ id: number; name: string }>
  results: Array<{ student_id: number; student_name: string; score: number | null; grade_label: string | null; teacher_comment: string | null; status: string }>
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const portalApi = {
  getSchoolUpdates: () => apiRequest<{ data: SchoolUpdate[] }>('/v1/community/posts'),
  getPublishingContext: () => apiRequest<{ data: PublishingContext }>('/v1/community/publishing-context'),
  previewUpdateAudience: (audiences: UpdateAudience[]) => apiRequest<{ data: AudiencePreview }>('/v1/community/audience-preview', { method: 'POST', body: { audiences } }),
  createSchoolUpdate: (body: string, audiences: UpdateAudience[], notifyAudience: boolean, files: File[] = []) => {
    const form = new FormData()
    form.append('body', body)
    form.append('notify_audience', notifyAudience ? '1' : '0')
    audiences.forEach((audience, index) => {
      form.append(`audiences[${index}][type]`, audience.type)
      if (audience.type === 'class') form.append(`audiences[${index}][class_id]`, String(audience.class_id))
    })
    files.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)).slice(0, 6).forEach((file) => form.append('media[]', file))
    return apiRequest<{ data: SchoolUpdate }>('/v1/community/posts', { method: 'POST', body: form })
  },
  updateSchoolUpdate: (postId: number, body: string) =>
    apiRequest<{ data: SchoolUpdate }>(`/v1/community/posts/${postId}`, {
      method: 'PUT',
      body: { body },
    }),
  toggleSchoolUpdateLike: (postId: number) => apiRequest<{ data: { post_id: number; reacted: boolean; reaction_count: number } }>(`/v1/community/posts/${postId}/reaction`, { method: 'POST' }),
  hideSchoolUpdate: (postId: number, reason: string) => apiRequest<{ success: boolean }>(`/v1/community/posts/${postId}/hide`, { method: 'POST', body: { reason } }),
  withdrawSchoolUpdate: (postId: number, reason = '') => apiRequest<{ success: boolean }>(`/v1/community/posts/${postId}`, { method: 'DELETE', body: { reason: reason || undefined } }),
  getCurrentCommunityPolicies: () => apiRequest<{ data: Record<string, CommunityPolicy> }>('/v1/community/policies/current'),
  acceptCommunityPolicy: (policyId: number) => apiRequest<{ data: { accepted: boolean } }>(`/v1/community/policies/${policyId}/accept`, { method: 'POST' }),
  reportSchoolUpdate: (postId: number, reasonCode: string, details: string) => apiRequest<{ data: { id: number; status: string } }>('/v1/community/reports', { method: 'POST', body: { target_type: 'post', target_id: postId, reason_code: reasonCode, details: details || null } }),
  getCommunityReports: () => apiRequest<{ data: CommunityReportSummary[] }>('/v1/community/reports/mine'),
  getGuardianMe: () => portalRequest<GuardianMe>('/parent/me'),
  getChildOutstanding: (studentId: number, academicYear: string) =>
    portalRequest<{ data: OutstandingCharge[] }>(`/parent/children/${studentId}/outstanding?academic_year=${academicYear}`),
  getChildPayments: (studentId: number) =>
    portalRequest<{ data: PortalPayment[] }>(`/parent/children/${studentId}/payments`),
  getChildReceipts: (studentId: number) =>
    portalRequest<{ data: PortalReceipt[] }>(`/parent/children/${studentId}/receipts`),
  getChildReceipt: (studentId: number, receiptId: number) =>
    portalRequest<{ data: PortalReceipt }>(`/parent/children/${studentId}/receipts/${receiptId}`),
  getChildAttendance: (studentId: number) =>
    portalRequest<{ data: AttendanceRecord[] }>(`/parent/children/${studentId}/attendance`),
  getChildCampusAttendance: (studentId: number) =>
    portalRequest<{ data: CampusAttendance }>(`/parent/children/${studentId}/campus-attendance`),
  getChildAssessmentResults: (studentId: number) => portalRequest<{ data: PublishedAssessmentResult[] }>(`/parent/children/${studentId}/assessment-results`),
  getChildSchedule: (studentId: number) => portalRequest<{ data: StudentSchedule }>(`/parent/children/${studentId}/schedule`),

  getStudentMe: () => portalRequest<StudentMe>('/student/me'),
  getStudentEnrolments: () => portalRequest<{ data: StudentEnrolment[] }>('/student/enrolments'),
  getStudentAssessmentResults: () => portalRequest<{ data: PublishedAssessmentResult[] }>('/student/assessment-results'),
  getStudentSchedule: () => portalRequest<{ data: StudentSchedule }>('/student/schedule'),
  getStudentQuizzes: () => portalRequest<{ data: FormalQuizAssignment[] }>('/student/quizzes'),
  startQuizAttempt: (assignmentId: number) => portalRequest<{ data: FormalQuizAttempt }>(`/student/quizzes/assignments/${assignmentId}/attempts`, { method: 'POST' }),
  submitQuizAttempt: (attemptId: number, answers: Array<{ question_id: number; option_id: number }>) => portalRequest<{ data: { id: number; status: string; score: number; max_score: number } }>(`/student/quizzes/attempts/${attemptId}/submit`, { method: 'POST', body: { answers } }),

  createFormalQuiz: (assignment: TeacherAssignment, title: string, prompt: string, options: string[], correctIndex: number) => apiRequest<{ data: { id: number } }>('/v1/quizzes', { method: 'POST', body: { academic_year_id: assignment.academic_year.id, subject_id: assignment.subject.id, class_ids: [assignment.class.id], title, questions: [{ question_type: options.length === 2 && options[0] === 'True' && options[1] === 'False' ? 'true_false' : 'multiple_choice', prompt, points: 1, options: options.map((option_text, index) => ({ option_text, is_correct: index === correctIndex })) }] } }),
  createQuizAssignment: (quizId: number, assignment: TeacherAssignment) => apiRequest<{ data: { id: number } }>(`/v1/quizzes/${quizId}/assignments`, { method: 'POST', body: { academic_year_id: assignment.academic_year.id, class_ids: [assignment.class.id], attempt_limit: 1 } }),
  publishQuizAssignment: (assignmentId: number) => apiRequest<{ data: unknown }>(`/v1/quizzes/assignments/${assignmentId}/publish`, { method: 'POST' }),

  getAssessments: () => apiRequest<{ data: AssessmentItem[] }>('/v1/assessments'),
  createAssessment: (assignment: TeacherAssignment, title: string, assessmentType: string, maxScore: number) => apiRequest<{ data: AssessmentItem }>('/v1/assessments', { method: 'POST', body: { academic_year_id: assignment.academic_year.id, subject_id: assignment.subject.id, class_ids: [assignment.class.id], title, assessment_type: assessmentType, max_score: maxScore } }),
  saveAssessmentResults: (assessmentId: number, results: Array<{ student_id: number; score: number; grade_label?: string; teacher_comment?: string }>) => apiRequest<{ data: AssessmentItem }>(`/v1/assessments/${assessmentId}/results`, { method: 'PUT', body: { results } }),
  publishAssessment: (assessmentId: number) => apiRequest<{ data: AssessmentItem }>(`/v1/assessments/${assessmentId}/publish`, { method: 'POST' }),

  getTeacherAssignments: () => apiRequest<{ data: TeacherAssignment[] }>('/v1/teacher/teaching-assignments'),
  getTeacherCampusAttendance: (date: string) => apiRequest<{ data: TeacherCampusAttendance }>(`/v1/teacher/attendance/campus-records?date=${date}`),
  getStaffAssignments: () => apiRequest<{ data: TeacherAssignment[] }>('/v1/teacher/school/teaching-assignments'),
  getStaffStudents: (assignment: TeacherAssignment) => apiRequest<{ data: TeacherStudent[] }>(`/v1/teacher/school/teaching-assignments/${assignment.id}/students`),
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
