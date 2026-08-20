import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  RefreshCw,
  Users,
  UserX,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../api'
import {
  DataPanel,
  ModalFrame,
  PageHeader,
  StatusBadge,
} from './AdminUi'

export type LevelGroup = 'kindergarten' | 'primary' | 'secondary' | 'stp'

export type SchoolClassOption = {
  id: number
  name: string
  level_group: LevelGroup
}

type ClassStudent = {
  id: number
  student_no: string
  full_name: string
  level_group: LevelGroup
  class: {
    id: number
    name: string
  } | null
  status: 'active' | 'withdraw' | 'graduate' | 'inactive'
}

export type AttendanceStatus = 'unmarked' | 'present' | 'late' | 'absent' | 'excused'

export interface AttendanceStudentRow {
  student_id: number
  student_no: string
  full_name: string
  gender?: string | null
  status: AttendanceStatus
  public_note?: string | null
  corrected_by?: number | null
  correction_reason?: string | null
  corrected_at?: string | null
}

export interface ClassAttendanceSummary {
  class_id: number
  class_name: string
  level_group: string
  enrolled_count: number
  is_submitted: boolean
  submitted_at: string | null
  counts: {
    present: number
    late: number
    absent: number
    excused: number
  }
}

export interface AttendanceOverviewData {
  attendance_date: string
  academic_year: {
    id: number
    name: string
  } | null
  totals: {
    attendance_rate: number
    total_enrolled: number
    recorded_count: number
    present: number
    late: number
    absent: number
    excused: number
  }
  classes: ClassAttendanceSummary[]
}

type ClassesPageProps = {
  permissions: string[]
  initialClassId?: number | null
  onOpenStudent: (studentId: number, schoolClass: SchoolClassOption) => void
  onUnauthorized: () => void
}

const levelGroups: Array<{ key: LevelGroup; label: string }> = [
  { key: 'kindergarten', label: 'Kindergarten' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'stp', label: 'STP' },
]

const getAttendanceLevelGroup = (levelGroup?: string, className?: string): LevelGroup => {
  const lg = (levelGroup || '').toLowerCase().trim()
  if (lg && ['kindergarten', 'primary', 'secondary', 'stp'].includes(lg)) {
    return lg as LevelGroup
  }
  const name = (className || '').toUpperCase().trim()
  if (name === 'KINDERGARTEN') return 'kindergarten'
  if (['MA1', 'MB1', 'MC1', 'MD1', 'ME1', 'MF1'].includes(name)) return 'primary'
  if (['MP1', 'MQ1', 'MR1', 'MS1', 'MT1'].includes(name)) return 'secondary'
  if (name === 'STP') return 'stp'
  return 'primary'
}

const todayString = () => new Date().toISOString().split('T')[0]

