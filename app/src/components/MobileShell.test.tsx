import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobileShell } from './MobileShell'
import { ParentPortalView } from './ParentPortalView'
import { StudentPortalView } from './StudentPortalView'
import { TeacherPortalView } from './TeacherPortalView'
import { CommunityFeed } from './CommunityFeed'
import { portalApi } from '../api/portalApi'

// Mock the portalApi so components don't make real HTTP calls in tests
vi.mock('../api/portalApi', () => ({
  portalApi: {
    getSchoolUpdates: vi.fn().mockResolvedValue({ data: [{ id: 1, body: 'A real school update', published_at: '2026-08-13T12:00:00Z', author: { id: 4, name: 'Teacher Lim' }, audiences: [{ type: 'class', class_id: 1, student_id: null }], media: [], reaction_count: 2, reacted_by_me: false, can_report: true, can_edit: false, can_withdraw: false, can_moderate: false }] }),
    getPublishingContext: vi.fn().mockResolvedValue({ data: { classes: [{ id: 1, name: 'MB1' }], max_images: 6, notify_default: true } }),
    previewUpdateAudience: vi.fn().mockResolvedValue({ data: { recipient_count: 2, class_ids: [1], audience_label: 'MB1' } }),
    createSchoolUpdate: vi.fn(),
    updateSchoolUpdate: vi.fn(),
    toggleSchoolUpdateLike: vi.fn(),
    hideSchoolUpdate: vi.fn(),
    withdrawSchoolUpdate: vi.fn(),
    reportSchoolUpdate: vi.fn(),
    getCurrentCommunityPolicies: vi.fn().mockResolvedValue({ data: {
      terms: { id: 1, title: 'Terms of Use', accepted: true },
      community_standards: { id: 2, title: 'Community Standards', accepted: true },
    } }),
    getGuardianMe: vi.fn().mockResolvedValue({
      data: { id: 1, full_name: 'Rachel Wong', phone: null, email: null },
      children: [
        {
          id: 1,
          student_no: 'MIS-2026-001',
          full_name: 'Alyssa Tan',
          status: 'active',
          class: { id: 1, name: 'Grade MB1' },
          academic_year: { id: 1, code: '2026', name: '2026 Academic Year' },
          can_view_finance: true,
          can_view_academics: true,
        },
      ],
    }),
    getChildOutstanding: vi.fn().mockResolvedValue({ data: [] }),
    getChildPayments: vi.fn().mockResolvedValue({ data: [] }),
    getChildReceipts: vi.fn().mockResolvedValue({ data: [] }),
    getChildAttendance: vi.fn().mockResolvedValue({ data: [] }),
    getChildCampusAttendance: vi.fn().mockResolvedValue({ data: { date: '2026-08-23', current_status: 'no_record', first_entry: null, last_exit: null, events: [] } }),
    getChildAssessmentResults: vi.fn().mockResolvedValue({ data: [] }),
    getStudentMe: vi.fn().mockResolvedValue({
      data: {
        id: 1,
        student_no: 'MIS-2026-001',
        full_name: 'Alyssa Tan',
        gender: 'F',
        dob: '2010-05-20',
        status: 'active',
        class: { id: 1, name: 'Grade MB1' },
      },
    }),
    getStudentEnrolments: vi.fn().mockResolvedValue({ data: [] }),
    getStudentAssessmentResults: vi.fn().mockResolvedValue({ data: [] }),
    getStudentSchedule: vi.fn().mockResolvedValue({ data: { entries: [], due_dates: [] } }),
    getChildSchedule: vi.fn().mockResolvedValue({ data: { entries: [], due_dates: [] } }),
    getStudentQuizzes: vi.fn().mockResolvedValue({ data: [] }),
    startQuizAttempt: vi.fn(),
    submitQuizAttempt: vi.fn(),
    createFormalQuiz: vi.fn(),
    createQuizAssignment: vi.fn(),
    publishQuizAssignment: vi.fn(),
    getNotifications: vi.fn().mockResolvedValue({ data: [], meta: { unread_count: 0 } }),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    getTeacherAssignments: vi.fn().mockResolvedValue({ data: [] }),
    getTeacherCampusAttendance: vi.fn().mockResolvedValue({ data: { date: '2026-08-23', summary: { recorded_students: 0, on_campus: 0, off_campus: 0, late: 0, early_leave: 0 }, students: [] } }),
    getStaffAssignments: vi.fn().mockResolvedValue({ data: [] }),
    getStaffStudents: vi.fn().mockResolvedValue({ data: [] }),
    getTeacherStudents: vi.fn().mockResolvedValue({ data: [] }),
    getAssessments: vi.fn().mockResolvedValue({ data: [] }),
    createAssessment: vi.fn(),
    saveAssessmentResults: vi.fn(),
    publishAssessment: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileShell & Portal Views', () => {
  it('renders mobile shell with brand logo and environment badge', () => {
    render(
      <MobileShell activeTab="home" onTabChange={() => {}} userRole="parent" allowedRoles={['parent']} userName="Sarah Tan" environment="staging">
        <div>Content</div>
      </MobileShell>,
    )

    expect(screen.getByText('Preview environment')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Children' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
  })

  it('renders ParentPortalView home tab with welcome message (loading state)', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="home" onTabChange={() => {}} onLogout={() => {}} />)

    // Welcome greeting includes first name.
    expect(screen.getAllByText(/Rachel/)[0]).toBeDefined()
    expect(document.querySelector('.context-card')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'School Updates' })).toBeDefined()
  })

  it.each(['parent', 'student'] as const)('%s can read and Like school updates without comment controls', async (role) => {
    render(<CommunityFeed role={role} userName="Alyssa Tan" activeTab="home" />)

    expect(await screen.findByRole('heading', { name: 'School Updates' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comment/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/video|attachment|block user/i)).not.toBeInTheDocument()
  })

  it.each(['parent', 'student'] as const)('%s stays read-and-Like-only even if an update response includes management flags', async (role) => {
    vi.mocked(portalApi.getSchoolUpdates).mockResolvedValueOnce({ data: [{ id: 8, body: 'Official update', status: 'published', published_at: '2026-08-13T12:00:00Z', author: { id: 4, name: 'Teacher Lim' }, audiences: [{ type: 'school', class_id: null, student_id: null }], media: [], reaction_count: 0, reacted_by_me: false, can_report: true, can_edit: true, can_withdraw: true, can_moderate: true }] })
    render(<CommunityFeed role={role} userName="Alyssa Tan" activeTab="home" />)

    expect(await screen.findByRole('button', { name: 'Like' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update options' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Safety actions' })).not.toBeInTheDocument()
  })

  it('keeps attendance available without community.publish and hides every class publishing entry point', async () => {
    vi.mocked(portalApi.getTeacherAssignments).mockResolvedValueOnce({ data: [{ id: 7, academic_year: { id: 1, code: '2026' }, class: { id: 2, name: 'MB1' }, subject: { id: 3, code: 'ENG', name: 'English' } }] })
    vi.mocked(portalApi.getTeacherStudents).mockResolvedValue({ data: [] })
    render(<TeacherPortalView teacherName="Teacher Lim" activeTab="classes" onTabChange={() => {}} onLogout={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Open class MB1 English' }))
    expect(await screen.findByText('Check Daily Attendance')).toBeInTheDocument()
    expect(screen.queryByText('Publish Class Announcement')).not.toBeInTheDocument()
    expect(screen.queryByText('Class posts')).not.toBeInTheDocument()
  })

  it('lets an authorized Teacher choose whole-school or multiple classes, previews recipients, and defaults notification on', async () => {
    render(<TeacherPortalView teacherName="Teacher Lim" activeTab="create" onTabChange={() => {}} onLogout={() => {}} canPublishUpdates />)

    expect(await screen.findByRole('heading', { name: 'Create school update' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Whole school' })).toBeChecked()
    expect(screen.getByLabelText('Notify audience')).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Selected classes' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /MB1/ }))
    await waitFor(() => expect(screen.getByText(/MB1.*2 recipients/)).toBeInTheDocument())
    expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  })

  it('preserves a school update form after a publish error', async () => {
    vi.mocked(portalApi.createSchoolUpdate).mockRejectedValueOnce(new Error('Network unavailable'))
    render(<TeacherPortalView teacherName="Teacher Lim" activeTab="create" onTabChange={() => {}} onLogout={() => {}} canPublishUpdates />)
    const field = await screen.findByRole('textbox', { name: /Update/ })
    fireEvent.change(field, { target: { value: 'Sports day is Friday.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish update' }))
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument()
    expect(field).toHaveValue('Sports day is Friday.')
  })

  it('offers edit, withdraw, and manager hide actions only from the school update menu', async () => {
    vi.mocked(portalApi.getSchoolUpdates).mockResolvedValueOnce({ data: [{ id: 7, body: 'Correction', status: 'published', published_at: '2026-08-13T12:00:00Z', author: { id: 4, name: 'Teacher Lim' }, audiences: [{ type: 'school', class_id: null, student_id: null }], media: [], reaction_count: 0, reacted_by_me: false, can_report: false, can_edit: true, can_withdraw: true, can_moderate: true }] })
    render(<CommunityFeed role="teacher" userName="Teacher Lim" activeTab="home" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Update options' }))
    expect(screen.getByRole('button', { name: /Edit update/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Withdraw update/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide update/ })).toBeInTheDocument()
    expect(screen.queryByText(/permanent delete/i)).not.toBeInTheDocument()
  })

  it('renders ParentPortalView finance tab in loading state', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="finance" onTabChange={() => {}} onLogout={() => {}} />)

    expect(document.querySelector('.app-skeleton')).toBeTruthy()
  })

  it('renders StudentPortalView overview tab with welcome message (loading state)', () => {
    render(<StudentPortalView studentName="Alyssa Tan" activeTab="home" onLogout={() => {}} />)

    expect(screen.getByText(/Hello, Alyssa/)).toBeDefined()
    expect(screen.getByRole('heading', { name: 'School Updates' })).toBeDefined()
  })

  it('triggers onTabChange when bottom navigation item is clicked', () => {
    const handleTabChange = vi.fn()
    render(
      <MobileShell activeTab="home" onTabChange={handleTabChange} userRole="parent" allowedRoles={['parent']} userName="Sarah Tan">
        <div>Content</div>
      </MobileShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Finance' }))
    expect(handleTabChange).toHaveBeenCalledWith('finance')
  })

  it('does not load or display Attendance in the Student learning experience', async () => {
    render(<StudentPortalView studentName="Alyssa Tan" activeTab="learn" onLogout={() => {}} />)

    expect(await screen.findByText('My subjects')).toBeInTheDocument()
    expect(screen.queryByText('Recorded attendance')).not.toBeInTheDocument()
  })

  it('keeps the previous capsule destination selected beneath a secondary page', () => {
    const shellProps = {
      onTabChange: () => {},
      userRole: 'parent' as const,
      allowedRoles: ['parent' as const],
      userName: 'Sarah Tan',
    }
    const { rerender } = render(
      <MobileShell {...shellProps} activeTab="more"><div>Account page</div></MobileShell>,
    )

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page')

    rerender(<MobileShell {...shellProps} activeTab="safety"><div>Secondary page</div></MobileShell>)

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Secondary page')).toBeInTheDocument()
  })

  it('offers only roles held by a multi-role portal user', () => {
    const changeRole = vi.fn()
    render(
      <MobileShell
        activeTab="home"
        onTabChange={() => {}}
        userRole="parent"
        allowedRoles={['parent', 'student']}
        onRoleChange={changeRole}
        userName="Sarah Tan"
      >
        <div>Content</div>
      </MobileShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Active role' }))
    fireEvent.click(screen.getByRole('option', { name: 'Student' }))
    expect(changeRole).toHaveBeenCalledWith('student')
  })

  it.each([
    ['parent', 'Finance', 'Quiz'],
    ['student', 'Quiz', 'Finance'],
    ['teacher', 'Attendance', 'Finance'],
  ] as const)('renders %s destinations without leaking another role navigation', (role, visible, hidden) => {
    render(
      <MobileShell activeTab="home" onTabChange={() => {}} userRole={role} allowedRoles={[role]} userName="MIS User">
        <div>Content</div>
      </MobileShell>,
    )

    expect(screen.getByRole('button', { name: visible })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: hidden })).not.toBeInTheDocument()
  })

  it('places logout in each role More page', async () => {
    const parentLogout = vi.fn()
    const studentLogout = vi.fn()
    const teacherLogout = vi.fn()
    const { unmount } = render(<ParentPortalView parentName="Rachel Wong" activeTab="more" onTabChange={() => {}} onLogout={parentLogout} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(parentLogout).toHaveBeenCalledTimes(1)
    unmount()

    const student = render(<StudentPortalView studentName="Alyssa Tan" activeTab="more" onLogout={studentLogout} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(studentLogout).toHaveBeenCalledTimes(1)
    student.unmount()

    render(<TeacherPortalView teacherName="Teacher Lim" activeTab="more" onTabChange={() => {}} onLogout={teacherLogout} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(teacherLogout).toHaveBeenCalledTimes(1)
  })

  it('loads formal Quiz and Schedule from live APIs', async () => {
    const quiz = render(<StudentPortalView studentName="Alyssa Tan" activeTab="quiz" onLogout={() => {}} />)
    expect(await screen.findByText('No formal quizzes are assigned.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Practice generator coming later/ })).toBeDisabled()
    quiz.unmount()

    vi.mocked(portalApi.getStudentSchedule).mockResolvedValueOnce({ data: { entries: [{ id: 1, title: 'English', day_of_week: new Date().getDay() || 7, starts_at: '08:00', ends_at: '09:00', location: 'Room 3', subject: 'English', teacher: 'Teacher Lim', effective_from: null, effective_to: null }], due_dates: [] } })
    render(<StudentPortalView studentName="Alyssa Tan" activeTab="schedule" onLogout={() => {}} />)
    expect(await screen.findByText('English')).toBeInTheDocument()
    expect(screen.queryByText(/Schedule data is not connected/)).not.toBeInTheDocument()
  })

  it('loads Teacher classes from the scoped teaching assignment APIs', async () => {
    vi.mocked(portalApi.getTeacherAssignments).mockResolvedValueOnce({
      data: [{
        id: 7,
        academic_year: { id: 1, code: '2026' },
        class: { id: 2, name: 'MB1' },
        subject: { id: 3, code: 'ENG', name: 'English' },
      }],
    })
    vi.mocked(portalApi.getTeacherStudents).mockResolvedValueOnce({
      data: [
        { id: 11, student_no: 'MIS-001', full_name: 'Alyssa Tan' },
        { id: 12, student_no: 'MIS-002', full_name: 'Daniel Lim' },
      ],
    })

    render(<TeacherPortalView teacherName="Teacher Lim" activeTab="classes" onTabChange={() => {}} onLogout={() => {}} />)

    expect(await screen.findByText('MB1 · English')).toBeInTheDocument()
    expect(screen.getByText('2 enrolled students')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('connects an elevated Teacher to school moderation, assessment, and Quiz workspaces', () => {
    const changeTab = vi.fn()
    render(<TeacherPortalView teacherName="School Admin" activeTab="classes" onTabChange={changeTab} onLogout={() => {}} staffMode />)

    fireEvent.click(screen.getAllByRole('button', { name: /Content review/ })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /Assessments/ })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /Formal Quiz/ })[0])
    expect(changeTab).toHaveBeenNthCalledWith(1, 'review')
    expect(changeTab).toHaveBeenNthCalledWith(2, 'assessments')
    expect(changeTab).toHaveBeenNthCalledWith(3, 'quizzes')
  })
})
