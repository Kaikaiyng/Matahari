import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ApiError, apiRequest } from '../api'
import type { ApiValidationErrors } from '../api'
import { InlineMessage, ModalContextSummary, ModalFrame, PageHeader } from './AdminUi'
import './CalendarPage.css'

export type CalendarEvent = {
  id: number
  school_id: number
  title: string
  event_type: 'appointment' | 'training' | 'meeting' | 'school_event' | 'other'
  is_all_day: boolean
  starts_at: string
  ends_at: string | null
  location: string | null
  participants: string | null
  notes: string | null
  created_by: { id: number; name: string } | null
  updated_by: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

export type CalendarEventForm = {
  title: string
  event_type: CalendarEvent['event_type']
  is_all_day: boolean
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  location: string
  participants: string
  notes: string
}

type CalendarPageProps = {
  schoolId: number
  permissions: string[]
  onUnauthorized: () => void
}

const SCHOOL_TIME_ZONE = 'Asia/Kuala_Lumpur'
const monthFormatter = new Intl.DateTimeFormat('en-MY', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const timeFormatter = new Intl.DateTimeFormat('en-MY', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: SCHOOL_TIME_ZONE,
})
const schoolDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: SCHOOL_TIME_ZONE,
})
const weekdayFormatter = new Intl.DateTimeFormat('en-MY', {
  weekday: 'short',
  timeZone: 'UTC',
})
const calendarDateFormatter = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const eventTypeLabels: Record<CalendarEvent['event_type'], string> = {
  appointment: 'Appointment',
  training: 'Training',
  meeting: 'Meeting',
  school_event: 'School event',
  other: 'Other',
}
const EVENT_TYPE_ERROR_ID = 'calendar-event-type-errors'
const IS_ALL_DAY_ERROR_ID = 'calendar-is-all-day-errors'

function dateKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function schoolDateTimeParts(date: Date) {
  const parts = Object.fromEntries(
    schoolDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

function schoolDateKey(date: Date) {
  const { year, month, day } = schoolDateTimeParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function calendarMonthFor(date: Date) {
  const { year, month } = schoolDateTimeParts(date)
  return new Date(Date.UTC(year, month - 1, 1, 12))
}

function startOfCalendarGrid(month: Date) {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12))
  first.setUTCDate(first.getUTCDate() - first.getUTCDay())
  return first
}

function visibleDates(month: Date) {
  const start = startOfCalendarGrid(month)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date
  })
}

function eventDateKey(event: CalendarEvent) {
  if (event.is_all_day) return new Date(event.starts_at).toISOString().slice(0, 10)
  return schoolDateKey(new Date(event.starts_at))
}

function eventEndDateKey(event: CalendarEvent) {
  if (!event.ends_at) return eventDateKey(event)
  if (event.is_all_day) return new Date(event.ends_at).toISOString().slice(0, 10)
  return schoolDateKey(new Date(event.ends_at))
}

function eventOccursOnDate(event: CalendarEvent, date: string) {
  return date >= eventDateKey(event) && date <= eventEndDateKey(event)
}

function eventIsInRange(event: CalendarEvent, rangeStart: string, rangeEnd: string) {
  return eventDateKey(event) <= rangeEnd && eventEndDateKey(event) >= rangeStart
}

function eventLabel(event: CalendarEvent) {
  return (
    <>
      {!event.is_all_day && (
        <span className="calendar-event-time">
          {timeFormatter.format(new Date(event.starts_at)).toUpperCase()}
        </span>
      )}
      <span className="calendar-event-title">{event.title}</span>
      <span className="calendar-event-type">{eventTypeLabels[event.event_type]}</span>
    </>
  )
}

