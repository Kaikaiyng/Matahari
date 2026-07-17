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
      brandLogo="/logo.jpg"
      activePage="dashboard"
      pageTitle="Dashboard"
      contextText="Matahari International School"
      navGroups={groups}
      apiState="live"
      user={{ name: 'Demo Admin', email: 'admin@mis.test' }}
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
    expect(screen.getByText('Matahari International School')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Students' }))
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(onSelectPage).toHaveBeenCalledWith('students')
    expect(onLogout).toHaveBeenCalledOnce()
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
        brandLogo="/logo.jpg"
        activePage="dashboard"
        pageTitle="Dashboard"
        contextText="Matahari International School"
        navGroups={groups}
        apiState="live"
        user={{ name: 'Demo Admin', email: 'admin@mis.test' }}
        onSelectPage={() => undefined}
        onLogout={() => undefined}
      >
        <p>Page content</p>
      </AdminShell>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <AdminShell
        brandLogo="/logo.jpg"
        activePage="dashboard"
        pageTitle="Dashboard"
        contextText="Matahari International School"
        navGroups={groups}
        apiState="demo"
        user={{ name: 'Demo Admin', email: 'admin@mis.test' }}
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
      brandLogo: '/logo.jpg',
      contextText: 'Matahari International School',
      navGroups: groups,
      apiState: 'live' as const,
      user: { name: 'Demo Admin', email: 'admin@mis.test' },
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
