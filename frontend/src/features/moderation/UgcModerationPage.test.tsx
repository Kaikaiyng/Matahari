import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { moderationApi, type ModerationCase } from './moderationApi'
import { UgcModerationPage } from './UgcModerationPage'

const severeCase: ModerationCase = { id: 9, source: 'user_report', target_type: 'post', reason_code: 'child_safety', priority: 'severe', status: 'submitted', due_at: '2020-01-01T00:00:00Z', overdue: true, target_snapshot: { target_type: 'post', reported_user_id: 44, post: { id: 3, body: 'Evidence text', status: 'hidden', author_user_id: 44, media: [{ id: 8, type: 'image', name: 'evidence.jpg', mime_type: 'image/jpeg', size_bytes: 10, status: 'quarantined' }] }, comment: null }, actions: [], appeals: [] }

describe('UGC moderation workspace', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the school queue, evidence and reason-gated actions without reporter identity', async () => {
    vi.spyOn(moderationApi, 'getSchoolQueue').mockResolvedValue({ data: [severeCase, { ...severeCase, id: 10, priority: 'normal', overdue: false }] })
    vi.spyOn(moderationApi, 'getSchoolCase').mockResolvedValue({ data: severeCase })
    const decide = vi.spyOn(moderationApi, 'decideSchoolCase').mockResolvedValue({ data: { ...severeCase, status: 'resolved' } })

    render(<UgcModerationPage permissions={['community.moderate']} currentUserId={1} />)
    const queue = await screen.findByRole('region', { name: 'Moderation queue' })
    expect(within(queue).getAllByRole('button')[0]).toHaveTextContent('Severe')
    expect(within(queue).getAllByRole('button')[0]).toHaveTextContent('Overdue')
    fireEvent.click(within(queue).getAllByRole('button')[0])
    expect(await screen.findByText('Evidence text')).toBeInTheDocument()
    expect(screen.getByText('evidence.jpg')).toBeInTheDocument()
    expect(screen.queryByText(/reporter/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'hide' } })
    expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason category'), { target: { value: 'child_safety' } })
    fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: 'Confirmed policy violation.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith(9, 'hide', 'child_safety', 'Confirmed policy violation.'))
  })

  it('prevents the original moderator from deciding an appeal', async () => {
    const appealed = { ...severeCase, status: 'resolved', appeals: [{ id: 7, status: 'submitted', statement: 'Please review again.', source_moderator_user_id: 1, decision: null, decision_reason: null, created_at: '2026-08-16T00:00:00Z' }] }
    vi.spyOn(moderationApi, 'getSchoolQueue').mockResolvedValue({ data: [appealed] })
    vi.spyOn(moderationApi, 'getSchoolCase').mockResolvedValue({ data: appealed })

    render(<UgcModerationPage permissions={['community.moderate']} currentUserId={1} />)
    fireEvent.click((await screen.findByRole('region', { name: 'Moderation queue' })).querySelector('button')!)
    expect(await screen.findByText('A different moderator must decide this appeal.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Uphold appeal' })).not.toBeInTheDocument()
  })

  it('uses platform aggregate mode and opens only explicit severe cases', async () => {
    vi.spyOn(moderationApi, 'getPlatformSummary').mockResolvedValue({ data: { open: 4, severe_open: 1, overdue: 1, by_tenant: [{ tenant_id: 2, total: 4 }], severe_cases: [{ id: 9, tenant_id: 2, school_id: 5, priority: 'severe', reason_code: 'child_safety', status: 'submitted', due_at: '2020-01-01T00:00:00Z', overdue: true }] } })
    vi.spyOn(moderationApi, 'getPlatformCase').mockResolvedValue({ data: { ...severeCase, tenant_id: 2, school_id: 5 } })

    render(<UgcModerationPage permissions={['community.moderate_platform']} currentUserId={99} />)
    expect(await screen.findByText('4 open cases')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /case #9/i }))
    expect(await screen.findByText('Tenant 2 · School 5')).toBeInTheDocument()
  })
})
