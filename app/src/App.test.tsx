import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('separate MIS portal app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the dedicated Community App login for a guest', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ message: 'Unauthenticated.' }, 401))
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome to MIS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Parent demo/ })).toBeInTheDocument()
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
  })

  it('renders the parent shell for an authenticated parent', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 3, name: 'Rachel Wong', username: 'rachel.wong', school_id: 1, roles: ['parent'], permissions: ['parent.self_service'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: { terms: { id: 1, title: 'Terms of Use', accepted: true }, community_standards: { id: 2, title: 'Community Standards', accepted: true } } })
      if (path.endsWith('/portal/parent/me')) return json({ data: { id: 1, full_name: 'Rachel Wong', phone: null, email: null }, children: [] })
      if (path.endsWith('/portal/notifications')) return json({ data: [], meta: { unread_count: 0 } })
      return json({ data: [] })
    })
    render(<App />)

    expect(await screen.findByRole('navigation', { name: 'Mobile Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Children' })).toBeInTheDocument()
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
    expect(screen.getByText('View school account')).toBeInTheDocument()
    expect(screen.queryByText('RM 1,240 outstanding')).not.toBeInTheDocument()
  })

  it('renders the teacher shell for an authenticated teacher', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 4, name: 'Ms Lim', username: 'teacher.lim', school_id: 1, roles: ['teacher'], permissions: ['teaching_scope.view'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: { terms: { id: 1, title: 'Terms of Use', accepted: true }, community_standards: { id: 2, title: 'Community Standards', accepted: true } } })
      if (path.endsWith('/portal/notifications')) return json({ data: [], meta: { unread_count: 0 } })
      return json({ data: [] })
    })
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Attendance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    expect(screen.queryByText('Share a school moment')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
  })

  it('blocks the authenticated app until required policies are accepted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 4, name: 'Ms Lim', username: 'teacher.lim', school_id: 1, roles: ['teacher'], permissions: ['teaching_scope.view'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: {
        terms: { id: 11, title: 'Terms of Use', accepted: false },
        community_standards: { id: 12, title: 'Community Standards', accepted: false },
      } })
      return json({ data: [] })
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Mobile Navigation', hidden: true })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'School Updates', hidden: true }).length).toBeGreaterThan(0)
    expect(screen.getByTestId('authenticated-app-shell')).toHaveAttribute('inert')
    expect(screen.getByTestId('authenticated-app-shell')).toHaveAttribute('aria-hidden', 'true')
  })

  it('returns to login when policy acceptance finds an expired session', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 4, name: 'Ms Lim', username: 'teacher.lim', school_id: 1, roles: ['teacher'], permissions: ['teaching_scope.view'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: {
        terms: { id: 11, title: 'Terms of Use', accepted: false },
        community_standards: { id: 12, title: 'Community Standards', accepted: false },
      } })
      if (path.endsWith('/csrf-cookie')) return Promise.resolve(new Response(null, { status: 204 }))
      if (path.includes('/community/policies/') && init?.method === 'POST') return json({ message: 'Unauthenticated.' }, 401)
      return json({ data: [] })
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    expect(await screen.findByRole('heading', { name: 'Welcome to MIS' })).toBeInTheDocument()
  })

  it('does not infer update publishing from Teacher access or moderation', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 1, name: 'Admin', username: 'admin', school_id: 1, roles: ['school-admin'], permissions: ['app.teacher_access', 'community.moderate'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: { terms: { id: 1, title: 'Terms of Use', accepted: true }, community_standards: { id: 2, title: 'Community Standards', accepted: true } } })
      return json({ data: [] })
    })
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Attendance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  })

  it('shows the Updates composer only when community.publish is returned for the Teacher', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(String(input), window.location.origin).pathname
      if (path.endsWith('/me')) return json({ user: { id: 4, name: 'Ms Lim', username: 'teacher.lim', school_id: 1, roles: ['teacher'], permissions: ['teaching_scope.view', 'community.publish'] } })
      if (path.endsWith('/community/policies/current')) return json({ data: { terms: { id: 1, title: 'Terms of Use', accepted: true }, community_standards: { id: 2, title: 'Community Standards', accepted: true } } })
      if (path.endsWith('/community/publishing-context')) return json({ data: { classes: [{ id: 1, name: 'MB1' }], max_images: 6, notify_default: true } })
      if (path.endsWith('/portal/notifications')) return json({ data: [], meta: { unread_count: 0 } })
      return json({ data: [] })
    })
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByText('Share a school update')).toBeInTheDocument()
  })

  it('rejects a finance-only account from the community App', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ user: { id: 2, name: 'Finance', username: 'finance', school_id: 1, roles: ['finance'], permissions: [] } }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'App access unavailable' })).toBeInTheDocument()
  })
})
