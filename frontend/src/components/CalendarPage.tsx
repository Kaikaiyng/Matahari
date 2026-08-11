import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ApiError, apiRequest } from '../api'
import type { ApiValidationErrors } from '../api'
import {
  FieldError,
  InlineMessage,
  ModalContextSummary,
  ModalFrame,
  PageHeader,
  fieldErrorProps,
  focusFirstDialogError,
} from './AdminUi'
import {
  MonthCalendarView,
  WeekCalendarView,
  YearCalendarView,
  calendarRange,
  calendarTitle,
} from './CalendarViews'
import type { CalendarView } from './CalendarViews'
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
const calendarDateFormatter = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const EVENT_TYPE_ERROR_ID = 'calendar-event-type-errors'
const IS_ALL_DAY_ERROR_ID = 'calendar-is-all-day-errors'

function validationMessage(errors: ApiValidationErrors, ...keys: string[]) {
  const messages = keys.flatMap((key) => errors[key] ?? [])
  return messages.length ? messages.join(' ') : undefined
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
  const { year, month, day } = schoolDateTimeParts(date)
  return new Date(Date.UTC(year, month - 1, day, 12))
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

function eventIsInRange(event: CalendarEvent, rangeStart: string, rangeEnd: string) {
  return eventDateKey(event) <= rangeEnd && eventEndDateKey(event) >= rangeStart
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
  const hasEnd = Boolean(form.end_date)
  const resolvedEndTime = form.end_time || form.start_time

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
        : toSchoolIso(form.end_date, resolvedEndTime)
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
  const [selectedView, setSelectedView] = useState<CalendarView>('month')
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
  const canView = permissions.includes('calendar.view')
  const canCreate = permissions.includes('calendar.create')
  const canUpdate = permissions.includes('calendar.update')
  const canDelete = permissions.includes('calendar.delete')
  const canOpenEvent = canUpdate || canDelete
  const todayKey = schoolDateKey(new Date())
  const { start: rangeStart, end: rangeEnd } = calendarRange(selectedView, displayedMonth)
  const todayAnchor = calendarMonthFor(new Date())
  const todayRange = calendarRange(selectedView, todayAnchor)
  const isCurrentPeriod =
    selectedView === 'year'
      ? displayedMonth.getUTCFullYear() === todayAnchor.getUTCFullYear()
      : selectedView === 'month'
        ? displayedMonth.getUTCFullYear() === todayAnchor.getUTCFullYear() &&
          displayedMonth.getUTCMonth() === todayAnchor.getUTCMonth()
        : rangeStart === todayRange.start
  const scopeKey = `${canView ? 'view' : 'hidden'}:${schoolId}:${selectedView}:${rangeStart}:${rangeEnd}`
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

  const changePeriod = (offset: number) => {
    setDisplayedMonth(
      (anchor) => {
        if (selectedView === 'year') {
          return new Date(Date.UTC(anchor.getUTCFullYear() + offset, anchor.getUTCMonth(), 1, 12))
        }
        if (selectedView === 'week') {
          const next = new Date(anchor)
          next.setUTCDate(next.getUTCDate() + offset * 7)
          return next
        }
        return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1, 12))
      },
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
      focusFirstDialogError()
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
        if (error instanceof ApiError && error.errors) {
          setFieldErrors(error.errors)
          focusFirstDialogError()
        }
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
      />

      <section className="calendar-panel" aria-label="School calendar">
        <header className="calendar-toolbar">
          <div className="calendar-title">
            <CalendarDays size={20} aria-hidden="true" />
            <h2>{calendarTitle(selectedView, displayedMonth)}</h2>
          </div>
          <div className="calendar-navigation">
            <div className="calendar-view-switcher" aria-label="Calendar view">
              {(['year', 'month', 'week'] as CalendarView[]).map((view) => (
                <button
                  type="button"
                  key={view}
                  aria-pressed={selectedView === view}
                  onClick={() => setSelectedView(view)}
                >
                  {view[0].toUpperCase()}{view.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={`Previous ${selectedView}`}
              onClick={() => changePeriod(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button calendar-today-action"
              type="button"
              aria-label="Back to today"
              title="Back to today"
              onClick={goToToday}
              disabled={isCurrentPeriod}
            >
              <CalendarDays size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Next ${selectedView}`}
              onClick={() => changePeriod(1)}
            >
              <ChevronRight size={19} />
            </button>
            {canCreate && (
              <button className="primary-action compact calendar-add-action" type="button" onClick={openCreate}>
                <Plus size={17} />
                Add event
              </button>
            )}
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

        {selectedView === 'year' && (
          <YearCalendarView
            anchor={displayedMonth}
            events={visibleEvents}
            todayKey={todayKey}
            canOpenEvent={canOpenEvent}
            onOpenEvent={openEdit}
            onSelectMonth={(month) => {
              const today = calendarMonthFor(new Date())
              setDisplayedMonth(
                month.getUTCFullYear() === today.getUTCFullYear() &&
                  month.getUTCMonth() === today.getUTCMonth()
                  ? today
                  : month,
              )
              setSelectedView('month')
            }}
          />
        )}
        {selectedView === 'month' && (
          <MonthCalendarView
            anchor={displayedMonth}
            events={visibleEvents}
            todayKey={todayKey}
            canOpenEvent={canOpenEvent}
            onOpenEvent={openEdit}
          />
        )}
        {selectedView === 'week' && (
          <WeekCalendarView
            anchor={displayedMonth}
            events={visibleEvents}
            todayKey={todayKey}
            canOpenEvent={canOpenEvent}
            onOpenEvent={openEdit}
          />
        )}
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
            {formError && (
              <div className="inline-error" role="alert" tabIndex={-1}>
                {formError}
              </div>
            )}
            <fieldset className="calendar-form-grid" disabled={Boolean(editingEvent) && !canUpdate}>
              <label className="calendar-form-field wide">
                Title
                <input
                  ref={titleInputRef}
                  aria-label="Title"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-title-error',
                    validationMessage(fieldErrors, 'title'),
                  )}
                />
                <FieldError
                  id="calendar-title-error"
                  message={validationMessage(fieldErrors, 'title')}
                />
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
                  {...fieldErrorProps(
                    EVENT_TYPE_ERROR_ID,
                    validationMessage(fieldErrors, 'event_type'),
                  )}
                  aria-invalid={Boolean(fieldErrors.event_type?.length)}
                >
                  <option value="appointment">Appointment</option>
                  <option value="training">Training</option>
                  <option value="meeting">Meeting</option>
                  <option value="school_event">School event</option>
                  <option value="other">Other</option>
                </select>
                <FieldError
                  id={EVENT_TYPE_ERROR_ID}
                  message={validationMessage(fieldErrors, 'event_type')}
                />
              </div>

              <div className="calendar-checkbox-group">
                <label className="calendar-checkbox-field">
                  <input
                    type="checkbox"
                    aria-label="All-day event"
                    checked={form.is_all_day}
                    onChange={(event) => updateForm('is_all_day', event.target.checked)}
                    {...fieldErrorProps(
                      IS_ALL_DAY_ERROR_ID,
                      validationMessage(fieldErrors, 'is_all_day'),
                    )}
                    aria-invalid={Boolean(fieldErrors.is_all_day?.length)}
                  />
                  All-day event
                </label>
                <FieldError
                  id={IS_ALL_DAY_ERROR_ID}
                  message={validationMessage(fieldErrors, 'is_all_day')}
                />
              </div>

              <label className="calendar-form-field">
                Start date
                <input
                  aria-label="Start date"
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={(event) => updateForm('start_date', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-start-date-error',
                    validationMessage(fieldErrors, 'start_date', 'starts_at'),
                  )}
                />
                <FieldError
                  id="calendar-start-date-error"
                  message={validationMessage(fieldErrors, 'start_date', 'starts_at')}
                />
              </label>

              {!form.is_all_day && (
                <label className="calendar-form-field">
                  Start time
                  <input
                    aria-label="Start time"
                    type="time"
                    name="start_time"
                    value={form.start_time}
                    onChange={(event) => updateForm('start_time', event.target.value)}
                    {...fieldErrorProps(
                      'calendar-start-time-error',
                      validationMessage(fieldErrors, 'start_time'),
                    )}
                  />
                  <FieldError
                    id="calendar-start-time-error"
                    message={validationMessage(fieldErrors, 'start_time')}
                  />
                </label>
              )}

              <label className="calendar-form-field">
                End date
                <input
                  aria-label="End date"
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={(event) => updateForm('end_date', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-end-date-error',
                    validationMessage(fieldErrors, 'end_date', 'ends_at'),
                  )}
                />
                <FieldError
                  id="calendar-end-date-error"
                  message={validationMessage(fieldErrors, 'end_date', 'ends_at')}
                />
              </label>

              {!form.is_all_day && (
                <label className="calendar-form-field">
                  End time
                  <input
                    aria-label="End time"
                    type="time"
                    name="end_time"
                    value={form.end_time}
                    onChange={(event) => updateForm('end_time', event.target.value)}
                    {...fieldErrorProps(
                      'calendar-end-time-error',
                      validationMessage(fieldErrors, 'end_time'),
                    )}
                  />
                  <FieldError
                    id="calendar-end-time-error"
                    message={validationMessage(fieldErrors, 'end_time')}
                  />
                </label>
              )}

              <label className="calendar-form-field wide">
                Location
                <input
                  aria-label="Location"
                  value={form.location}
                  onChange={(event) => updateForm('location', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-location-error',
                    validationMessage(fieldErrors, 'location'),
                  )}
                />
                <FieldError
                  id="calendar-location-error"
                  message={validationMessage(fieldErrors, 'location')}
                />
              </label>

              <label className="calendar-form-field wide">
                Participants
                <textarea
                  aria-label="Participants"
                  value={form.participants}
                  onChange={(event) => updateForm('participants', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-participants-error',
                    validationMessage(fieldErrors, 'participants'),
                  )}
                />
                <FieldError
                  id="calendar-participants-error"
                  message={validationMessage(fieldErrors, 'participants')}
                />
              </label>

              <label className="calendar-form-field wide">
                Notes
                <textarea
                  aria-label="Notes"
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  {...fieldErrorProps(
                    'calendar-notes-error',
                    validationMessage(fieldErrors, 'notes'),
                  )}
                />
                <FieldError
                  id="calendar-notes-error"
                  message={validationMessage(fieldErrors, 'notes')}
                />
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
