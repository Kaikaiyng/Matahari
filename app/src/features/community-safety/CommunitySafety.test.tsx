import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portalApi } from '../../api/portalApi'
import { ApiError } from '../../api'
import { CommunityPolicyGate } from './CommunityPolicyGate'
import { CommunitySafetyCentre } from './CommunitySafetyCentre'
import { CommunitySafetyMenu } from './CommunitySafetyMenu'

describe('Community safety', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires current policies to be accepted before using the App', async () => {
    vi.spyOn(portalApi, 'getCurrentCommunityPolicies').mockResolvedValue({ data: {
      terms: { id: 11, title: 'Terms of Use', accepted: false },
      community_standards: { id: 12, title: 'Community Standards', accepted: false },
    } })
    const accept = vi.spyOn(portalApi, 'acceptCommunityPolicy').mockResolvedValue({ data: { accepted: true } })
    const ready = vi.fn()

    render(<CommunityPolicyGate role="student" onReadyChange={ready} />)
    expect(await screen.findByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    expect(screen.getByText(/adult authorization/i)).toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => fireEvent.click(cb))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2))
    expect(accept).toHaveBeenNthCalledWith(1, 11)
    expect(accept).toHaveBeenNthCalledWith(2, 12)
    expect(ready).toHaveBeenLastCalledWith(true)
  })

  it('stays blocking and allows retry when policy verification fails', async () => {
    const policies = vi.spyOn(portalApi, 'getCurrentCommunityPolicies')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: {
        terms: { id: 11, title: 'Terms of Use', accepted: false },
        community_standards: { id: 12, title: 'Community Standards', accepted: false },
      } })

    render(<CommunityPolicyGate role="teacher" onReadyChange={vi.fn()} />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/unable to verify the current community policies/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    expect(policies).toHaveBeenCalledTimes(2)
  })

  it('reports a school update without user blocking controls', async () => {
    const report = vi.spyOn(portalApi, 'reportSchoolUpdate').mockResolvedValue({ data: { id: 99, status: 'submitted' } })
    render(<CommunitySafetyMenu postId={7} canReport />)
    fireEvent.click(screen.getByRole('button', { name: 'Safety actions' }))
    expect(screen.getByRole('button', { name: 'Report update' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Block/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Report update' }))
    fireEvent.click(screen.getByLabelText('Incorrect information'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledWith(7, 'incorrect', ''))
    expect(await screen.findByText(/report was sent/i)).toBeInTheDocument()
  })

  it('uses the exact report reasons, limits details, and surfaces backend field errors', async () => {
    vi.spyOn(portalApi, 'reportSchoolUpdate').mockRejectedValue(new ApiError(422, 'Please check the form and try again.', { details: ['Report details may not be greater than 1000 characters.'] }))
    render(<CommunitySafetyMenu postId={7} canReport />)
    fireEvent.click(screen.getByRole('button', { name: 'Safety actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Report update' }))

    expect(screen.getAllByRole('radio').map((item) => (item as HTMLInputElement).value)).toEqual(['incorrect', 'outdated', 'inappropriate', 'other'])
    expect(screen.getByLabelText('More details (optional)')).toHaveAttribute('maxlength', '1000')
    fireEvent.click(screen.getByLabelText('Other'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    expect(await screen.findByText('Report details may not be greater than 1000 characters.')).toBeInTheDocument()
  })

  it('keeps Safety Centre to report status and public policy/support links', async () => {
    vi.spyOn(portalApi, 'getCommunityReports').mockResolvedValue({ data: [{ id: 1, target_type: 'post', reason_code: 'spam', status: 'submitted', created_at: '2026-08-16T00:00:00Z' }] })

    render(<CommunitySafetyCentre />)
    expect(await screen.findByText('Only you and moderators can see this.')).toBeInTheDocument()
    expect(screen.getByText('My Post Reports')).toBeInTheDocument()
    expect(screen.getByText('Safety standards')).toBeInTheDocument()
    expect(screen.getByText('Policies & account')).toBeInTheDocument()
    expect(screen.getByText('School support')).toBeInTheDocument()
    expect(screen.getByText('Call, WhatsApp or email your school support team.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account Deletion' })).toHaveAttribute('href', '/legal/account-deletion')
    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/legal/support')
    expect(screen.queryByText('Blocked Users')).not.toBeInTheDocument()
    expect(screen.queryByText('My Appeals')).not.toBeInTheDocument()
  })

  it('shows a calm private empty state when no reports have been submitted', async () => {
    vi.spyOn(portalApi, 'getCommunityReports').mockResolvedValue({ data: [] })

    render(<CommunitySafetyCentre />)

    expect(await screen.findByText('No reports submitted')).toBeInTheDocument()
    expect(screen.getByText('Reports you send will appear here with their latest status.')).toBeInTheDocument()
  })

  it('opens legal content as a tertiary swipe-back page above Safety Centre', async () => {
    vi.spyOn(portalApi, 'getCommunityReports').mockResolvedValue({ data: [] })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {
      slug: 'community-standards',
      title: 'Community Standards',
      version: '2026-08-16',
      effective_at: '2026-08-21T00:00:00Z',
      sections: [{ heading: 'Prohibited content', body: 'Keep school updates safe.' }],
      developer_name: 'RYLAY',
      organization_name: 'Matahari International School',
      store_safety_disclosure: 'Child exploitation is prohibited.',
      support: { email: 'support@rylay.my', child_safety_email: null, school: null },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    render(<CommunitySafetyCentre />)
    fireEvent.click(await screen.findByRole('link', { name: 'Community Standards' }))

    expect(await screen.findByRole('region', { name: 'Community Standards Subpage' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Community Safety Centre Subpage' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prohibited content' })).toBeInTheDocument()
  })
})
