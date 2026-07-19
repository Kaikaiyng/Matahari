import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'

const allPermissions = [
  'calendar.view',
  'calendar.create',
  'calendar.update',
  'calendar.delete',
]

const appointment = {
  id: 1,
  school_id: 7,
  title: 'Parent Appointment',
  event_type: 'appointment',
  is_all_day: false,
  starts_at: '2026-07-20T01:00:00.000Z',
  ends_at: '2026-07-20T02:00:00.000Z',
  location: 'Meeting room',
  participants: 'Parent and teacher',
  notes: null,
  created_by: { id: 1, name: 'Admin User' },
  updated_by: { id: 1, name: 'Admin User' },
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const training = {
  ...appointment,
  id: 2,
  title: 'Staff Training',
  event_type: 'training',
  is_all_day: true,
  starts_at: '2026-07-24T00:00:00.000Z',
  ends_at: null,
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

function installFetchMock() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'

    if (url.pathname.endsWith('/calendar-events') && method === 'GET') {
      return json({ data: [appointment, training] })
    }
    if (url.pathname.endsWith('/calendar-events') && method === 'POST') {
      const body = JSON.parse(String(init?.body))
      return json({ calendar_event: { ...training, ...body, id: 3 } }, 201)
    }
    if (url.pathname.endsWith('/calendar-events/1') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body))
      return json({ calendar_event: { ...appointment, ...body } })
    }
    if (url.pathname.endsWith('/calendar-events/1') && method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }

    return json({ message: `Unhandled test endpoint: ${url.pathname}` }, 404)
  })
}

function mutationRequest(method: 'POST' | 'PATCH' | 'DELETE') {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.find(([, init]) => init?.method === method)
}

function requestBody(method: 'POST' | 'PATCH') {
  const request = mutationRequest(method)
  return request ? JSON.parse(String(request[1]?.body)) : undefined
}

function renderCalendar(permissions = allPermissions) {
  const onUnauthorized = vi.fn()
  render(<CalendarPage schoolId={7} permissions={permissions} onUnauthorized={onUnauthorized} />)
  return { onUnauthorized }
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-19T04:00:00Z'))
    installFetchMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders timed and all-day events in the current month', async () => {
    renderCalendar()

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Parent Appointment/ })).toHaveTextContent('9:00 AM')
    expect(screen.getByRole('button', { name: /Parent Appointment/ })).toHaveTextContent('Appointment')
    expect(screen.getByRole('button', { name: /Staff Training/ })).not.toHaveTextContent(/AM|PM/)
    expect(screen.getByRole('button', { name: /Staff Training/ })).toHaveTextContent('Training')
  })

  it('navigates months and fetches the complete visible date range', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await screen.findByRole('heading', { name: 'July 2026' })

    await user.click(screen.getByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('start=2026-07-26'),
        expect.anything(),
      ),
    )
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('end=2026-09-05'),
      expect.anything(),
    )
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('school_id=7'),
      expect.anything(),
    )
  })

  it('creates an all-day event with a school-scoped request', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await screen.findByRole('heading', { name: 'July 2026' })

    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'Teacher Training')
    await user.selectOptions(screen.getByLabelText('Event type'), 'training')
    await user.click(screen.getByLabelText('All-day event'))
    expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), '2026-07-24')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() =>
      expect(requestBody('POST')).toMatchObject({
        title: 'Teacher Training',
        event_type: 'training',
        is_all_day: true,
        starts_at: new Date(2026, 6, 24, 0, 0, 0).toISOString(),
      }),
    )
    expect(String(mutationRequest('POST')?.[0])).toContain('/calendar-events?school_id=7')
  })

  it('preserves edited values and shows API validation errors after a failed update', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/calendar-events/1') && init?.method === 'PATCH') {
        return json(
          {
            message: 'Please check the event details.',
            errors: { title: ['The title has already been taken.'] },
          },
          422,
        )
      }
      return json({ data: [appointment, training] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await screen.findByRole('button', { name: /Parent Appointment/ })

    await user.click(screen.getByRole('button', { name: /Parent Appointment/ }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Updated Parent Appointment')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(requestBody('PATCH')?.title).toBe('Updated Parent Appointment'))
    expect(String(mutationRequest('PATCH')?.[0])).toContain('/calendar-events/1?school_id=7')
    expect(screen.getByRole('dialog', { name: 'Edit Parent Appointment' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Updated Parent Appointment')
    expect(screen.getByRole('alert')).toHaveTextContent('Please check the event details.')
    expect(screen.getByText('The title has already been taken.')).toBeInTheDocument()
  })

  it('gates create, update, and delete controls by their matching permissions', async () => {
    renderCalendar(['calendar.view'])

    expect(await screen.findByText('Parent Appointment')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Parent Appointment/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument()
  })

  it('opens a second confirmation dialog and cancels without deleting', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))

    await user.click(screen.getByRole('button', { name: 'Delete event' }))

    expect(screen.getByRole('dialog', { name: 'Delete Parent Appointment?' })).toBeInTheDocument()
    expect(
      screen.getByText('This event will be permanently removed and cannot be recovered.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel deletion' }))
    expect(mutationRequest('DELETE')).toBeUndefined()
    expect(screen.getByRole('dialog', { name: 'Edit Parent Appointment' })).toBeInTheDocument()
  })

  it('waits for one successful delete before removing the event', async () => {
    let resolveDelete!: (response: Response) => void
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/calendar-events/1') && init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve
        })
      }
      return json({ data: [appointment, training] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    await user.click(screen.getByRole('button', { name: 'Delete event' }))

    const confirm = screen.getByRole('button', { name: 'Confirm delete' })
    await user.click(confirm)

    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(
      vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => init?.method === 'DELETE'),
    ).toHaveLength(1)
    expect(screen.getByText('Parent Appointment').closest('button')).toHaveClass('calendar-event')
    expect(String(mutationRequest('DELETE')?.[0])).toContain('/calendar-events/1?school_id=7')

    resolveDelete(new Response(null, { status: 204 }))

    await waitFor(() => expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument())
  })

  it('keeps the event and confirmation visible after a failed delete', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/calendar-events/1') && init?.method === 'DELETE') {
        return json({ message: 'You cannot delete this event.' }, 403)
      }
      return json({ data: [appointment, training] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    await user.click(screen.getByRole('button', { name: 'Delete event' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot delete this event.')
    expect(screen.getByRole('dialog', { name: 'Delete Parent Appointment?' })).toBeInTheDocument()
    expect(screen.getByText('Parent Appointment').closest('button')).toHaveClass('calendar-event')
  })

  it('hides delete when update is allowed without delete permission', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar(['calendar.view', 'calendar.update'])
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))

    expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument()
  })
})
