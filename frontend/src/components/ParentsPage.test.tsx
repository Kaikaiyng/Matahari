import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../api'
import { ParentsPage } from './ParentsPage'

vi.mock('../api', async (importOriginal) => ({ ...await importOriginal<typeof import('../api')>(), apiRequest: vi.fn() }))

const parent = {
  id: 10, name: 'Actual Guardian', phone: '0000000000', email: null, address: null, account_linked: false,
  children: [{ id: 3, link_id: 5, student_no: 'TEST-003', name: 'Actual Child', class_name: 'MA1', relationship: 'guardian', relationship_status: 'unreviewed' }],
}
const response = {
  data: [parent], meta: { total: 1, current_page: 1, last_page: 1, per_page: 25, can_view_students: true, class_options: [{ id: 2, name: 'MA1' }] },
}
const unauthorized = vi.fn()

describe('ParentsPage', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiRequest).mockResolvedValue(response) })

  it('shows real contacts and relationship status without assuming portal access', async () => {
    const user = userEvent.setup()
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await user.click(await screen.findByRole('button', { name: /Actual Guardian/ }))
    expect(screen.getByText('Actual Child')).toBeVisible()
    expect(screen.getByText('Not reviewed')).toBeVisible()
    expect(screen.getByText('Account not linked')).toBeVisible()
    expect(screen.queryByText('Rachel Wong')).not.toBeInTheDocument()
  })

  it('shows unlinked contacts and empty results, including in class grouping', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockResolvedValue({ ...response, data: [{ ...parent, children: [] }] })
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await screen.findByText('Actual Guardian')
    await user.click(screen.getByRole('button', { name: 'Group by profile class' }))
    expect(screen.getByText('No linked class')).toBeVisible()
    vi.mocked(apiRequest).mockResolvedValue({ ...response, data: [], meta: { ...response.meta, total: 0 } })
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('No matching parents found')).toBeVisible()
  })

  it('submits server search, class filters and pagination', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockResolvedValue({ ...response, meta: { ...response.meta, total: 30, last_page: 2 } })
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await screen.findByText('Actual Guardian')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/v1/admin/parents?page=2&per_page=25'))
    await user.type(screen.getByLabelText('Search parents'), 'Actual')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/v1/admin/parents?page=1&per_page=25&search=Actual'))
    await user.selectOptions(screen.getByLabelText('Filter by profile class'), '2')
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/v1/admin/parents?page=1&per_page=25&search=Actual&class_id=2'))
  })

  it('clears old results on failure and retries without demo data', async () => {
    const user = userEvent.setup()
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await screen.findByText('Actual Guardian')
    vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError(503, 'Directory unavailable.'))
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Directory unavailable.')
    expect(screen.queryByText('Actual Guardian')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Actual Guardian')).toBeVisible()
  })

  it('hides student controls when the server restricts student visibility', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ ...parent, children: [] }], meta: { ...response.meta, can_view_students: false, class_options: [] } })
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await screen.findByText('Actual Guardian')
    expect(screen.queryByLabelText('Filter by profile class')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Group by profile class' })).not.toBeInTheDocument()
    expect(screen.getByText('Student details require Students View access.')).toBeVisible()
  })

  it('returns expired sessions to the existing login flow', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(401, 'Unauthenticated.'))
    render(<ParentsPage onUnauthorized={unauthorized} />)
    await waitFor(() => expect(unauthorized).toHaveBeenCalledOnce())
  })
})