function eventScheduleLabel(event: CalendarEvent) {
  const startDateKey = eventDateKey(event)
  const endDateKey = eventEndDateKey(event)
  const formatDateKey = (value: string) =>
    calendarDateFormatter.format(new Date(`${value}T12:00:00.000Z`))
  const dateRange =
    startDateKey === endDateKey
      ? formatDateKey(startDateKey)
      : `${formatDateKey(startDateKey)} – ${formatDateKey(endDateKey)}`

  if (event.is_all_day) return `${dateRange}, all day`

  const startTime = timeFormatter.format(new Date(event.starts_at))
  const endTime = event.ends_at ? timeFormatter.format(new Date(event.ends_at)) : ''
  return `${dateRange}, ${startTime}${endTime ? ` – ${endTime}` : ''}`
}

function emptyForm(): CalendarEventForm {
  return {
    title: '',
    event_type: 'school_event',
    is_all_day: false,
    start_date: schoolDateKey(new Date()),
    start_time: '09:00',
    end_date: '',
    end_time: '',
    location: '',
    participants: '',
    notes: '',
  }
}

function schoolTime(date: Date) {
  const { hour, minute } = schoolDateTimeParts(date)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formFromEvent(event: CalendarEvent): CalendarEventForm {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null

  return {
    title: event.title,
    event_type: event.event_type,
    is_all_day: event.is_all_day,
    start_date: event.is_all_day ? start.toISOString().slice(0, 10) : schoolDateKey(start),
    start_time: event.is_all_day ? '00:00' : schoolTime(start),
    end_date: end
      ? event.is_all_day
        ? end.toISOString().slice(0, 10)
        : schoolDateKey(end)
      : '',
    end_time: end ? (event.is_all_day ? '00:00' : schoolTime(end)) : '',
    location: event.location ?? '',
    participants: event.participants ?? '',
    notes: event.notes ?? '',
  }
}

function timeZoneOffsetMilliseconds(date: Date) {
  const { year, month, day, hour, minute, second } = schoolDateTimeParts(date)
  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime()
}

function toSchoolIso(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let instant = new Date(wallClockAsUtc)
  let offset = timeZoneOffsetMilliseconds(instant)
  instant = new Date(wallClockAsUtc - offset)
  const correctedOffset = timeZoneOffsetMilliseconds(instant)
  if (correctedOffset !== offset) {
    offset = correctedOffset
    instant = new Date(wallClockAsUtc - offset)
  }
  return instant.toISOString()
}

function toUtcMidnightIso(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toISOString()
}

function eventPayload(form: CalendarEventForm) {
  const hasEnd = form.is_all_day
    ? Boolean(form.end_date)
    : Boolean(form.end_date && form.end_time)

  return {
    title: form.title.trim(),
    event_type: form.event_type,
    is_all_day: form.is_all_day,
    starts_at: form.is_all_day
      ? toUtcMidnightIso(form.start_date)
      : toSchoolIso(form.start_date, form.start_time),
    ends_at: hasEnd
      ? form.is_all_day
        ? toUtcMidnightIso(form.end_date)
        : toSchoolIso(form.end_date, form.end_time)
      : null,
    location: form.location.trim() || null,
    participants: form.participants.trim() || null,
    notes: form.notes.trim() || null,
  }
}

export function CalendarPage({ schoolId, permissions, onUnauthorized }: CalendarPageProps) {
  const [displayedMonth, setDisplayedMonth] = useState(
    () => calendarMonthFor(new Date()),
  )
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<{
    scope: string | null
    status: 'idle' | 'loading' | 'success' | 'error'
    error: string
  }>({ scope: null, status: 'idle', error: '' })
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null | undefined>(undefined)
  const [form, setForm] = useState<CalendarEventForm>(() => emptyForm())
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ApiValidationErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const dates = useMemo(() => visibleDates(displayedMonth), [displayedMonth])
  const canView = permissions.includes('calendar.view')
  const canCreate = permissions.includes('calendar.create')
  const canUpdate = permissions.includes('calendar.update')
  const canDelete = permissions.includes('calendar.delete')
  const canOpenEvent = canUpdate || canDelete
  const todayKey = schoolDateKey(new Date())
  const rangeStart = dateKey(dates[0])
  const rangeEnd = dateKey(dates[dates.length - 1])
  const scopeKey = `${canView ? 'view' : 'hidden'}:${schoolId}:${rangeStart}:${rangeEnd}`
  const activeScopeRef = useRef(scopeKey)
  const previousScopeRef = useRef(scopeKey)
  const requestGenerationRef = useRef(0)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const viewCloseRef = useRef<HTMLButtonElement>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const visibleEvents = loadedScope === scopeKey ? events : []
  const visibleLoadState =
    loadState.scope === scopeKey
      ? loadState
      : { scope: scopeKey, status: canView ? ('loading' as const) : ('idle' as const), error: '' }
  activeScopeRef.current = scopeKey
  onUnauthorizedRef.current = onUnauthorized
  const calendarDialogTitle = editingEvent
    ? canUpdate
      ? 'Edit Calendar Event'
      : 'View Calendar Event'
    : 'Add Calendar Event'

  useEffect(() => {
    const scopeChanged = previousScopeRef.current !== scopeKey
    previousScopeRef.current = scopeKey
    const generation = ++requestGenerationRef.current
    const controller = new AbortController()

    setEvents([])
    setLoadedScope(scopeKey)
    setLoadState({
      scope: scopeKey,
      status: canView ? 'loading' : 'idle',
      error: '',
    })
    if (scopeChanged) {
      setEditingEvent(undefined)
      setEventToDelete(null)
      setFormError('')
      setFieldErrors({})
      setDeleteError('')
    }

    if (!canView) {
      return () => controller.abort()
    }

    const params = new URLSearchParams({
      school_id: String(schoolId),
      start: rangeStart,
      end: rangeEnd,
    })

    apiRequest<{ data: CalendarEvent[] }>(`/calendar-events?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (
          !controller.signal.aborted &&
          activeScopeRef.current === scopeKey &&
          requestGenerationRef.current === generation
        ) {
          setEvents(response.data)
          setLoadedScope(scopeKey)
          setLoadState({ scope: scopeKey, status: 'success', error: '' })
        }
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          activeScopeRef.current !== scopeKey ||
          requestGenerationRef.current !== generation
        ) {
          return
        }
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorizedRef.current()
          return
        }
        setLoadState({
          scope: scopeKey,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to load calendar events.',
        })
      })

    return () => controller.abort()
  }, [canView, rangeEnd, rangeStart, schoolId, scopeKey])

  const changeMonth = (offset: number) => {
    setDisplayedMonth(
      (month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1, 12)),
    )
  }

  const goToToday = () => setDisplayedMonth(calendarMonthFor(new Date()))

  const openCreate = () => {
    setForm(emptyForm())
    setFormError('')
    setFieldErrors({})
    setEditingEvent(null)
  }

  const openEdit = (event: CalendarEvent) => {
    setForm(formFromEvent(event))
    setFormError('')
    setFieldErrors({})
    setEditingEvent(event)
  }

  const closeForm = () => {
    if (!isSaving) setEditingEvent(undefined)
  }

  const updateForm = <Key extends keyof CalendarEventForm>(
    key: Key,
    value: CalendarEventForm[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      const mappedKey =
        key === 'start_date' || key === 'start_time'
          ? 'starts_at'
          : key === 'end_date' || key === 'end_time'
            ? 'ends_at'
            : key
      return { ...current, [key]: [], [mappedKey]: [] }
    })
  }

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editingEvent && !canUpdate) return
    const controls = event.currentTarget.elements
    const submittedForm: CalendarEventForm = {
      ...form,
      start_date: (controls.namedItem('start_date') as HTMLInputElement | null)?.value ?? form.start_date,
      start_time: (controls.namedItem('start_time') as HTMLInputElement | null)?.value ?? form.start_time,
      end_date: (controls.namedItem('end_date') as HTMLInputElement | null)?.value ?? form.end_date,
      end_time: (controls.namedItem('end_time') as HTMLInputElement | null)?.value ?? form.end_time,
    }
    const localErrors: ApiValidationErrors = {}
    if (!submittedForm.title.trim()) localErrors.title = ['A title is required.']
    if (!submittedForm.start_date) localErrors.start_date = ['A start date is required.']
    if (!submittedForm.is_all_day && !submittedForm.start_time) {
      localErrors.start_time = ['A start time is required for timed events.']
    }
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors)
      setFormError('Please check the event details.')
      return
    }

    setIsSaving(true)
    setFormError('')
    setFieldErrors({})
    const mutationScope = activeScopeRef.current

    try {
      const eventBeingEdited = editingEvent ?? null
      const path = eventBeingEdited
        ? `/calendar-events/${eventBeingEdited.id}?school_id=${schoolId}`
        : `/calendar-events?school_id=${schoolId}`
      const response = await apiRequest<{ calendar_event: CalendarEvent }>(path, {
        method: eventBeingEdited ? 'PATCH' : 'POST',
        body: eventPayload(submittedForm),
      })

      if (activeScopeRef.current !== mutationScope) return
      requestGenerationRef.current += 1

      setEvents((current) => {
        const mergedEvents = eventBeingEdited
          ? current.map((item) =>
              item.id === response.calendar_event.id ? response.calendar_event : item,
            )
          : [...current, response.calendar_event]
        return mergedEvents.filter((event) => eventIsInRange(event, rangeStart, rangeEnd))
      })
      setLoadedScope(mutationScope)
      setLoadState({ scope: mutationScope, status: 'success', error: '' })
      setEditingEvent(undefined)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (activeScopeRef.current === mutationScope) onUnauthorizedRef.current()
      } else {
        if (activeScopeRef.current !== mutationScope) return
        setFormError(error instanceof Error ? error.message : 'Unable to save the event.')
        if (error instanceof ApiError && error.errors) setFieldErrors(error.errors)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteConfirmation = () => {
    if (!editingEvent) return
    setDeleteError('')
    setEventToDelete(editingEvent)
  }

  const closeDeleteConfirmation = () => {
    if (!isDeleting) setEventToDelete(null)
  }

  const confirmDelete = async () => {
    if (!eventToDelete || isDeleting) return

    const targetEvent = eventToDelete
    const mutationScope = activeScopeRef.current
    setIsDeleting(true)
    setDeleteError('')
    try {
      await apiRequest<void>(
        `/calendar-events/${targetEvent.id}?school_id=${schoolId}`,
        { method: 'DELETE' },
      )
      if (activeScopeRef.current !== mutationScope) return
      requestGenerationRef.current += 1
      setEvents((current) => current.filter((event) => event.id !== targetEvent.id))
      setLoadedScope(mutationScope)
      setLoadState({ scope: mutationScope, status: 'success', error: '' })
      setEventToDelete(null)
      setEditingEvent(undefined)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (activeScopeRef.current === mutationScope) onUnauthorizedRef.current()
      } else {
        if (activeScopeRef.current !== mutationScope) return
        setDeleteError(error instanceof Error ? error.message : 'Unable to delete the event.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="calendar-page">
      <PageHeader
        eyebrow="School operations"
        title="Calendar"
        description="Plan appointments, training, meetings, and school events."
        action={
          canCreate ? (
            <button className="primary-action compact" type="button" onClick={openCreate}>
              <Plus size={17} />
              Add event
            </button>
          ) : undefined
        }
      />

      <section className="calendar-panel" aria-label="School calendar">
        <header className="calendar-toolbar">
          <div className="calendar-title">
            <CalendarDays size={20} aria-hidden="true" />
            <h2>{monthFormatter.format(displayedMonth)}</h2>
          </div>
          <div className="calendar-navigation">
            <button className="secondary-action calendar-today-action" type="button" onClick={goToToday}>
              Today
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </header>

        {visibleLoadState.status === 'loading' && (
          <div className="calendar-request-state" role="status" aria-live="polite">
            Loading calendar events…
          </div>
        )}
        {visibleLoadState.status === 'error' && (
          <InlineMessage tone="error">{visibleLoadState.error}</InlineMessage>
        )}
        {visibleLoadState.status === 'success' && visibleEvents.length === 0 && (
          <div className="calendar-request-state calendar-empty-state" role="status">
            No events
          </div>
        )}
        {!canView && (
          <InlineMessage tone="info">You do not have permission to view calendar events.</InlineMessage>
        )}

        <div className="calendar-weekdays" aria-hidden="true">
          {dates.slice(0, 7).map((date) => (
            <span key={dateKey(date)}>{weekdayFormatter.format(date)}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {dates.map((date) => {
            const dayEvents = visibleEvents.filter((event) =>
              eventOccursOnDate(event, dateKey(date)),
            )
            const isCurrentMonth = date.getUTCMonth() === displayedMonth.getUTCMonth()
            const isToday = dateKey(date) === todayKey

            return (
              <section
                key={dateKey(date)}
                className={`calendar-day${isCurrentMonth ? '' : ' outside-month'}${isCurrentMonth || dayEvents.length ? ' calendar-mobile-day' : ''}${isToday ? ' calendar-today' : ''}`}
                aria-current={isToday ? 'date' : undefined}
                aria-label={calendarDateFormatter.format(date)}
              >
                <span className="calendar-day-number">{date.getUTCDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.map((event) =>
                    canOpenEvent ? (
                      <button
                        className={`calendar-event calendar-event-${event.event_type}`}
                        type="button"
                        key={event.id}
                        onClick={() => openEdit(event)}
                      >
                        {eventLabel(event)}
                      </button>
                    ) : (
                      <div
                        className={`calendar-event calendar-event-readonly calendar-event-${event.event_type}`}
                        key={event.id}
                      >
                        {eventLabel(event)}
                      </div>
                    ),
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>

      {editingEvent !== undefined && !eventToDelete && (
        <ModalFrame
          title={calendarDialogTitle}
          description={
            editingEvent
              ? canUpdate
                ? 'Update this calendar event.'
                : 'Review this calendar event.'
              : 'Add an event to the school calendar.'
          }
          size="standard"
          initialFocusRef={editingEvent && !canUpdate ? viewCloseRef : titleInputRef}
          onClose={closeForm}
          footer={
            <>
              {editingEvent && canDelete && (
                <button
                  className="secondary-action danger-action calendar-delete-action"
                  type="button"
                  onClick={openDeleteConfirmation}
                  disabled={isSaving}
                >
                  Delete event
                </button>
              )}
              <button
                ref={editingEvent && !canUpdate ? viewCloseRef : undefined}
                className="secondary-action"
                type="button"
                onClick={closeForm}
                disabled={isSaving}
              >
                {editingEvent && !canUpdate ? 'Close' : 'Cancel'}
              </button>
              {(!editingEvent || canUpdate) && (
                <button
                  className="primary-action compact"
                  type="submit"
                  form="calendar-event-form"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : editingEvent ? 'Save changes' : 'Create event'}
                </button>
              )}
            </>
          }
        >
          <form id="calendar-event-form" className="calendar-event-form" onSubmit={submitEvent}>
            {formError && <InlineMessage tone="error">{formError}</InlineMessage>}
            <fieldset className="calendar-form-grid" disabled={Boolean(editingEvent) && !canUpdate}>
              <label className="calendar-form-field wide">
                Title
                <input
                  ref={titleInputRef}
                  aria-label="Title"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.title?.length)}
                />
                {fieldErrors.title?.map((message) => <small key={message}>{message}</small>)}
              </label>

              <div className="calendar-form-field">
                <label htmlFor="calendar-event-type">Event type</label>
                <select
                  id="calendar-event-type"
                  aria-label="Event type"
                  value={form.event_type}
                  onChange={(event) =>
                    updateForm('event_type', event.target.value as CalendarEvent['event_type'])
                  }
                  aria-invalid={Boolean(fieldErrors.event_type?.length)}
                  aria-describedby={
                    fieldErrors.event_type?.length ? EVENT_TYPE_ERROR_ID : undefined
                  }
                >
                  <option value="appointment">Appointment</option>
                  <option value="training">Training</option>
                  <option value="meeting">Meeting</option>
                  <option value="school_event">School event</option>
                  <option value="other">Other</option>
                </select>
                {fieldErrors.event_type?.length ? (
                  <div className="calendar-field-errors" id={EVENT_TYPE_ERROR_ID}>
                    {fieldErrors.event_type.map((message) => <small key={message}>{message}</small>)}
                  </div>
                ) : null}
              </div>

              <div className="calendar-checkbox-group">
                <label className="calendar-checkbox-field">
                  <input
                    type="checkbox"
                    aria-label="All-day event"
                    checked={form.is_all_day}
                    onChange={(event) => updateForm('is_all_day', event.target.checked)}
                    aria-invalid={Boolean(fieldErrors.is_all_day?.length)}
                    aria-describedby={
                      fieldErrors.is_all_day?.length ? IS_ALL_DAY_ERROR_ID : undefined
                    }
                  />
                  All-day event
                </label>
                {fieldErrors.is_all_day?.length ? (
                  <div className="calendar-field-errors" id={IS_ALL_DAY_ERROR_ID}>
                    {fieldErrors.is_all_day.map((message) => <small key={message}>{message}</small>)}
                  </div>
                ) : null}
              </div>

              <label className="calendar-form-field">
                Start date
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={(event) => updateForm('start_date', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.start_date?.length || fieldErrors.starts_at?.length)}
                />
                {[...(fieldErrors.start_date ?? []), ...(fieldErrors.starts_at ?? [])].map((message) => (
                  <small key={message}>{message}</small>
                ))}
              </label>

              {!form.is_all_day && (
                <label className="calendar-form-field">
                  Start time
                  <input
                    type="time"
                    name="start_time"
                    value={form.start_time}
                    onChange={(event) => updateForm('start_time', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.start_time?.length || fieldErrors.starts_at?.length)}
                  />
                  {fieldErrors.start_time?.map((message) => <small key={message}>{message}</small>)}
                </label>
              )}

              <label className="calendar-form-field">
                End date
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={(event) => updateForm('end_date', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.ends_at?.length)}
                />
                {fieldErrors.ends_at?.map((message) => <small key={message}>{message}</small>)}
              </label>

              {!form.is_all_day && (
                <label className="calendar-form-field">
                  End time
                  <input
                    type="time"
                    name="end_time"
                    value={form.end_time}
                    onChange={(event) => updateForm('end_time', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.ends_at?.length)}
                  />
                </label>
              )}

              <label className="calendar-form-field wide">
                Location
                <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} />
                {fieldErrors.location?.map((message) => <small key={message}>{message}</small>)}
              </label>

              <label className="calendar-form-field wide">
                Participants
                <textarea
                  value={form.participants}
                  onChange={(event) => updateForm('participants', event.target.value)}
                />
                {fieldErrors.participants?.map((message) => <small key={message}>{message}</small>)}
              </label>

              <label className="calendar-form-field wide">
                Notes
                <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
                {fieldErrors.notes?.map((message) => <small key={message}>{message}</small>)}
              </label>
            </fieldset>
          </form>
        </ModalFrame>
      )}

      {eventToDelete && (
        <ModalFrame
          title="Delete Calendar Event?"
          description="This event will be permanently removed and cannot be recovered."
          size="compact"
          tone="danger"
          initialFocusRef={deleteCancelRef}
          onClose={closeDeleteConfirmation}
          footer={
            <>
              <button
                ref={deleteCancelRef}
                className="secondary-action"
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={isDeleting}
              >
                Cancel deletion
              </button>
              <button
                className="primary-action compact calendar-confirm-delete"
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete event'}
              </button>
            </>
          }
        >
          <ModalContextSummary
            ariaLabel="Event to delete"
            tone="danger"
            items={[
              { label: 'Event', value: eventToDelete.title },
              { label: 'Date and time', value: eventScheduleLabel(eventToDelete) },
              { label: 'Location', value: eventToDelete.location || 'Not recorded' },
            ]}
            consequence="This event cannot be recovered after deletion."
          />
          {deleteError && <InlineMessage tone="error">{deleteError}</InlineMessage>}
        </ModalFrame>
      )}
    </section>
  )
}
