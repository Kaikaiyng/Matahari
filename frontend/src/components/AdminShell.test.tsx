import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayoutDashboard, Users } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminShell } from './AdminShell'

const groups = [
  {
    label: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [{ key: 'students', label: 'Students', icon: Users }],
  },
]

function renderShell() {
  const onSelectPage = vi.fn()
  const onLogout = vi.fn()

  render(
    <AdminShell
      activePage="dashboard"
      pageTitle="Dashboard"
      contextText="Demo International School"
      navGroups={groups}
      apiState="live"
      user={{ name: 'Demo Admin', username: 'admin' }}
      onSelectPage={onSelectPage}
      onLogout={onLogout}
    >
      <p>Page content</p>
    </AdminShell>,
  )

  return { onSelectPage, onLogout }
}

describe('AdminShell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('renders grouped navigation and dispatches page selection and logout', async () => {
    const user = userEvent.setup()
    const { onSelectPage, onLogout } = renderShell()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(navigation).getByText('Overview')).toBeInTheDocument()
    expect(within(navigation).getByText('People')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Demo International School')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'School Admin System logo' })).toBeInTheDocument()
    expect(screen.getByText('School Admin')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(onSelectPage).toHaveBeenCalledWith('students')
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('collapses the desktop layout while preserving the sidebar icons', async () => {
    const user = userEvent.setup()
    renderShell()

    const shell = document.querySelector<HTMLElement>('.admin-shell')
    const sidebar = document.querySelector<HTMLElement>('.admin-sidebar')
    const workspace = document.querySelector<HTMLElement>('.admin-workspace')
    if (!shell || !sidebar || !workspace) throw new Error('Admin shell was not rendered')

    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' })
    const dashboardIcon = screen.getByRole('button', { name: 'Dashboard' }).querySelector('svg')
    expect(shell).toHaveClass('admin-shell')
    expect(shell).not.toHaveClass('sidebar-collapsed')
    expect(sidebar).not.toHaveClass('collapsed')
    const directionIcon = collapseButton.querySelector('svg')
    expect(directionIcon).toBeInTheDocument()
    expect(dashboardIcon).toBeInTheDocument()

    await user.click(collapseButton)

    expect(sidebar).toHaveClass('collapsed')
    expect(shell).toHaveClass('admin-shell')
    expect(shell).toHaveClass('sidebar-collapsed')
    expect(document.querySelector('.admin-workspace')).toBe(workspace)
    expect(screen.getByRole('button', { name: 'Dashboard' }).querySelector('svg')).toBe(dashboardIcon)
    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(expandButton.querySelector('svg')).toBe(directionIcon)
    expect(directionIcon).toHaveClass('sidebar-collapse-icon', 'reversed')
    expect(window.localStorage.getItem('admin-sidebar-collapsed')).toBe('true')
  })

  it('opens the navigation drawer and restores menu focus after Escape', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia

    renderShell()

    const menuButton = document.querySelector<HTMLButtonElement>('.menu-button')
    if (!menuButton) throw new Error('Menu button was not rendered')
    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.drawer-close')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()

    window.matchMedia = originalMatchMedia
  })

  it('shows the service warning only when the API is in demo mode', () => {
    const { rerender } = render(
      <AdminShell
        activePage="dashboard"
        pageTitle="Dashboard"
        contextText="Demo International School"
        navGroups={groups}
        apiState="live"
        user={{ name: 'Demo Admin', username: 'admin' }}
        onSelectPage={() => undefined}
        onLogout={() => undefined}
      >
        <p>Page content</p>
      </AdminShell>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <AdminShell
        activePage="dashboard"
        pageTitle="Dashboard"
        contextText="Demo International School"
        navGroups={groups}
        apiState="demo"
        user={{ name: 'Demo Admin', username: 'admin' }}
        onSelectPage={() => undefined}
        onLogout={() => undefined}
      >
        <p>Page content</p>
      </AdminShell>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Service temporarily unavailable')
  })

  it('resets the workspace scroll position when the active page changes', () => {
    const scrollTo = vi.mocked(window.scrollTo)
    const shellProps = {
      contextText: 'Demo International School',
      navGroups: groups,
      apiState: 'live' as const,
      user: { name: 'Demo Admin', username: 'admin' },
      onSelectPage: () => undefined,
      onLogout: () => undefined,
    }
    const { rerender } = render(
      <AdminShell {...shellProps} activePage="dashboard" pageTitle="Dashboard">
        <p>Dashboard content</p>
      </AdminShell>,
    )
    scrollTo.mockClear()

    rerender(
      <AdminShell {...shellProps} activePage="students" pageTitle="Students">
        <p>Student content</p>
      </AdminShell>,
    )

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})