export function ClassesPage({
  permissions,
  initialClassId = null,
  onOpenStudent,
  onUnauthorized,
}: ClassesPageProps) {
  const canView = permissions.includes('students.view')
  const canEdit = permissions.includes('students.create') || permissions.includes('students.update')

  const [classes, setClasses] = useState<SchoolClassOption[]>([])
  const [students, setStudents] = useState<ClassStudent[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(initialClassId)
  const [selectedDate, setSelectedDate] = useState<string>(todayString())
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster')

  const [overview, setOverview] = useState<AttendanceOverviewData | null>(null)
  const [classStudents, setClassStudents] = useState<AttendanceStudentRow[]>([])
  const [originalStudents, setOriginalStudents] = useState<AttendanceStudentRow[]>([])
  const [isClassSubmitted, setIsClassSubmitted] = useState<boolean>(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [currentAcademicYearId, setCurrentAcademicYearId] = useState<number | null>(null)

  const [isLoading, setIsLoading] = useState<boolean>(canView)
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  // Correction Reason Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false)
  const [correctionReason, setCorrectionReason] = useState<string>('')
  const [correctionError, setCorrectionError] = useState<string>('')

  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized

  // Load Directory & Attendance Overview
  const loadDirectory = useCallback(async (date: string) => {
    setIsLoading(true)
    setError('')

    try {
      const [classResponse, studentResponse, attendanceResponse] = await Promise.all([
        apiRequest<{ data: SchoolClassOption[] }>('/classes'),
        apiRequest<{ data: ClassStudent[] }>('/students?status=active'),
        apiRequest<{ data: AttendanceOverviewData }>(`/v1/admin/attendance/overview?attendance_date=${date}`).catch(
          () => ({ data: null }),
        ),
      ])

      setClasses(classResponse.data)
      setStudents(studentResponse.data.filter((student) => student.status === 'active'))
      if (attendanceResponse.data) {
        setOverview(attendanceResponse.data)
        if (attendanceResponse.data.academic_year) {
          setCurrentAcademicYearId(attendanceResponse.data.academic_year.id)
        }
      }
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        onUnauthorizedRef.current()
        return
      }

      setError(
        loadError instanceof ApiError
          ? loadError.message
          : 'Unable to load class directory. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load Class Attendance Sheet
  const loadClassSheet = useCallback(
    async (classId: number, date: string) => {
      setIsLoadingSheet(true)
      setError('')

      try {
        const res = await apiRequest<{
          data: {
            class: { id: number; name: string; level_group: string }
            academic_year_id: number | null
            attendance_date: string
            is_submitted: boolean
            submitted_at: string | null
            students: AttendanceStudentRow[]
          }
        }>(`/v1/admin/attendance/daily?class_id=${classId}&attendance_date=${date}`)

        setClassStudents(res.data.students)
        setOriginalStudents(JSON.parse(JSON.stringify(res.data.students)))
        setIsClassSubmitted(res.data.is_submitted)
        setSubmittedAt(res.data.submitted_at)
        if (res.data.academic_year_id) {
          setCurrentAcademicYearId(res.data.academic_year_id)
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorizedRef.current()
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load class attendance sheet.')
      } finally {
        setIsLoadingSheet(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (canView) {
      void loadDirectory(selectedDate)
    }
  }, [canView, selectedDate, loadDirectory])

  useEffect(() => {
    if (canView && selectedClassId) {
      void loadClassSheet(selectedClassId, selectedDate)
    }
  }, [canView, selectedClassId, selectedDate, loadClassSheet])

  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null
  const selectedLevelGroup =
    levelGroups.find((group) => group.key === selectedClass?.level_group)?.label ?? ''

  const roster = useMemo(
    () => students.filter((student) => student.class?.id === selectedClassId),
    [selectedClassId, students],
  )

  // Changes detection for attendance
  const hasAttendanceChanges = useMemo(() => {
    if (classStudents.length === 0 || originalStudents.length === 0) return false
    return JSON.stringify(classStudents) !== JSON.stringify(originalStudents)
  }, [classStudents, originalStudents])

  // Filtered student list for search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return classStudents
    const query = search.toLowerCase()
    return classStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(query) ||
        s.student_no.toLowerCase().includes(query),
    )
  }, [classStudents, search])

  // Status counts for selected class
  const classStatusCounts = useMemo(() => {
    const counts = { unmarked: 0, present: 0, late: 0, absent: 0, excused: 0 }
    classStudents.forEach((s) => {
      if (s.status in counts) {
        counts[s.status as keyof typeof counts]++
      }
    })
    const markedTotal = counts.present + counts.late + counts.absent + counts.excused
    const rate = markedTotal > 0 ? Math.round(((counts.present + counts.late) / markedTotal) * 100) : 100
    return { ...counts, markedTotal, rate }
  }, [classStudents])

  const handleStatusChange = (studentId: number, newStatus: AttendanceStatus) => {
    setClassStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, status: newStatus } : s)),
    )
  }

  const handleNoteChange = (studentId: number, note: string) => {
    setClassStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, public_note: note } : s)),
    )
  }

  const handleMarkAllPresent = () => {
    setClassStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })))
  }

  const executeSaveAttendance = async (reason?: string) => {
    if (!selectedClassId) return
    if (!currentAcademicYearId) {
      setError('No active academic year is configured. Attendance cannot be submitted.')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    try {
      const payload: {
        academic_year_id: number
        class_id: number
        attendance_date: string
        records: Array<{
          student_id: number
          status: AttendanceStatus
          public_note?: string | null
        }>
        correction_reason?: string
      } = {
        academic_year_id: currentAcademicYearId,
        class_id: selectedClassId,
        attendance_date: selectedDate,
        records: classStudents.map((s) => ({
          student_id: s.student_id,
          status: s.status,
          public_note: s.public_note || null,
        })),
      }

      if (reason) {
        payload.correction_reason = reason
      }

      await apiRequest('/v1/admin/attendance/daily', {
        method: 'POST',
        body: payload,
      })

      setSuccessMessage(
        isClassSubmitted
          ? 'Attendance corrections recorded successfully.'
          : 'Daily attendance submitted successfully.',
      )
      setIsClassSubmitted(true)
      setShowCorrectionModal(false)
      setCorrectionReason('')
      setCorrectionError('')

      // Reload fresh state
      await Promise.all([
        loadClassSheet(selectedClassId, selectedDate),
        loadDirectory(selectedDate),
      ])
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) {
        onUnauthorizedRef.current()
        return
      }
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : 'Failed to save attendance. Please try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveClick = () => {
    if (isClassSubmitted && hasAttendanceChanges) {
      setShowCorrectionModal(true)
      return
    }
    void executeSaveAttendance()
  }

  if (!canView) {
    return (
      <div className="message-card error" role="alert">
        You do not have permission to view classes.
      </div>
    )
  }

  return (
    <section className="page-stack classes-page">
      <PageHeader
        eyebrow="People"
        title="Classes"
        description="Browse class directory, manage active student rosters, and record daily attendance."
      />

      {error && (
        <div className="message-card error" role="alert">
          <span>{error}</span>
          <button
            className="secondary-action compact"
            onClick={() => void loadDirectory(selectedDate)}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="message-card success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="dismiss-btn"
            onClick={() => setSuccessMessage('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              marginLeft: 'auto',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Selected Class Detail View */}
      {selectedClass ? (
        <DataPanel
          eyebrow={selectedLevelGroup}
          title={selectedClass.name}
          action={
            <button
              className="secondary-action compact"
              onClick={() => {
                setSelectedClassId(null)
                setSearch('')
                setError('')
                setSuccessMessage('')
              }}
            >
              <ArrowLeft size={16} />
              Back to Classes
            </button>
          }
        >
          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '16px',
              paddingBottom: '8px',
            }}
          >
            <button
              type="button"
              className={`class-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid transparent',
                background:
                  activeTab === 'attendance' ? 'var(--brand-primary-soft, #fdf2f4)' : 'transparent',
                color: activeTab === 'attendance' ? 'var(--brand-primary, #c9254a)' : '#64748b',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={15} />
              <span>Daily Attendance</span>
            </button>
            <button
              type="button"
              className={`class-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveTab('roster')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid transparent',
                background:
                  activeTab === 'roster' ? 'var(--brand-primary-soft, #fdf2f4)' : 'transparent',
                color: activeTab === 'roster' ? 'var(--brand-primary, #c9254a)' : '#64748b',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <Users size={15} />
              <span>Student Roster ({roster.length})</span>
            </button>
          </div>

          {/* TAB 1: Daily Attendance */}
          {activeTab === 'attendance' && (
            <div className="tab-attendance-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Date toolbar and actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} style={{ color: '#64748b' }} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value)
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#ffffff',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => setSelectedDate(todayString())}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    Today
                  </button>

                  <span
                    className={`att-status-badge ${isClassSubmitted ? 'submitted' : 'pending'}`}
                    style={{ marginLeft: '4px' }}
                  >
                    {isClassSubmitted ? (
                      <>
                        <Check size={12} /> Submitted {submittedAt ? `(${new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> Pending Submission
                      </>
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {canEdit && classStudents.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={handleMarkAllPresent}
                        title="Mark all students as present"
                      >
                        <Check size={14} />
                        <span>Mark All Present</span>
                      </button>

                      <button
                        type="button"
                        className="primary-button compact"
                        disabled={isSaving || classStudents.length === 0 || !currentAcademicYearId}
                        onClick={handleSaveClick}
                      >
                        {isSaving ? (
                          <>
                            <Clock size={14} className="spin" />
                            <span>Saving...</span>
                          </>
                        ) : isClassSubmitted ? (
                          <>
                            <Edit3 size={14} />
                            <span>Save Changes</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Submit Attendance</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Class Attendance Stat Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                }}
              >
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ATTENDANCE RATE</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text, #0f172a)' }}>
                    {classStatusCounts.rate}%
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>PRESENT</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#065f46' }}>
                    {classStatusCounts.present}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                  <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>LATE</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#92400e' }}>
                    {classStatusCounts.late}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                  <div style={{ fontSize: '11px', color: 'var(--danger, #dc2626)', fontWeight: 600 }}>ABSENT</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--danger, #dc2626)' }}>
                    {classStatusCounts.absent}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>EXCUSED</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af' }}>
                    {classStatusCounts.excused}
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="table-wrap">
                <table className="student-list-table attendance-roster-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Student ID</th>
                      <th style={{ width: '220px' }}>Student Name</th>
                      <th style={{ minWidth: '320px' }}>Attendance Status</th>
                      <th>Public Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingSheet ? (
                      <tr className="table-state-row">
                        <td colSpan={4}>Loading attendance records...</td>
                      </tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr className="table-state-row">
                        <td colSpan={4}>No students enrolled in this class for the active academic year.</td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.student_id}>
                          <td data-label="Student ID">
                            <span style={{ fontWeight: 600, color: '#475569' }}>
                              {student.student_no}
                            </span>
                          </td>
                          <td data-label="Student Name" className="student-primary-cell">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: 'var(--brand-primary-soft, #fdf2f4)',
                                  color: 'var(--brand-primary, #c9254a)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}
                              >
                                {student.full_name.charAt(0)}
                              </div>
                              <span style={{ fontWeight: 600 }}>{student.full_name}</span>
                            </div>
                          </td>
                          <td data-label="Status">
                            <div className="att-status-toggle-group">
                              <button
                                type="button"
                                className={`att-toggle-btn unmarked ${
                                  student.status === 'unmarked' ? 'active' : ''
                                }`}
                                onClick={() => handleStatusChange(student.student_id, 'unmarked')}
                                disabled={!canEdit}
                                title="Not Arrived / Unmarked"
                              >
                                <Clock size={13} />
                                <span>Not Arrived</span>
                              </button>

                              <button
                                type="button"
                                className={`att-toggle-btn present ${
                                  student.status === 'present' ? 'active' : ''
                                }`}
                                onClick={() => handleStatusChange(student.student_id, 'present')}
                                disabled={!canEdit}
                              >
                                <Check size={13} />
                                <span>Present</span>
                              </button>

                              <button
                                type="button"
                                className={`att-toggle-btn late ${
                                  student.status === 'late' ? 'active' : ''
                                }`}
                                onClick={() => handleStatusChange(student.student_id, 'late')}
                                disabled={!canEdit}
                              >
                                <Clock size={13} />
                                <span>Late</span>
                              </button>

                              <button
                                type="button"
                                className={`att-toggle-btn absent danger ${
                                  student.status === 'absent' ? 'active' : ''
                                }`}
                                onClick={() => handleStatusChange(student.student_id, 'absent')}
                                disabled={!canEdit}
                              >
                                <UserX size={13} />
                                <span>Absent</span>
                              </button>

                              <button
                                type="button"
                                className={`att-toggle-btn excused ${
                                  student.status === 'excused' ? 'active' : ''
                                }`}
                                onClick={() => handleStatusChange(student.student_id, 'excused')}
                                disabled={!canEdit}
                              >
                                <AlertCircle size={13} />
                                <span>Excused</span>
                              </button>
                            </div>
                          </td>
                          <td data-label="Remarks">
                            <input
                              type="text"
                              placeholder="Reason / Note (optional)..."
                              value={student.public_note || ''}
                              onChange={(e) => handleNoteChange(student.student_id, e.target.value)}
                              disabled={!canEdit}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                background: canEdit ? '#ffffff' : '#f8fafc',
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Student Roster */}
          {activeTab === 'roster' && (
            <div className="tab-roster-content">
              <div className="table-wrap">
                <table className="student-list-table class-roster-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student) => (
                      <tr key={student.id}>
                        <td data-label="Student ID">{student.student_no}</td>
                        <td className="student-primary-cell" data-label="Student Name">
                          {student.full_name}
                        </td>
                        <td data-label="Status">
                          <StatusBadge tone="positive">Active</StatusBadge>
                        </td>
                        <td className="student-open-cell" data-label="Action">
                          <button
                            className="table-action"
                            aria-label={`View ${student.full_name}`}
                            onClick={() => onOpenStudent(student.id, selectedClass)}
                          >
                            <Eye size={15} />
                            View Student
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && roster.length === 0 && (
                      <tr className="table-state-row">
                        <td colSpan={4}>No active students in this class.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DataPanel>
      ) : (
        /* Class Directory Overview View */
        <DataPanel
          eyebrow="Directory"
          title="Class Directory"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} style={{ color: '#64748b' }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value)
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff',
                  }}
                />
              </div>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => void loadDirectory(selectedDate)}
                title="Refresh directory"
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>
          }
        >
          {isLoading && (
            <div className="empty-state" role="status">
              Loading classes...
            </div>
          )}
          {!isLoading && !error && classes.length === 0 && (
            <div className="empty-state">No classes are configured.</div>
          )}
          {!isLoading && classes.length > 0 && (
            <div className="class-directory-groups">
              {levelGroups.map((group) => {
                const groupClasses = classes.filter(
                  (schoolClass) =>
                    getAttendanceLevelGroup(schoolClass.level_group, schoolClass.name) === group.key,
                )

                if (groupClasses.length === 0) {
                  return null
                }

                return (
                  <section className="class-group" key={group.key}>
                    <h3>{group.label}</h3>
                    <div className="class-card-grid">
                      {groupClasses.map((schoolClass) => {
                        const count = students.filter(
                          (student) => student.class?.id === schoolClass.id,
                        ).length

                        const summary = overview?.classes?.find(
                          (c) => c.class_id === schoolClass.id,
                        )

                        const totalCount = summary
                          ? summary.counts.present +
                            summary.counts.late +
                            summary.counts.absent +
                            summary.counts.excused
                          : 0
                        const rate =
                          totalCount > 0
                            ? Math.round(
                                ((summary!.counts.present + summary!.counts.late) / totalCount) *
                                  100,
                              )
                            : 100

                        return (
                          <button
                            type="button"
                            className="class-card clickable"
                            data-testid={`class-card-${schoolClass.id}`}
                            aria-label={`View ${schoolClass.name}`}
                            key={schoolClass.id}
                            onClick={() => setSelectedClassId(schoolClass.id)}
                          >
                            <div className="class-card-top">
                              <div className="class-card-icon-box">
                                <Users size={18} aria-hidden="true" />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {summary && (
                                  <span
                                    className={`att-status-badge ${
                                      summary.is_submitted ? 'submitted' : 'pending'
                                    }`}
                                    style={{ fontSize: '10px', padding: '2px 6px' }}
                                  >
                                    {summary.is_submitted ? (
                                      <>
                                        <Check size={10} /> Submitted
                                      </>
                                    ) : (
                                      <>
                                        <Clock size={10} /> Pending
                                      </>
                                    )}
                                  </span>
                                )}
                                <ChevronRight size={16} className="class-card-arrow" aria-hidden="true" />
                              </div>
                            </div>

                            <div className="class-card-info">
                              <h4>{schoolClass.name}</h4>
                              <p>{group.label}</p>
                            </div>

                            <div
                              className="class-card-footer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <strong
                                className={`class-student-pill ${count > 0 ? 'has-students' : ''}`}
                              >
                                {count} Active student{count === 1 ? '' : 's'}
                              </strong>
                              {summary?.is_submitted && count > 0 && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#065f46',
                                    background: '#ecfdf5',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1fae5',
                                  }}
                                >
                                  {rate}%
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </DataPanel>
      )}

      {/* Correction Reason Modal */}
      {showCorrectionModal && (
        <ModalFrame
          title="Attendance Correction Audit Reason"
          description="You are modifying an attendance record that has already been submitted. Please provide an audited explanation for this correction."
          onClose={() => {
            setShowCorrectionModal(false)
            setCorrectionError('')
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCorrectionModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isSaving}
                onClick={() => {
                  if (!correctionReason.trim()) {
                    setCorrectionError('A correction reason is required.')
                    return
                  }
                  void executeSaveAttendance(correctionReason.trim())
                }}
              >
                {isSaving ? 'Submitting...' : 'Confirm & Save Correction'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label
              htmlFor="correction-reason-input"
              style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}
            >
              Reason for Correction <span style={{ color: 'var(--danger, #dc2626)' }}>*</span>
            </label>
            <textarea
              id="correction-reason-input"
              rows={3}
              placeholder="e.g. Student arrived late due to heavy traffic; updated after medical certificate received..."
              value={correctionReason}
              onChange={(e) => {
                setCorrectionReason(e.target.value)
                if (e.target.value.trim()) setCorrectionError('')
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: correctionError ? '1px solid var(--danger, #dc2626)' : '1px solid #cbd5e1',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            {correctionError && (
              <span style={{ fontSize: '12px', color: 'var(--danger, #dc2626)' }}>
                {correctionError}
              </span>
            )}
          </div>
        </ModalFrame>
      )}
    </section>
  )
}
