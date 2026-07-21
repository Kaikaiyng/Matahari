import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'

const originalHostTimeZone = vi.hoisted(() => {
  const nodeProcess = (
    globalThis as unknown as { process: { env: Record<string, string | undefined> } }
  ).process
  const timeZone = nodeProcess.env.TZ
  nodeProcess.env.TZ = 'UTC'
  return timeZone
})

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

function renderCalendar(permissions = allPermissions, schoolId = 7) {
  const onUnauthorized = vi.fn()
  const result = render(
    <CalendarPage schoolId={schoolId} permissions={permissions} onUnauthorized={onUnauthorized} />,
  )
  return {
    onUnauthorized,
    rerenderCalendar(nextSchoolId: number, nextPermissions = permissions) {
      result.rerender(
        <CalendarPage
          schoolId={nextSchoolId}
          permissions={nextPermissions}
          onUnauthorized={onUnauthorized}
        />,
      )
    },
  }
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

  afterAll(() => {
    const nodeProcess = (
      globalThis as unknown as { process: { env: Record<string, string | undefined> } }
    ).process
    if (originalHostTimeZone === undefined) delete nodeProcess.env.TZ
    else nodeProcess.env.TZ = originalHostTimeZone
  })

  it('renders timed and all-day events in the current month', async () => {
    renderCalendar()

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Parent Appointment/ })).toHaveTextContent('9:00 AM')
    expect(screen.getByRole('button', { name: /Parent Appointment/ })).toHaveTextContent('Appointment')
    expect(screen.getByRole('button', { name: /Staff Training/ })).not.toHaveTextContent(/AM|PM/)
    expect(screen.getByRole('button', { name: /Staff Training/ })).toHaveTextContent('Training')
  })

  it('renders an all-day event on every date from its start through its end', async () => {
    const schoolHoliday = {
      ...training,
      id: 62,
      title: 'School Holiday',
      starts_at: '2026-07-21T00:00:00.000Z',
      ends_at: '2026-07-25T00:00:00.000Z',
    }
    vi.mocked(globalThis.fetch).mockImplementation(() => json({ data: [schoolHoliday] }))

    renderCalendar()

    await screen.findByRole('heading', { name: 'July 2026' })
    for (const day of [21, 22, 23, 24, 25]) {
      expect(
        within(screen.getByRole('region', { name: `${day} July 2026` })).getByText(
          'School Holiday',
        ),
      ).toBeInTheDocument()
    }
    for (const day of [20, 26]) {
      expect(
        within(screen.getByRole('region', { name: `${day} July 2026` })).queryByText(
          'School Holiday',
        ),
      ).not.toBeInTheDocument()
    }
  })

  it('uses Malaysia time for timed display and day bucketing on a UTC host', async () => {
    const midnightInMalaysia = {
      ...appointment,
      id: 60,
      title: 'Midnight Meeting',
      starts_at: '2026-07-20T16:30:00.000Z',
      ends_at: '2026-07-20T17:30:00.000Z',
    }
    const stableAllDay = {
      ...training,
      id: 61,
      title: 'Malaysia Holiday',
      starts_at: '2026-07-21T00:00:00.000Z',
    }
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      json({ data: [midnightInMalaysia, stableAllDay] }),
    )
    renderCalendar()

    const malaysiaDay = await screen.findByRole('region', { name: '21 July 2026' })
    expect(within(malaysiaDay).getByRole('button', { name: /Midnight Meeting/ })).toHaveTextContent(
      '12:30 AM',
    )
    expect(within(malaysiaDay).getByText('Malaysia Holiday')).toBeInTheDocument()
    expect(within(malaysiaDay).getByRole('button', { name: /Malaysia Holiday/ })).not.toHaveTextContent(
      /AM|PM/,
    )
    expect(
      within(screen.getByRole('region', { name: '20 July 2026' })).queryByText('Midnight Meeting'),
    ).not.toBeInTheDocument()
  })

  it('serializes a timed form value as Malaysia local time on a UTC host', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'Morning Briefing')
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), '2026-07-26')
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), '09:15')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() =>
      expect(requestBody('POST')?.starts_at).toBe('2026-07-26T01:15:00.000Z'),
    )
  })

  it('submits the date and time values currently shown by native controls', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'Browser-filled training')

    ;(screen.getByLabelText('Start date') as HTMLInputElement).value = '2026-07-22'
    ;(screen.getByLabelText('Start time') as HTMLInputElement).value = '10:00'
    ;(screen.getByLabelText('End date') as HTMLInputElement).value = '2026-07-22'
    ;(screen.getByLabelText('End time') as HTMLInputElement).value = '11:30'

    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() =>
      expect(requestBody('POST')).toMatchObject({
        starts_at: '2026-07-22T02:00:00.000Z',
        ends_at: '2026-07-22T03:30:00.000Z',
      }),
    )
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

  it('highlights today and returns to the current school month', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()

    const today = screen.getByRole('region', { name: '19 July 2026' })
    expect(today).toHaveClass('calendar-today')
    expect(today).toHaveAttribute('aria-current', 'date')

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Today' }))

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '19 July 2026' })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('persists and renders an all-day date at UTC midnight in Malaysia', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await screen.findByRole('heading', { name: 'July 2026' })

    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'Boundary Training')
    await user.selectOptions(screen.getByLabelText('Event type'), 'training')
    await user.click(screen.getByLabelText('All-day event'))
    expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), '2026-07-26')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() =>
      expect(requestBody('POST')).toMatchObject({
        title: 'Boundary Training',
        event_type: 'training',
        is_all_day: true,
        starts_at: '2026-07-26T00:00:00.000Z',
      }),
    )
    expect(String(mutationRequest('POST')?.[0])).toContain('/calendar-events?school_id=7')
    expect(
      within(screen.getByRole('region', { name: '26 July 2026' })).getByText('Boundary Training'),
    ).toBeInTheDocument()
  })

  it('buckets all-day events by UTC date and includes the visible-range boundary', async () => {
    const utcDatedEvent = {
      ...training,
      id: 40,
      title: 'UTC Dated Event',
      starts_at: '2026-07-25T18:00:00.000Z',
    }
    const boundaryEvent = {
      ...training,
      id: 41,
      title: 'Boundary Holiday',
      starts_at: '2026-07-26T00:00:00.000Z',
    }
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input))
      return json({
        data: url.searchParams.get('start') === '2026-07-26' ? [boundaryEvent] : [utcDatedEvent],
      })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()

    expect(
      within(await screen.findByRole('region', { name: '25 July 2026' })).getByText(
        'UTC Dated Event',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: '26 July 2026' })).queryByText('UTC Dated Event'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next month' }))

    expect(
      within(await screen.findByRole('region', { name: '26 July 2026' })).getByText(
        'Boundary Holiday',
      ),
    ).toBeInTheDocument()
  })

  it('clears prior-school events immediately and keeps them cleared when reload fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((input) => {
      const url = new URL(String(input))
      if (url.searchParams.get('school_id') === '8') {
        return json({ message: 'Unable to load the new school calendar.' }, 422)
      }
      return json({ data: [appointment] })
    })
    const { rerenderCalendar } = renderCalendar()
    expect(await screen.findByText('Parent Appointment')).toBeInTheDocument()

    rerenderCalendar(8)

    expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load the new school calendar.',
    )
    expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument()
  })

  it('announces loading and shows No events only after a successful empty response', async () => {
    let resolveLoad!: (response: Response) => void
    vi.mocked(globalThis.fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveLoad = resolve
        }),
    )
    renderCalendar()

    expect(screen.getByRole('status')).toHaveTextContent('Loading calendar events')
    expect(screen.queryByText('No events')).not.toBeInTheDocument()

    await act(async () => {
      resolveLoad(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    expect(await screen.findByText('No events')).toBeInTheDocument()
    expect(screen.queryByText('Loading calendar events')).not.toBeInTheDocument()
  })

  it('keeps a failed request distinguishable from a successful empty calendar', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      json({ message: 'Calendar unavailable.' }, 422),
    )
    renderCalendar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Calendar unavailable.')
    expect(screen.queryByText('Loading calendar events')).not.toBeInTheDocument()
    expect(screen.queryByText('No events')).not.toBeInTheDocument()
  })

  it('returns to loading on month change before showing the next empty result', async () => {
    let resolveNextMonth!: (response: Response) => void
    let getCount = 0
    vi.mocked(globalThis.fetch).mockImplementation(() => {
      getCount += 1
      if (getCount === 1) return json({ data: [appointment] })
      return new Promise<Response>((resolve) => {
        resolveNextMonth = resolve
      })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    expect(await screen.findByText('Parent Appointment')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading calendar events')
    expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument()
    expect(screen.queryByText('No events')).not.toBeInTheDocument()

    await act(async () => {
      resolveNextMonth(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    expect(await screen.findByText('No events')).toBeInTheDocument()
  })

  it('does not let an older GET replace a successful mutation result', async () => {
    let resolveGet!: (response: Response) => void
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        return json({ calendar_event: { ...appointment, ...body, id: 50 } }, 201)
      }
      if (url.pathname.endsWith('/calendar-events')) {
        return new Promise<Response>((resolve) => {
          resolveGet = resolve
        })
      }
      return json({ message: 'Unhandled request' }, 404)
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'New Calendar Event')
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(await screen.findByText('New Calendar Event')).toBeInTheDocument()

    await act(async () => {
      resolveGet(
        new Response(JSON.stringify({ data: [appointment] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    expect(screen.getByText('New Calendar Event')).toBeInTheDocument()
  })

  it('keeps a future month empty when a new event defaults outside its visible range', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return json({
          data: url.searchParams.get('start') === '2026-07-26' ? [] : [appointment],
        })
      }
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body))
        return json({ calendar_event: { ...appointment, ...body, id: 70 } }, 201)
      }
      return json({ message: 'Unhandled request' }, 404)
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await screen.findByText('Parent Appointment')

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
    expect(await screen.findByText('No events')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add event' }))
    await user.type(screen.getByLabelText('Title'), 'Default Today Event')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('No events')).toBeInTheDocument()
    expect(screen.queryByText('Default Today Event')).not.toBeInTheDocument()
  })

  it('removes the sole visible event when an edit moves it outside the visible range', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      if (method === 'GET') return json({ data: [appointment] })
      if (url.pathname.endsWith('/calendar-events/1') && method === 'PATCH') {
        const body = JSON.parse(String(init?.body))
        return json({ calendar_event: { ...appointment, ...body } })
      }
      return json({ message: 'Unhandled request' }, 404)
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), '2026-09-30')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('No events')).toBeInTheDocument()
    expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument()
  })

  it('does not merge a mutation response after the active school changes', async () => {
    const schoolEightEvent = {
      ...appointment,
      id: 1,
      school_id: 8,
      title: 'School Eight Meeting',
    }
    let resolvePatch!: (response: Response) => void
    vi.mocked(globalThis.fetch).mockImplementation((input, init) => {
      const url = new URL(String(input))
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve
        })
      }
      return json({ data: url.searchParams.get('school_id') === '8' ? [schoolEightEvent] : [appointment] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { rerenderCalendar } = renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Stale School Update')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mutationRequest('PATCH')).toBeDefined())

    rerenderCalendar(8)
    expect(await screen.findByText('School Eight Meeting')).toBeInTheDocument()

    await act(async () => {
      resolvePatch(
        new Response(
          JSON.stringify({
            calendar_event: { ...appointment, title: 'Stale School Update' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    })

    expect(screen.getByText('School Eight Meeting')).toBeInTheDocument()
    expect(screen.queryByText('Stale School Update')).not.toBeInTheDocument()
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

  it('lets a delete-only role open read-only details and delete the event', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar(['calendar.view', 'calendar.delete'])
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))

    expect(screen.getByRole('dialog', { name: 'Parent Appointment details' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete event' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(screen.queryByText('Parent Appointment')).not.toBeInTheDocument())
  })

  it('mounts one modal and Escape returns to unsaved edit values', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Unsaved Parent Appointment')
    await user.click(screen.getByRole('button', { name: 'Delete event' }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Delete Parent Appointment?' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Edit Parent Appointment' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved Parent Appointment')
  })

  it('clears mapped timestamp errors when either source field changes', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((_input, init) => {
      if (init?.method === 'PATCH') {
        return json(
          {
            message: 'Please check the event times.',
            errors: {
              starts_at: ['The start is invalid.'],
              ends_at: ['The end is invalid.'],
            },
          },
          422,
        )
      }
      return json({ data: [appointment] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    const startDate = screen.getByLabelText('Start date')
    const startTime = screen.getByLabelText('Start time')
    const endDate = screen.getByLabelText('End date')
    const endTime = screen.getByLabelText('End time')
    const submit = screen.getByRole('button', { name: 'Save changes' })

    await user.click(submit)
    expect(await screen.findByText('The start is invalid.')).toBeInTheDocument()
    expect(screen.getByText('The end is invalid.')).toBeInTheDocument()

    await user.clear(startDate)
    await user.type(startDate, '2026-07-21')
    expect(screen.queryByText('The start is invalid.')).not.toBeInTheDocument()
    await user.click(submit)
    expect(await screen.findByText('The start is invalid.')).toBeInTheDocument()

    await user.clear(startTime)
    await user.type(startTime, '10:00')
    expect(screen.queryByText('The start is invalid.')).not.toBeInTheDocument()
    await user.click(submit)
    expect(await screen.findByText('The end is invalid.')).toBeInTheDocument()

    await user.clear(endDate)
    await user.type(endDate, '2026-07-21')
    expect(screen.queryByText('The end is invalid.')).not.toBeInTheDocument()
    await user.click(submit)
    expect(await screen.findByText('The end is invalid.')).toBeInTheDocument()

    await user.clear(endTime)
    await user.type(endTime, '11:00')
    expect(screen.queryByText('The end is invalid.')).not.toBeInTheDocument()
  })

  it('associates event type and all-day API errors with their controls', async () => {
    vi.mocked(globalThis.fetch).mockImplementation((_input, init) => {
      if (init?.method === 'PATCH') {
        return json(
          {
            message: 'Please check the event classification.',
            errors: {
              event_type: ['Choose a supported event type.'],
              is_all_day: ['Specify whether this is an all-day event.'],
            },
          },
          422,
        )
      }
      return json({ data: [appointment] })
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCalendar()
    await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))
    const eventType = screen.getByLabelText('Event type')
    const allDay = screen.getByLabelText('All-day event')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Choose a supported event type.')).toBeInTheDocument()
    expect(screen.getByText('Specify whether this is an all-day event.')).toBeInTheDocument()
    expect(eventType).toHaveAttribute('aria-invalid', 'true')
    expect(eventType).toHaveAttribute('aria-describedby', 'calendar-event-type-errors')
    expect(document.getElementById('calendar-event-type-errors')).toHaveTextContent(
      'Choose a supported event type.',
    )
    expect(allDay).toHaveAttribute('aria-invalid', 'true')
    expect(allDay).toHaveAttribute('aria-describedby', 'calendar-is-all-day-errors')
    expect(document.getElementById('calendar-is-all-day-errors')).toHaveTextContent(
      'Specify whether this is an all-day event.',
    )

    await user.selectOptions(eventType, 'meeting')
    expect(eventType).toHaveAttribute('aria-invalid', 'false')
    expect(eventType).not.toHaveAttribute('aria-describedby')
    await user.click(allDay)
    expect(allDay).toHaveAttribute('aria-invalid', 'false')
    expect(allDay).not.toHaveAttribute('aria-describedby')
  })
})
