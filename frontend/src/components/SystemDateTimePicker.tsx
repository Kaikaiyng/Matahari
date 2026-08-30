import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { AriaAttributes, RefObject } from 'react'
import { createPortal } from 'react-dom'
import './SystemDateTimePicker.css'

type PickerPosition = { top: number; left: number; width: number }

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function displayDate(value: string) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : ''
}

function useFloatingPicker(open: boolean, anchorRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLElement | null>, close: () => void) {
  const [position, setPosition] = useState<PickerPosition>({ top: 0, left: 0, width: 280 })

  useEffect(() => {
    if (!open) return
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(280, rect.width)
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
      setPosition({ top: rect.bottom + 8, left, width })
    }
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchorRef.current?.contains(target) && !panelRef.current?.contains(target)) close()
    }
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keyboard)
    }
  }, [anchorRef, close, open, panelRef])

  return position
}

export function DatePicker({ value, onChange, min, max, placeholder = 'Select date', disabled = false, ariaLabel, allowClear = true, className = '', buttonRef, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy }: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  allowClear?: boolean
  className?: string
  buttonRef?: RefObject<HTMLButtonElement | null>
  'aria-invalid'?: AriaAttributes['aria-invalid']
  'aria-describedby'?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const selected = parseDate(value) ?? new Date()
    return new Date(selected.getFullYear(), selected.getMonth(), 1)
  })
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const position = useFloatingPicker(open, anchorRef, panelRef, close)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const selected = parseDate(value) ?? new Date()
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [open, value])

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [month])

  const choose = (date: Date) => {
    const next = dateValue(date)
    if ((min && next < min) || (max && next > max)) return
    onChange(next)
    close()
  }

  const setAnchor = (node: HTMLButtonElement | null) => { anchorRef.current = node; if (buttonRef) buttonRef.current = node }

  return <>
    <button ref={setAnchor} type="button" className={`system-picker-trigger ${open ? 'open' : ''} ${className}`.trim()} disabled={disabled} aria-label={ariaLabel ?? placeholder} aria-haspopup="dialog" aria-expanded={open} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} onClick={() => setOpen((current) => !current)}>
      <span className={value ? '' : 'placeholder'}>{value ? displayDate(value) : placeholder}</span><CalendarDays size={18} />
    </button>
    {open && createPortal(<div ref={panelRef} className="system-date-popover" role="dialog" aria-modal="false" aria-labelledby={titleId} style={{ top: position.top, left: position.left, width: position.width }}>
      <header><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button><strong id={titleId}>{month.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button></header>
      <div className="system-date-weekdays">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="system-date-grid">{days.map((date) => { const next = dateValue(date); const selected = next === value; const today = next === dateValue(new Date()); const outside = date.getMonth() !== month.getMonth(); const unavailable = Boolean((min && next < min) || (max && next > max)); return <button type="button" key={next} className={`${selected ? 'selected ' : ''}${today ? 'today ' : ''}${outside ? 'outside' : ''}`.trim()} disabled={unavailable} aria-label={date.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={selected} onClick={() => choose(date)}>{date.getDate()}</button> })}</div>
      <footer>{allowClear ? <button type="button" className="picker-text-action" disabled={!value} onClick={() => { onChange(''); close() }}><X size={15}/>Clear</button> : <span/>}<button type="button" className="picker-text-action primary" onClick={() => choose(new Date())}>Today</button></footer>
    </div>, document.body)}
  </>
}

const displayTime = (value: string) => { if (!value) return ''; const [hours, minutes] = value.split(':').map(Number); return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }) }

type TimePeriod = 'AM' | 'PM'
type TimeParts = { hour: number; minute: string; period: TimePeriod }

const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const standardMinuteOptions = ['00', '15', '30', '45']

function timeParts(value: string): TimeParts {
  const matched = /^(\d{1,2}):(\d{2})/.exec(value)
  if (matched) {
    const hour24 = Math.min(23, Math.max(0, Number(matched[1])))
    const minute = String(Math.min(59, Math.max(0, Number(matched[2])))).padStart(2, '0')
    return { hour: hour24 % 12 || 12, minute, period: hour24 >= 12 ? 'PM' : 'AM' }
  }

  const now = new Date()
  const roundedMinute = Math.min(45, Math.floor(now.getMinutes() / 15) * 15)
  return {
    hour: now.getHours() % 12 || 12,
    minute: String(roundedMinute).padStart(2, '0'),
    period: now.getHours() >= 12 ? 'PM' : 'AM',
  }
}

