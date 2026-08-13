import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobileShell } from './MobileShell'
import { ParentPortalView } from './ParentPortalView'
import { StudentPortalView } from './StudentPortalView'
import { TeacherPortalView } from './TeacherPortalView'
import { portalApi } from '../api/portalApi'

// Mock the portalApi so components don't make real HTTP calls in tests
vi.mock('../api/portalApi', () => ({
  portalApi: {
    getCommunityPosts: vi.fn().mockResolvedValue({ data: [{ id: 1, body: 'A real school update', comments_enabled: true, published_at: '2026-08-13T12:00:00Z', author: { id: 4, name: 'Teacher Lim' }, audiences: [{ type: 'class', class_id: 1, student_id: null }], media: [], reaction_count: 2, reacted_by_me: false, comments: [], can_moderate: false }] }),
    toggleCommunityReaction: vi.fn(),
    addCommunityComment: vi.fn(),
    createCommunityPost: vi.fn(),
    removeCommunityComment: vi.fn(),
    hideCommunityPost: vi.fn(),
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
    getStudentAttendance: vi.fn().mockResolvedValue({ data: [] }),
    getNotifications: vi.fn().mockResolvedValue({ data: [], meta: { unread_count: 0 } }),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    getTeacherAssignments: vi.fn().mockResolvedValue({ data: [] }),
    getTeacherStudents: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileShell & Portal Views', () => {
  it('renders mobile shell with brand logo, environment badge, and user avatar', () => {
    render(
      <MobileShell activeTab="home" onTabChange={() => {}} userRole="parent" allowedRoles={['parent']} userName="Sarah Tan" environment="staging">
        <div>Content</div>
      </MobileShell>,
    )

    expect(screen.getByText('Preview environment')).toBeDefined()
    expect(screen.getByText('Sarah')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Children' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
  })

  it('renders ParentPortalView home tab with welcome message (loading state)', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="home" onTabChange={() => {}} onLogout={() => {}} />)

    // Welcome greeting includes first name.
    expect(screen.getByText(/Rachel/)).toBeDefined()
    expect(document.querySelector('.context-card')).toBeTruthy()
    expect(screen.getByText('School community')).toBeDefined()
  })

  it('renders ParentPortalView finance tab in loading state', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="finance" onTabChange={() => {}} onLogout={() => {}} />)

    expect(document.querySelector('.app-skeleton')).toBeTruthy()
  })

  it('renders StudentPortalView overview tab with welcome message (loading state)', () => {
    render(<StudentPortalView studentName="Alyssa Tan" activeTab="home" onLogout={() => {}} />)

    expect(screen.getByText(/Hello, Alyssa/)).toBeDefined()
    expect(screen.getByText('School community')).toBeDefined()
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

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'student' } })
    expect(changeRole).toHaveBeenCalledWith('student')
  })

  it.each([
    ['parent', 'Finance', 'Quiz'],
    ['student', 'Quiz', 'Finance'],
    ['teacher', 'Attendance', 'Finance'],
    ['staff', 'Review', 'Attendance'],
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

  it('labels Quiz and Schedule as previews and does not expose fake actions', async () => {
    const quiz = render(<StudentPortalView studentName="Alyssa Tan" activeTab="quiz" onLogout={() => {}} />)
    expect(await screen.findByText(/Quiz delivery is not connected/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quiz coming later/ })).toBeDisabled()
    quiz.unmount()

    render(<StudentPortalView studentName="Alyssa Tan" activeTab="schedule" onLogout={() => {}} />)
    expect(await screen.findByText(/Schedule data is not connected/)).toBeInTheDocument()
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
})
