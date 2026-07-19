import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ApiError, apiRequest } from '../api'
import type { ApiValidationErrors } from '../api'
import { InlineMessage, ModalFrame, PageHeader } from './AdminUi'
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

const monthFormatter = new Intl.DateTimeFormat('en-MY', {
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('en-MY', {
  hour: 'numeric',
  minute: '2-digit',
})
const weekdayFormatter = new Intl.DateTimeFormat('en-MY', { weekday: 'short' })
const eventTypeLabels: Record<CalendarEvent['event_type'], string> = {
  appointment: 'Appointment',
  training: 'Training',
  meeting: 'Meeting',
  school_event: 'School event',
  other: 'Other',
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfCalendarGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  first.setDate(first.getDate() - first.getDay())
  return first
}

function visibleDates(month: Date) {
  const start = startOfCalendarGrid(month)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function eventDateKey(event: CalendarEvent) {
  return dateKey(new Date(event.starts_at))
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

function emptyForm(): CalendarEventForm {
  return {
    title: '',
    event_type: 'school_event',
    is_all_day: false,
    start_date: dateKey(new Date()),
    start_time: '09:00',
    end_date: '',
    end_time: '',
    location: '',
    participants: '',
    notes: '',
  }
}

function localTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formFromEvent(event: CalendarEvent): CalendarEventForm {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null

  return {
    title: event.title,
    event_type: event.event_type,
    is_all_day: event.is_all_day,
    start_date: dateKey(start),
    start_time: localTime(start),
    end_date: end ? dateKey(end) : '',
    end_time: end ? localTime(end) : '',
    location: event.location ?? '',
    participants: event.participants ?? '',
    notes: event.notes ?? '',
  }
}

function toLocalIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function eventPayload(form: CalendarEventForm) {
  const startTime = form.is_all_day ? '00:00' : form.start_time
  const hasEnd = form.is_all_day
    ? Boolean(form.end_date)
    : Boolean(form.end_date && form.end_time)
  const endTime = form.is_all_day ? '00:00' : form.end_time

  return {
    title: form.title.trim(),
    event_type: form.event_type,
    is_all_day: form.is_all_day,
    starts_at: toLocalIso(form.start_date, startTime),
    ends_at: hasEnd ? toLocalIso(form.end_date, endTime) : null,
    location: form.location.trim() || null,
    participants: form.participants.trim() || null,
    notes: form.notes.trim() || null,
  }
}

export function CalendarPage({ schoolId, permissions, onUnauthorized }: CalendarPageProps) {
  const [displayedMonth, setDisplayedMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  )
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadError, setLoadError] = useState('')
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

  useEffect(() => {
    if (!canView) {
      setEvents([])
      return
    }

    let active = true
    const params = new URLSearchParams({
      school_id: String(schoolId),
      start: dateKey(dates[0]),
      end: dateKey(dates[dates.length - 1]),
    })

    setLoadError('')
    apiRequest<{ data: CalendarEvent[] }>(`/calendar-events?${params.toString()}`)
      .then((response) => {
        if (active) setEvents(response.data)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized()
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load calendar events.')
      })

    return () => {
      active = false
    }
  }, [canView, dates, onUnauthorized, schoolId])

  const changeMonth = (offset: number) => {
    setDisplayedMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1, 12),
    )
  }

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
    setFieldErrors((current) => ({ ...current, [key]: [] }))
  }

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const localErrors: ApiValidationErrors = {}
    if (!form.title.trim()) localErrors.title = ['A title is required.']
    if (!form.start_date) localErrors.start_date = ['A start date is required.']
    if (!form.is_all_day && !form.start_time) {
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

    try {
      const eventBeingEdited = editingEvent ?? null
      const path = eventBeingEdited
        ? `/calendar-events/${eventBeingEdited.id}?school_id=${schoolId}`
        : `/calendar-events?school_id=${schoolId}`
      const response = await apiRequest<{ calendar_event: CalendarEvent }>(path, {
        method: eventBeingEdited ? 'PATCH' : 'POST',
        body: eventPayload(form),
      })

      setEvents((current) =>
        eventBeingEdited
          ? current.map((item) =>
              item.id === response.calendar_event.id ? response.calendar_event : item,
            )
          : [...current, response.calendar_event],
      )
      setEditingEvent(undefined)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized()
      } else {
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

    setIsDeleting(true)
    setDeleteError('')
    try {
      await apiRequest<void>(
        `/calendar-events/${eventToDelete.id}?school_id=${schoolId}`,
        { method: 'DELETE' },
      )
      setEvents((current) => current.filter((event) => event.id !== eventToDelete.id))
      setEventToDelete(null)
      setEditingEvent(undefined)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized()
      } else {
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

        {loadError && <InlineMessage tone="error">{loadError}</InlineMessage>}
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
            const dayEvents = events.filter((event) => eventDateKey(event) === dateKey(date))
            const isCurrentMonth = date.getMonth() === displayedMonth.getMonth()

            return (
              <section
                key={dateKey(date)}
                className={`calendar-day${isCurrentMonth ? '' : ' outside-month'}${isCurrentMonth || dayEvents.length ? ' calendar-mobile-day' : ''}`}
                aria-label={date.toLocaleDateString('en-MY', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              >
                <span className="calendar-day-number">{date.getDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.map((event) =>
                    canUpdate ? (
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

      {editingEvent !== undefined && (
        <ModalFrame
          title={editingEvent ? `Edit ${editingEvent.title}` : 'Add event'}
          description={editingEvent ? 'Update this calendar event.' : 'Add an event to the school calendar.'}
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
              <button className="secondary-action" type="button" onClick={closeForm} disabled={isSaving}>
                Cancel
              </button>
              <button
                className="primary-action compact"
                type="submit"
                form="calendar-event-form"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : editingEvent ? 'Save changes' : 'Create event'}
              </button>
            </>
          }
        >
          <form id="calendar-event-form" className="calendar-event-form" onSubmit={submitEvent}>
            {formError && <InlineMessage tone="error">{formError}</InlineMessage>}
            <div className="calendar-form-grid">
              <label className="calendar-form-field wide">
                Title
                <input
                  aria-label="Title"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.title?.length)}
                />
                {fieldErrors.title?.map((message) => <small key={message}>{message}</small>)}
              </label>

              <label className="calendar-form-field">
                Event type
                <select
                  value={form.event_type}
                  onChange={(event) =>
                    updateForm('event_type', event.target.value as CalendarEvent['event_type'])
                  }
                >
                  <option value="appointment">Appointment</option>
                  <option value="training">Training</option>
                  <option value="meeting">Meeting</option>
                  <option value="school_event">School event</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="calendar-checkbox-field">
                <input
                  type="checkbox"
                  checked={form.is_all_day}
                  onChange={(event) => updateForm('is_all_day', event.target.checked)}
                />
                All-day event
              </label>

              <label className="calendar-form-field">
                Start date
                <input
                  type="date"
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
                    value={form.start_time}
                    onChange={(event) => updateForm('start_time', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.start_time?.length)}
                  />
                  {fieldErrors.start_time?.map((message) => <small key={message}>{message}</small>)}
                </label>
              )}

              <label className="calendar-form-field">
                End date
                <input
                  type="date"
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
                    value={form.end_time}
                    onChange={(event) => updateForm('end_time', event.target.value)}
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
            </div>
          </form>
        </ModalFrame>
      )}

      {eventToDelete && (
        <ModalFrame
          title={`Delete ${eventToDelete.title}?`}
          description="This event will be permanently removed and cannot be recovered."
          onClose={closeDeleteConfirmation}
          footer={
            <>
              <button
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
                {isDeleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </>
          }
        >
          {deleteError && <InlineMessage tone="error">{deleteError}</InlineMessage>}
          <p className="calendar-delete-copy">
            Delete this event only if it is no longer needed on the school calendar.
          </p>
        </ModalFrame>
      )}
    </section>
  )
}
