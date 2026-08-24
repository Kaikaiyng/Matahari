import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portalApi } from '../../api/portalApi'
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
    fireEvent.click(screen.getByLabelText('Bullying or harassment'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledWith(7, 'bullying_harassment', ''))
    expect(await screen.findByText(/report was sent/i)).toBeInTheDocument()
  })

  it('keeps Safety Centre to report status and public policy/support links', async () => {
    vi.spyOn(portalApi, 'getCommunityReports').mockResolvedValue({ data: [{ id: 1, target_type: 'post', reason_code: 'spam', status: 'submitted', created_at: '2026-08-16T00:00:00Z' }] })

    render(<CommunitySafetyCentre />)
    expect(await screen.findByText('Only you and moderators can see this.')).toBeInTheDocument()
    expect(screen.getByText('My Post Reports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account Deletion' })).toHaveAttribute('href', '/legal/account-deletion')
    expect(screen.queryByText('Blocked Users')).not.toBeInTheDocument()
    expect(screen.queryByText('My Appeals')).not.toBeInTheDocument()
  })
})
