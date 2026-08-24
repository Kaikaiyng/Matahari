import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { moderationApi, type ModerationCase } from './moderationApi'
import { UgcModerationPage } from './UgcModerationPage'

const postReport: ModerationCase = {
  id: 9,
  source: 'user_report',
  target_type: 'post',
  reason_code: 'inappropriate',
  priority: 'normal',
  status: 'submitted',
  details: 'Please review this update.',
  created_at: '2026-08-24T00:00:00Z',
  due_at: '2026-08-25T00:00:00Z',
  overdue: false,
  reporter: { id: 12, name: 'Rachel Wong' },
  post: { author: { id: 44, name: 'Alex Tan' }, audience: { school: false, classes: [{ id: 7, name: 'Year 4' }] } },
  target_snapshot: {
    target_type: 'post',
    reported_user_id: 44,
    post: {
      id: 3,
      body: 'Evidence text',
      status: 'published',
      author_user_id: 44,
      media: [{ id: 8, type: 'image', name: 'evidence.jpg', mime_type: 'image/jpeg', size_bytes: 10, status: 'ready' }],
    },
  },
  actions: [{ id: 2, action: 'submitted', reason_code: 'inappropriate', reason: null, actor: { id: 12, name: 'Rachel Wong' }, created_at: '2026-08-24T00:00:00Z' }],
}

describe('Post Reports workspace', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows post-only reports with preserved evidence and a decision reason gate', async () => {
    vi.spyOn(moderationApi, 'getSchoolQueue').mockResolvedValue({ data: [postReport] })
    vi.spyOn(moderationApi, 'getSchoolCase').mockResolvedValue({ data: postReport })
    const decide = vi.spyOn(moderationApi, 'decideSchoolCase').mockResolvedValue({ data: { ...postReport, status: 'resolved' } })

    render(<UgcModerationPage />)
    expect(await screen.findByRole('heading', { name: 'Post Reports' })).toBeInTheDocument()
    const queue = screen.getByRole('region', { name: 'Post reports queue' })
    expect(within(queue).getByRole('button', { name: /Post report #9/i })).toBeInTheDocument()
    fireEvent.click(within(queue).getByRole('button', { name: /Post report #9/i }))

    expect(await screen.findByText('Evidence text')).toBeInTheDocument()
    expect(screen.getByText('evidence.jpg')).toBeInTheDocument()
    expect(screen.getByText('Reporter: Rachel Wong')).toBeInTheDocument()
    expect(screen.getByText('Post author: Alex Tan')).toBeInTheDocument()
    expect(screen.getByText('Audience: Year 4')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'remove_content' } })
    fireEvent.change(screen.getByLabelText('Reason category'), { target: { value: 'inappropriate' } })
    expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: 'Removed after report review.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith(9, 'remove_content', 'inappropriate', 'Removed after report review.'))
  })

  it('has no user restriction, appeal, or platform intervention controls', async () => {
    vi.spyOn(moderationApi, 'getSchoolQueue').mockResolvedValue({ data: [postReport] })
    vi.spyOn(moderationApi, 'getSchoolCase').mockResolvedValue({ data: postReport })

    render(<UgcModerationPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Post report #9/i }))
    await screen.findByText('Evidence text')

    expect(screen.queryByText('Community restriction')).not.toBeInTheDocument()
    expect(screen.queryByText(/Appeal #/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Platform safety|Escalate to platform|Open cases by tenant/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply restriction' })).not.toBeInTheDocument()
  })

  it('keeps the client API limited to school report list, detail, and decision calls', () => {
    expect(Object.keys(moderationApi).sort()).toEqual(['decideSchoolCase', 'getSchoolCase', 'getSchoolQueue'])
  })
})
