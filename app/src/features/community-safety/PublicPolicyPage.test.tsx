import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { PublicPolicyPage } from './PublicPolicyPage'

const policy = { data: { slug: 'child-safety', title: 'Child Safety Standards', version: '2026-08-16', effective_at: '2026-08-16T00:00:00Z', sections: [{ heading: 'Zero tolerance', body: 'We prohibit child sexual abuse and exploitation.' }], developer_name: 'RYLAY', organization_name: 'Matahari International School', store_safety_disclosure: 'RYLAY prohibits CSAE and CSAM.', support: { email: 'support@example.test', child_safety_email: 'safety@example.test' } } }

afterEach(() => { window.history.replaceState({}, '', '/'); vi.restoreAllMocks() })

describe('public Community policies', () => {
  it('renders escaped policy sections and support contacts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(policy), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    render(<PublicPolicyPage slug="child-safety" />)

    expect(await screen.findByRole('heading', { name: 'Child Safety Standards' })).toBeInTheDocument()
    expect(screen.getByText('RYLAY prohibits CSAE and CSAM.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'safety@example.test' })).toHaveAttribute('href', 'mailto:safety@example.test')
  })

  it('renders legal routes before authentication and does not request a session', async () => {
    window.history.replaceState({}, '', '/legal/child-safety')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(policy), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Child Safety Standards' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/me'))).toBe(false)
  })

  it('routes the account-deletion public policy before authentication', async () => {
    window.history.replaceState({}, '', '/legal/account-deletion')
    const accountDeletionPolicy = { data: { ...policy.data, slug: 'account-deletion', title: 'Account Deletion' } }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(accountDeletionPolicy), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Account Deletion' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/v1/public/community-policies/account-deletion'))).toBe(true)
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/me'))).toBe(false)
  })
})
