import type { CSSProperties, ReactNode } from 'react'
import { Users } from 'lucide-react'
import type { CalendarEvent } from './CalendarPage'

export type CalendarView = 'year' | 'month' | 'week'

type CalendarViewProps = {
  anchor: Date
  events: CalendarEvent[]
  todayKey: string
  canOpenEvent: boolean
  onOpenEvent: (event: CalendarEvent) => void
}

type YearCalendarViewProps = CalendarViewProps & {
  onSelectMonth: (month: Date) => void
}

const SCHOOL_TIME_ZONE = 'Asia/Kuala_Lumpur'
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const weekDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const monthNameFormatter = new Intl.DateTimeFormat('en-MY', { month: 'long', timeZone: 'UTC' })
const monthTitleFormatter = new Intl.DateTimeFormat('en-MY', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const calendarDateFormatter = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
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

const eventTypeLabels: Record<CalendarEvent['event_type'], string> = {
  appointment: 'Appointment',
  training: 'Training',
  meeting: 'Meeting',
  school_event: 'School event',
  other: 'Other',
}

export function dateKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function monthStart(anchor: Date) {
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12))
}

function startOfMonthGrid(anchor: Date) {
  const first = monthStart(anchor)
  return addDays(first, -first.getUTCDay())
}

export function monthDates(anchor: Date) {
  const start = startOfMonthGrid(anchor)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function startOfWeek(anchor: Date) {
  const weekday = anchor.getUTCDay()
  return addDays(anchor, -(weekday === 0 ? 6 : weekday - 1))
}

export function weekDates(anchor: Date) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function calendarRange(view: CalendarView, anchor: Date) {
  if (view === 'year') {
    return {
      start: `${anchor.getUTCFullYear()}-01-01`,
      end: `${anchor.getUTCFullYear()}-12-31`,
    }
  }

  if (view === 'week') {
    const dates = weekDates(anchor)
    return { start: dateKey(dates[0]), end: dateKey(dates[6]) }
  }

  const dates = monthDates(anchor)
  return { start: dateKey(dates[0]), end: dateKey(dates[41]) }
}

export function calendarTitle(view: CalendarView, anchor: Date) {
  if (view === 'year') return String(anchor.getUTCFullYear())
  if (view === 'month') return monthTitleFormatter.format(anchor)

  const dates = weekDates(anchor)
  const first = dates[0]
  const last = dates[6]
  if (first.getUTCFullYear() === last.getUTCFullYear() && first.getUTCMonth() === last.getUTCMonth()) {
    return `${first.getUTCDate()}–${last.getUTCDate()} ${monthTitleFormatter.format(last)}`
  }
  if (first.getUTCFullYear() === last.getUTCFullYear()) {
    return `${first.getUTCDate()} ${monthNameFormatter.format(first)} – ${last.getUTCDate()} ${monthTitleFormatter.format(last)}`
  }
  return `${calendarDateFormatter.format(first)} – ${calendarDateFormatter.format(last)}`
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
  }
}

