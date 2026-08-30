import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api'
import { ApplicationLogsPage } from './ApplicationLogsPage'

const response = {
  data: [
    {
      id: 'log-1',
      timestamp: '2026-08-21T10:01:00.000000Z',
      level: 'ERROR' as const,
      environment: 'local',
      message: 'Database request failed',
      context: { request_id: 'request-1', route: 'payments.store' },
      actor: 'superadmin',
      ip_address: '127.0.0.1',
      source: 'laravel.log',
    },
  ],
  meta: {
    page: 1,
    per_page: 50,
    total: 2,
    total_pages: 2,
    level_counts: { FATAL: 0, ERROR: 1, WARN: 1, INFO: 0 },
    truncated: false,
  },
}

describe('ApplicationLogsPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads, filters, expands, refreshes, and paginates sanitized logs', async () => {
    const user = userEvent.setup()
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue(response)

    render(<ApplicationLogsPage onUnauthorized={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Application Logs', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Database request failed')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Expand log details' }))
    expect(screen.getByText(/payments\.store/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Search logs'), 'Database')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/application-logs?search=Database&page=1&per_page=50'))

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/application-logs?search=Database&page=2&per_page=50'))

    await user.click(screen.getByRole('button', { name: 'Refresh logs' }))
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('does not expose data after a forbidden response', async () => {
    vi.spyOn(api, 'apiRequest').mockRejectedValue(new api.ApiError(403, 'You do not have permission to perform this action.'))

    render(<ApplicationLogsPage onUnauthorized={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission')
    expect(screen.queryByText('Database request failed')).not.toBeInTheDocument()
  })
})
