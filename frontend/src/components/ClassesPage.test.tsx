import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassesPage } from './ClassesPage'

const classes = [
  { id: 1, name: 'Kindergarten', level_group: 'kindergarten' },
  { id: 2, name: 'MA1', level_group: 'primary' },
  { id: 3, name: 'MB1', level_group: 'primary' },
  { id: 4, name: 'MC1', level_group: 'primary' },
  { id: 5, name: 'MD1', level_group: 'primary' },
  { id: 6, name: 'ME1', level_group: 'primary' },
  { id: 7, name: 'MF1', level_group: 'primary' },
  { id: 8, name: 'MP1', level_group: 'secondary' },
  { id: 9, name: 'MQ1', level_group: 'secondary' },
  { id: 10, name: 'MR1', level_group: 'secondary' },
  { id: 11, name: 'MS1', level_group: 'secondary' },
  { id: 12, name: 'MT1', level_group: 'secondary' },
  { id: 13, name: 'STP', level_group: 'stp' },
]

const students = [
  {
    id: 21,
    student_no: 'MIS-021',
    full_name: 'Amina Lee',
    level_group: 'primary',
    class: { id: 2, name: 'MA1' },
    status: 'active',
  },
  {
    id: 22,
    student_no: 'MIS-022',
    full_name: 'Inactive Child',
    level_group: 'primary',
    class: { id: 2, name: 'MA1' },
    status: 'inactive',
  },
]

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

function installSuccessApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input), window.location.origin)
    if (url.pathname.endsWith('/classes')) return json({ data: classes })
    if (url.pathname.endsWith('/students')) return json({ data: students })
    return json({ message: 'Not found' }, 404)
  })
}

afterEach(() => vi.restoreAllMocks())