function schoolDateKey(date: Date) {
  const { year, month, day } = schoolDateTimeParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function eventDateKey(event: CalendarEvent) {
  if (event.is_all_day) return new Date(event.starts_at).toISOString().slice(0, 10)
  return schoolDateKey(new Date(event.starts_at))
}

export function eventEndDateKey(event: CalendarEvent) {
  if (!event.ends_at) return eventDateKey(event)
  if (event.is_all_day) return new Date(event.ends_at).toISOString().slice(0, 10)
  return schoolDateKey(new Date(event.ends_at))
}

export function eventOccursOnDate(event: CalendarEvent, date: string) {
  return date >= eventDateKey(event) && date <= eventEndDateKey(event)
}

function EventCard({
  event,
  canOpenEvent,
  onOpenEvent,
  className = '',
  children,
  style,
}: {
  event: CalendarEvent
  canOpenEvent: boolean
  onOpenEvent: (event: CalendarEvent) => void
  className?: string
  children: ReactNode
  style?: CSSProperties
}) {
  const classes = `calendar-event calendar-event-${event.event_type}${canOpenEvent ? '' : ' calendar-event-readonly'}${className ? ` ${className}` : ''}`
  return canOpenEvent ? (
    <button className={classes} type="button" onClick={() => onOpenEvent(event)} style={style}>
      {children}
    </button>
  ) : (
    <div className={classes} style={style}>{children}</div>
  )
}

function EventLabel({ event, includeType = true }: { event: CalendarEvent; includeType?: boolean }) {
  return (
    <>
      {!event.is_all_day && (
        <span className="calendar-event-time">
          {timeFormatter.format(new Date(event.starts_at)).toUpperCase()}
        </span>
      )}
      <span className="calendar-event-title">{event.title}</span>
      {includeType && <span className="calendar-event-type">{eventTypeLabels[event.event_type]}</span>}
    </>
  )
}

export function YearCalendarView({
  anchor,
  events,
  todayKey,
  onSelectMonth,
}: YearCalendarViewProps) {
  const year = anchor.getUTCFullYear()
  return (
    <div className="calendar-year-grid" aria-label={`${year} year calendar`}>
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const month = new Date(Date.UTC(year, monthIndex, 1, 12))
        const dates = monthDates(month)
        const monthLabel = monthTitleFormatter.format(month)
        return (
          <button
            className="calendar-mini-month"
            type="button"
            aria-label={monthLabel}
            key={monthLabel}
            onClick={() => onSelectMonth(month)}
          >
            <strong>{monthNameFormatter.format(month)}</strong>
            <span className="calendar-mini-weekdays" aria-hidden="true">
              {weekdayNames.map((weekday) => <span key={weekday}>{weekday.slice(0, 1)}</span>)}
            </span>
            <span className="calendar-mini-grid" aria-hidden="true">
              {dates.map((date) => {
                const key = dateKey(date)
                const count = events.filter((event) => eventOccursOnDate(event, key)).length
                const inMonth = date.getUTCMonth() === monthIndex
                return (
                  <span
                    className={`${inMonth ? '' : 'outside-month'}${key === todayKey ? ' calendar-mini-today' : ''}${count ? ' has-events' : ''}`}
                    key={key}
                    title={count ? `${count} event${count === 1 ? '' : 's'}` : undefined}
                  >
                    {date.getUTCDate()}
                  </span>
                )
              })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function MonthCalendarView({
  anchor,
  events,
  todayKey,
  canOpenEvent,
  onOpenEvent,
}: CalendarViewProps) {
  const dates = monthDates(anchor)
  const upcoming = [...events]
    .filter((event) => eventEndDateKey(event) >= todayKey)
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at))
    .slice(0, 5)

  return (
    <div className="calendar-month-layout">
      <aside className="calendar-upcoming" aria-label="Upcoming events">
        <div className="calendar-upcoming-heading">
          <span>Next on the calendar</span>
          <h3>Upcoming events</h3>
          <p>Keep track of the school’s next scheduled activities.</p>
        </div>
        <div className="calendar-upcoming-list">
          {upcoming.length ? upcoming.map((event) => (
            <EventCard
              event={event}
              canOpenEvent={false}
              onOpenEvent={onOpenEvent}
              className="calendar-upcoming-card"
              key={event.id}
            >
              <span className="calendar-upcoming-date">{calendarDateFormatter.format(new Date(`${eventDateKey(event)}T12:00:00Z`))}</span>
              <EventLabel event={event} />
              {event.location && <span className="calendar-upcoming-location">{event.location}</span>}
              {event.participants?.trim() && (
                <span className="calendar-upcoming-participants" title={event.participants}>
                  <Users size={12} aria-hidden="true" />
                  <span>{event.participants}</span>
                </span>
              )}
            </EventCard>
          )) : <p className="calendar-upcoming-empty">No upcoming events in this calendar range.</p>}
        </div>
      </aside>

      <div className="calendar-month-board">
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayNames.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="calendar-grid">
          {dates.map((date) => {
            const key = dateKey(date)
            const dayEvents = events.filter((event) => eventOccursOnDate(event, key))
            const isCurrentMonth = date.getUTCMonth() === anchor.getUTCMonth()
            const isToday = key === todayKey
            return (
              <section
                key={key}
                className={`calendar-day${isCurrentMonth ? '' : ' outside-month'}${isCurrentMonth || dayEvents.length ? ' calendar-mobile-day' : ''}${isToday ? ' calendar-today' : ''}`}
                aria-current={isToday ? 'date' : undefined}
                aria-label={calendarDateFormatter.format(date)}
              >
                <span className="calendar-day-number">{date.getUTCDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.map((event) => (
                    <EventCard event={event} canOpenEvent={canOpenEvent} onOpenEvent={onOpenEvent} key={event.id}>
                      <EventLabel event={event} />
                    </EventCard>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function eventMinutes(event: CalendarEvent, end = false) {
  const value = end && event.ends_at ? event.ends_at : event.starts_at
  const { hour, minute } = schoolDateTimeParts(new Date(value))
  return hour * 60 + minute
}

export function WeekCalendarView({
  anchor,
  events,
  todayKey,
  canOpenEvent,
  onOpenEvent,
}: CalendarViewProps) {
  const dates = weekDates(anchor)
  const timedEvents = events.filter(
    (event) => !event.is_all_day && eventDateKey(event) === eventEndDateKey(event),
  )
  const startHour = timedEvents.length
    ? Math.min(7, ...timedEvents.map((event) => Math.floor(eventMinutes(event) / 60)))
    : 7
  const endHour = timedEvents.length
    ? Math.max(19, ...timedEvents.map((event) => Math.ceil(eventMinutes(event, true) / 60)))
    : 19
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index)
  const allDayEvents = events.filter((event) => event.is_all_day || eventDateKey(event) !== eventEndDateKey(event))

  return (
    <section className="calendar-week" aria-label="Week schedule">
      <div className="calendar-week-header">
        <span aria-hidden="true" />
        {dates.map((date, index) => {
          const key = dateKey(date)
          return (
            <div className={key === todayKey ? 'calendar-week-today' : ''} key={key}>
              <strong>{date.getUTCDate()}</strong>
              <span>{weekDayNames[index]}</span>
            </div>
          )
        })}
      </div>

      {allDayEvents.length > 0 && (
        <div className="calendar-all-day-row">
          <span>All day</span>
          <div>
            {allDayEvents.map((event) => (
              <EventCard event={event} canOpenEvent={canOpenEvent} onOpenEvent={onOpenEvent} key={event.id}>
                <EventLabel event={event} includeType={false} />
              </EventCard>
            ))}
          </div>
        </div>
      )}

      <div
        className="calendar-week-timeline"
        style={{ '--calendar-hours': String(endHour - startHour) } as CSSProperties}
      >
        <div className="calendar-hour-labels">
          {hours.slice(0, -1).map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}
        </div>
        <div className="calendar-hour-lines" aria-hidden="true">
          {hours.slice(0, -1).map((hour) => <span key={hour} />)}
        </div>
        <div className="calendar-week-columns">
          {dates.map((date) => {
            const key = dateKey(date)
            const dayEvents = timedEvents.filter((event) => eventOccursOnDate(event, key))
            return (
              <div className={`calendar-week-column${key === todayKey ? ' calendar-week-column-today' : ''}`} key={key}>
                {dayEvents.map((event) => {
                  const start = Math.max(startHour * 60, eventMinutes(event))
                  const end = Math.max(start + 30, eventMinutes(event, true))
                  const style = {
                    '--event-start': String(start - startHour * 60),
                    '--event-duration': String(Math.max(30, end - start)),
                  } as CSSProperties
                  return (
                    <EventCard event={event} canOpenEvent={canOpenEvent} onOpenEvent={onOpenEvent} key={event.id} className="calendar-week-event" style={style}>
                      <EventLabel event={event} includeType={false} />
                      <span className="calendar-event-range">
                        {timeFormatter.format(new Date(event.starts_at))}
                        {event.ends_at ? ` – ${timeFormatter.format(new Date(event.ends_at))}` : ''}
                      </span>
                    </EventCard>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="calendar-week-agenda">
        {dates.map((date, index) => {
          const key = dateKey(date)
          const dayEvents = events.filter((event) => eventOccursOnDate(event, key))
          return (
            <section key={key} aria-label={calendarDateFormatter.format(date)}>
              <h3>{weekDayNames[index]}, {date.getUTCDate()} {monthNameFormatter.format(date)}</h3>
              {dayEvents.length ? dayEvents.map((event) => (
                <EventCard event={event} canOpenEvent={canOpenEvent} onOpenEvent={onOpenEvent} key={event.id} className="calendar-agenda-event">
                  <EventLabel event={event} />
                </EventCard>
              )) : <p>No events</p>}
            </section>
          )
        })}
      </div>
    </section>
  )
}
