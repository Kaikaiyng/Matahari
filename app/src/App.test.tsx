import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('separate MIS portal app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the dedicated Parent and Student login for a guest', async () => {
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
      if (path.endsWith('/portal/parent/me')) return json({ data: { id: 1, full_name: 'Rachel Wong', phone: null, email: null }, children: [] })
      if (path.endsWith('/portal/notifications')) return json({ data: [], meta: { unread_count: 0 } })
      return json({ data: [] })
    })
    render(<App />)

    expect(await screen.findByRole('navigation', { name: 'Mobile Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Children' })).toBeInTheDocument()
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
  })

  it('renders the staff publishing shell for a school administrator', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ user: { id: 1, name: 'Admin', username: 'admin', school_id: 1, roles: ['school-admin'], permissions: [] } }))
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('rejects a finance-only account from the community App', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ user: { id: 2, name: 'Finance', username: 'finance', school_id: 1, roles: ['finance'], permissions: [] } }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'App access unavailable' })).toBeInTheDocument()
  })
})
