import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api'
import { AuditTrailPage } from './AuditTrailPage'

const auditLog = {
  id: 17,
  event_uuid: '0191d6d8-1c2f-7b56-8f60-96ea16a52cc1',
  request_id: '0191d6d8-1c2f-7b56-8f60-96ea16a52cc2',
  batch_id: null,
  school_id: 1,
  user_id: 1,
  actor_username: 'superadmin',
  actor_roles: ['super-admin'],
  action: 'payment.verified',
  module: 'payments',
  entity_type: 'payment',
  entity_id: 42,
  old_values: { status: 'pending_verification' },
  new_values: { status: 'verified' },
  metadata: { source: 'api' },
  reason: null,
  related_audit_id: null,
  ip_address: '127.0.0.1',
  user_agent: 'Vitest',
  route_name: 'payments.verify',
  http_method: 'POST',
  context_type: 'request',
  schema_version: 1,
  created_at: '2026-08-03T08:30:00.000000Z',
}

describe('AuditTrailPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads audit events, applies filters, and opens read-only details', async () => {
    const user = userEvent.setup()
    const request = vi.spyOn(api, 'apiRequest')
      .mockResolvedValueOnce({ data: [auditLog], meta: { per_page: 50, next_cursor: null, previous_cursor: null } })
      .mockResolvedValueOnce({ data: auditLog })
      .mockResolvedValueOnce({ data: [auditLog], meta: { per_page: 50, next_cursor: null, previous_cursor: null } })

    render(<AuditTrailPage onUnauthorized={vi.fn()} />)

    expect(await screen.findByText('payment.verified')).toBeInTheDocument()
    expect(screen.getByText('superadmin')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View audit event 17' }))
    expect(await screen.findByRole('dialog', { name: 'Audit event 17' })).toHaveTextContent('pending_verification')
    expect(screen.getByRole('dialog', { name: 'Audit event 17' })).toHaveTextContent('verified')

    await user.click(screen.getByRole('button', { name: 'Close audit details' }))
    await user.selectOptions(screen.getByLabelText('Module'), 'payments')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/audit-logs?module=payments&per_page=50'))
  })

  it('reports forbidden access without exposing audit data', async () => {
    vi.spyOn(api, 'apiRequest').mockRejectedValue(new api.ApiError(403, 'You do not have permission to perform this action.'))

    render(<AuditTrailPage onUnauthorized={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission')
    expect(screen.queryByText('payment.verified')).not.toBeInTheDocument()
  })
})