describe('ClassesPage', () => {
  it('opens the standalone Attendance overview and enters a daily sheet directly', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/classes')) return json({ data: classes })
      if (url.pathname.endsWith('/students')) return json({ data: students })
      if (url.pathname.endsWith('/attendance/overview')) {
        return json({
          data: {
            attendance_date: '2026-08-23',
            academic_year: { id: 1, name: '2026' },
            totals: { attendance_rate: 86, total_enrolled: 7, recorded_count: 6, present: 4, late: 1, absent: 1, excused: 0 },
            classes: [
              { class_id: 2, class_name: 'MA1', level_group: 'primary', enrolled_count: 1, is_submitted: false, submitted_at: null, counts: { present: 0, late: 0, absent: 0, excused: 0 } },
            ],
          },
        })
      }
      if (url.pathname.endsWith('/attendance/daily')) {
        return json({
          data: {
            class: { id: 2, name: 'MA1', level_group: 'primary' },
            academic_year_id: 1,
            attendance_date: '2026-08-23',
            is_submitted: false,
            submitted_at: null,
            students: [
              { student_id: 21, student_no: 'MIS-021', full_name: 'Amina Lee', status: 'unmarked', public_note: null },
            ],
          },
        })
      }
      return json({}, 404)
    })

    render(
      <ClassesPage
        mode="attendance"
        permissions={['attendance.view_school', 'attendance.manage_school']}
        onOpenStudent={vi.fn()}
        onUnauthorized={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Attendance' })).toBeInTheDocument()
    expect(screen.getByText('86%')).toBeInTheDocument()
    expect(screen.getByText('1 class pending')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View MA1' }))

    expect(await screen.findByText('ATTENDANCE RATE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Student Roster/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Attendance' })).toBeInTheDocument()
  })

  it('does not request data without students.view', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<ClassesPage permissions={[]} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('permission')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('groups all configured classes and counts only Active students', async () => {
    installSuccessApi()

    render(
      <ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />,
    )

    expect(await screen.findByRole('heading', { name: 'Kindergarten', level: 3 })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Kindergarten',
      'Primary',
      'Secondary',
      'STP',
    ])
    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(13)
    expect(within(screen.getByTestId('class-card-2')).getByText('1 Active student')).toBeInTheDocument()
    expect(within(screen.getByTestId('class-card-8')).getByText('0 Active students')).toBeInTheDocument()

    const studentRequest = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/students'))
    expect(new URL(String(studentRequest?.[0]), window.location.origin).searchParams.get('status')).toBe('active')
  })

  it('opens an Active roster and forwards the selected class with the student', async () => {
    const user = userEvent.setup()
    const onOpenStudent = vi.fn()
    installSuccessApi()

    render(
      <ClassesPage
        permissions={['students.view']}
        onOpenStudent={onOpenStudent}
        onUnauthorized={vi.fn()}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'View MA1' }))
    expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()
    expect(screen.getByText('Amina Lee')).toBeInTheDocument()
    expect(screen.queryByText('Inactive Child')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Amina Lee' }))
    expect(onOpenStudent).toHaveBeenCalledWith(21, classes[1])
  })

  it('keeps Classes roster-focused and deep-links to the selected class register', async () => {
    const user = userEvent.setup()
    const onOpenAttendance = vi.fn()
    installSuccessApi()

    render(
      <ClassesPage
        permissions={['students.view']}
        onOpenStudent={vi.fn()}
        onOpenAttendance={onOpenAttendance}
        onUnauthorized={vi.fn()}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'View MA1' }))

    expect(screen.queryByRole('button', { name: 'Daily Attendance' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Class Register' }))
    expect(onOpenAttendance).toHaveBeenCalledWith(2)
  })

  it('restores initialClassId and shows a zero-student message', async () => {
    installSuccessApi()

    render(
      <ClassesPage
        permissions={['students.view']}
        initialClassId={8}
        onOpenStudent={vi.fn()}
        onUnauthorized={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'MP1' })).toBeInTheDocument()
    expect(screen.getByText('No active students in this class.')).toBeInTheDocument()
  })

  it('retries a failed directory request', async () => {
    const user = userEvent.setup()
    let shouldFail = true
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)
      if (shouldFail && url.pathname.endsWith('/classes')) {
        return json({ message: 'Service unavailable' }, 500)
      }
      if (url.pathname.endsWith('/classes')) return json({ data: classes })
      if (url.pathname.endsWith('/students')) return json({ data: students })
      return json({}, 404)
    })

    render(
      <ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service is temporarily unavailable. Please try again.',
    )
    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Primary' })).toBeInTheDocument()
  })

  it('shows an empty class catalog', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ data: [] }))

    render(
      <ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />,
    )

    expect(await screen.findByText('No classes are configured.')).toBeInTheDocument()
  })

  it('opens the standalone class register and allows recording attendance', async () => {
    document.cookie = 'XSRF-TOKEN=test-token; path=/'
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin)
      const method = (init?.method || 'GET').toUpperCase()
      if (url.pathname.endsWith('/csrf-cookie')) return Promise.resolve(new Response(null, { status: 204 }))
      if (url.pathname.endsWith('/classes')) return json({ data: classes })
      if (url.pathname.endsWith('/students')) return json({ data: students })
      if (url.pathname.endsWith('/attendance/overview')) {
        return json({
          data: {
            attendance_date: '2026-08-17',
            academic_year: { id: 1, name: '2026' },
            totals: { attendance_rate: 100, total_enrolled: 1, recorded_count: 1, present: 1, late: 0, absent: 0, excused: 0 },
            classes: [
              { class_id: 2, class_name: 'MA1', level_group: 'primary', enrolled_count: 1, is_submitted: false, submitted_at: null, counts: { present: 0, late: 0, absent: 0, excused: 0 } },
            ],
          },
        })
      }
      if (url.pathname.endsWith('/attendance/daily') && method === 'POST') {
        return json({ data: { status: 'submitted' } })
      }
      if (url.pathname.endsWith('/attendance/daily') && method === 'GET') {
        return json({
          data: {
            class: { id: 2, name: 'MA1', level_group: 'primary' },
            academic_year_id: 1,
            attendance_date: '2026-08-17',
            is_submitted: false,
            submitted_at: null,
            students: [
              { student_id: 21, student_no: 'MIS-021', full_name: 'Amina Lee', status: 'present', public_note: null },
            ],
          },
        })
      }
      return json({}, 404)
    })

    render(
      <ClassesPage
        mode="attendance"
        initialClassId={2}
        permissions={['attendance.view_school', 'attendance.manage_school']}
        onOpenStudent={vi.fn()}
        onUnauthorized={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'MA1' })).toBeInTheDocument()
    expect(await screen.findByText('ATTENDANCE RATE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark All Present' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit Attendance' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit Attendance' }))
    expect(await screen.findByText('Daily attendance submitted successfully.')).toBeInTheDocument()
  })

  it('hands a 401 to the application session handler', async () => {
    const onUnauthorized = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ message: 'Unauthenticated.' }, 401))

    render(
      <ClassesPage
        permissions={['students.view']}
        onOpenStudent={vi.fn()}
        onUnauthorized={onUnauthorized}
      />,
    )

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
  })
})