function timeValue({ hour, minute, period }: TimeParts) {
  const hour24 = period === 'AM' ? hour % 12 : (hour % 12) + 12
  return `${String(hour24).padStart(2, '0')}:${minute}`
}

export function TimePicker({ value, onChange, placeholder = 'Select time', disabled = false, ariaLabel, className = '', 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy }: { value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; ariaLabel?: string; className?: string; 'aria-invalid'?: AriaAttributes['aria-invalid']; 'aria-describedby'?: string }) {
  const [open, setOpen] = useState(false)
  const initialParts = timeParts(value)
  const [draftHour, setDraftHour] = useState(initialParts.hour)
  const [draftMinute, setDraftMinute] = useState(initialParts.minute)
  const [draftPeriod, setDraftPeriod] = useState<TimePeriod>(initialParts.period)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const position = useFloatingPicker(open, anchorRef, panelRef, close)
  const titleId = useId()
  const draft = { hour: draftHour, minute: draftMinute, period: draftPeriod }
  const minuteOptions = standardMinuteOptions.includes(draftMinute)
    ? standardMinuteOptions
    : [...standardMinuteOptions, draftMinute].sort()

  useEffect(() => {
    if (!open) return
    const next = timeParts(value)
    setDraftHour(next.hour)
    setDraftMinute(next.minute)
    setDraftPeriod(next.period)
  }, [open, value])

  const toggle = () => setOpen((current) => !current)
  const chooseButton = (selected: boolean) => selected ? 'selected' : ''

  return <>
    <button ref={anchorRef} type="button" className={`system-picker-trigger ${open ? 'open' : ''} ${className}`.trim()} disabled={disabled} aria-label={ariaLabel ?? placeholder} aria-haspopup="dialog" aria-expanded={open} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} onClick={toggle}>
      <span className={value ? '' : 'placeholder'}>{value ? displayTime(value) : placeholder}</span><Clock3 size={18}/>
    </button>
    {open && createPortal(
      <div ref={panelRef} className="system-time-popover" role="dialog" aria-modal="false" aria-labelledby={titleId} style={{ top: position.top, left: position.left, width: Math.min(360, position.width) }}>
        <div className="system-time-heading">
          <div><span>Time</span><strong id={titleId}>Select time</strong></div>
          <output aria-live="polite">{displayTime(timeValue(draft))}</output>
        </div>
        <div className="system-time-columns">
          <div className="system-time-group" role="group" aria-label="Hour">
            <span className="system-time-label">Hour</span>
            <div className="system-time-hour-grid">{hourOptions.map((hour) => <button type="button" key={hour} aria-label={`${hour} o'clock`} aria-pressed={draftHour === hour} className={chooseButton(draftHour === hour)} onClick={() => setDraftHour(hour)}>{hour}</button>)}</div>
          </div>
          <div className="system-time-group" role="group" aria-label="Minute">
            <span className="system-time-label">Minute</span>
            <div className="system-time-minute-grid">{minuteOptions.map((minute) => <button type="button" key={minute} aria-label={`${minute} minutes`} aria-pressed={draftMinute === minute} className={chooseButton(draftMinute === minute)} onClick={() => setDraftMinute(minute)}>{minute}</button>)}</div>
          </div>
          <div className="system-time-group" role="group" aria-label="Period">
            <span className="system-time-label">Period</span>
            <div className="system-time-period-grid">{(['AM', 'PM'] as const).map((period) => <button type="button" key={period} aria-pressed={draftPeriod === period} className={chooseButton(draftPeriod === period)} onClick={() => setDraftPeriod(period)}>{period}</button>)}</div>
          </div>
        </div>
        <div className="system-time-actions">
          <button type="button" className="system-time-cancel" onClick={close}>Cancel</button>
          <button type="button" className="system-time-confirm" onClick={() => { onChange(timeValue(draft)); close() }}>Done</button>
        </div>
      </div>,
      document.body,
    )}
  </>
}
