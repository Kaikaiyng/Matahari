import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portalApi } from '../../api/portalApi'
import { CommunityPolicyGate } from './CommunityPolicyGate'
import { CommunitySafetyCentre } from './CommunitySafetyCentre'
import { CommunitySafetyMenu } from './CommunitySafetyMenu'

describe('Community safety', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires current policies to be accepted before contributing', async () => {
    vi.spyOn(portalApi, 'getCurrentCommunityPolicies').mockResolvedValue({ data: {
      terms: { id: 11, title: 'Terms of Use', accepted: false },
      community_standards: { id: 12, title: 'Community Standards', accepted: false },
    } })
    const accept = vi.spyOn(portalApi, 'acceptCommunityPolicy').mockResolvedValue({ data: { accepted: true } })
    const ready = vi.fn()

    render(<CommunityPolicyGate role="student" onReadyChange={ready} />)
    expect(await screen.findByRole('heading', { name: 'Before you contribute' })).toBeInTheDocument()
    expect(screen.getByText(/adult authorization/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2))
    expect(accept).toHaveBeenNthCalledWith(1, 11)
    expect(accept).toHaveBeenNthCalledWith(2, 12)
    expect(ready).toHaveBeenLastCalledWith(true)
  })

  it('keeps reporting content, reporting a user, and blocking separate', async () => {
    const report = vi.spyOn(portalApi, 'reportCommunityContent').mockResolvedValue({ data: { id: 99, status: 'submitted' } })
    vi.spyOn(portalApi, 'reportCommunityUser').mockResolvedValue({ data: { id: 100, status: 'submitted' } })
    const block = vi.spyOn(portalApi, 'blockCommunityUser').mockResolvedValue({ data: { active: true } })
    const blocked = vi.fn()

    render(<CommunitySafetyMenu targetType="post" targetId={7} authorUserId={8} canReportContent canReportUser onBlocked={blocked} />)
    fireEvent.click(screen.getByRole('button', { name: 'Safety actions' }))
    expect(screen.getByRole('button', { name: 'Report content' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report user' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block user' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Report content' }))
    fireEvent.click(screen.getByLabelText('Bullying or harassment'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(report).toHaveBeenCalledWith('post', 7, 'bullying_harassment', ''))
    expect(await screen.findByText(/report was sent/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Safety actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Block user' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm block' }))
    await waitFor(() => expect(block).toHaveBeenCalledWith(8))
    expect(blocked).toHaveBeenCalled()
  })

  it('shows private review status, appeals, and unblock controls', async () => {
    vi.spyOn(portalApi, 'getCommunityReports').mockResolvedValue({ data: [{ id: 1, target_type: 'post', reason_code: 'spam', status: 'submitted', created_at: '2026-08-16T00:00:00Z' }] })
    vi.spyOn(portalApi, 'getBlockedCommunityUsers').mockResolvedValue({ data: [{ id: 2, user: { id: 8, name: 'Blocked Person' }, blocked_at: '2026-08-16T00:00:00Z', active: true }] })
    vi.spyOn(portalApi, 'getMyCommunityContent').mockResolvedValue({ data: [{ id: 3, type: 'post', body: 'Pending post', status: 'pending_review', moderation_reason_code: null, created_at: '2026-08-16T00:00:00Z' }] })
    vi.spyOn(portalApi, 'getCommunityAppeals').mockResolvedValue({ data: [] })
    const unblock = vi.spyOn(portalApi, 'unblockCommunityUser').mockResolvedValue({ data: { active: false } })

    render(<CommunitySafetyCentre />)
    expect(await screen.findByText('Only you and moderators can see this.')).toBeInTheDocument()
    expect(screen.getByText('Pending review')).toBeInTheDocument()
    expect(screen.getByText('Blocked Person')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Unblock Blocked Person' }))
    await waitFor(() => expect(unblock).toHaveBeenCalledWith(8))
  })
})
