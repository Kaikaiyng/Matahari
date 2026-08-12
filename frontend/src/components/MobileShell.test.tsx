import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobileShell } from './MobileShell'
import { ParentPortalView } from './ParentPortalView'
import { StudentPortalView } from './StudentPortalView'

// Mock the portalApi so components don't make real HTTP calls in tests
vi.mock('../api/portalApi', () => ({
  portalApi: {
    getGuardianMe: vi.fn().mockResolvedValue({
      data: { id: 1, full_name: 'Rachel Wong', phone: null, email: null },
      children: [
        {
          id: 1,
          student_no: 'MIS-2026-001',
          full_name: 'Alyssa Tan',
          status: 'active',
          class: { id: 1, name: 'Grade MB1' },
          can_view_finance: true,
          can_view_academics: true,
        },
      ],
    }),
    getChildOutstanding: vi.fn().mockResolvedValue({ data: [] }),
    getChildPayments: vi.fn().mockResolvedValue({ data: [] }),
    getChildReceipts: vi.fn().mockResolvedValue({ data: [] }),
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
    getNotifications: vi.fn().mockResolvedValue({ data: [], meta: { unread_count: 0 } }),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileShell & Portal Views', () => {
  it('renders mobile shell with brand logo, environment badge, and user avatar', () => {
    render(
      <MobileShell activeTab="home" onTabChange={() => {}} userRole="parent" allowedRoles={['parent']} onLogout={() => {}} userName="Sarah Tan" environment="staging">
        <div>Content</div>
      </MobileShell>,
    )

    expect(screen.getByText('staging')).toBeDefined()
    expect(screen.getByText('S')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('My Kids')).toBeDefined()
  })

  it('renders ParentPortalView home tab with welcome message (loading state)', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="home" />)

    // Welcome greeting includes first name (format: "Good Morning/Afternoon/Evening, Rachel 👋")
    expect(screen.getByText(/Rachel/)).toBeDefined()
    // Loading skeleton is shown while API is pending
    expect(document.querySelector('.portal-skeleton-wrap')).toBeTruthy()
  })

  it('renders ParentPortalView finance tab in loading state', () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="finance" />)

    // In loading state, shows a skeleton instead of 'Finance & Billing'
    expect(document.querySelector('.portal-skeleton-wrap')).toBeTruthy()
  })

  it('renders StudentPortalView overview tab with welcome message (loading state)', () => {
    render(<StudentPortalView studentName="Alyssa Tan" activeTab="home" />)

    expect(screen.getByText(/Hello, Alyssa Tan/)).toBeDefined()
    // Loading skeleton is shown while API is pending
    expect(document.querySelector('.portal-skeleton-wrap')).toBeTruthy()
  })

  it('triggers onTabChange when bottom navigation item is clicked', () => {
    const handleTabChange = vi.fn()
    render(
      <MobileShell activeTab="home" onTabChange={handleTabChange} userRole="parent" allowedRoles={['parent']} onLogout={() => {}} userName="Sarah Tan">
        <div>Content</div>
      </MobileShell>,
    )

    fireEvent.click(screen.getByText('Finance'))
    expect(handleTabChange).toHaveBeenCalledWith('finance')
  })

  it('offers only roles held by a multi-role portal user and logs out explicitly', () => {
    const changeRole = vi.fn()
    const logout = vi.fn()
    render(
      <MobileShell
        activeTab="home"
        onTabChange={() => {}}
        userRole="parent"
        allowedRoles={['parent', 'student']}
        onRoleChange={changeRole}
        onLogout={logout}
        userName="Sarah Tan"
      >
        <div>Content</div>
      </MobileShell>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'student' } })
    expect(changeRole).toHaveBeenCalledWith('student')
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
