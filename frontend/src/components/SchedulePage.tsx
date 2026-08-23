import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, MapPin, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { apiRequest } from '../api'
import { CustomSelect, DataPanel, FilterToolbar, PageHeader, StatCard, StatusBadge, TimePicker } from './AdminUi'

type Year = { id: number; code: string; name: string; is_current: boolean }
type SchoolClass = { id: number; name: string }
type Assignment = { id: number; class_id: number; subject_id: number; teacher_user_id: number }
type Entry = {
  id: number
  class_id: number
  subject_id: number | null
  teaching_assignment_id: number | null
  title: string
  day_of_week: number
  starts_at: string
  ends_at: string
  location: string | null
  status: 'draft' | 'published' | 'archived'
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function SchedulePage() {
  const [years, setYears] = useState<Year[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [yearId, setYearId] = useState(0)
  const [classId, setClassId] = useState(0)
  const [assignmentId, setAssignmentId] = useState(0)
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(1)
  const [startsAt, setStartsAt] = useState('08:00')
  const [endsAt, setEndsAt] = useState('09:00')
  const [location, setLocation] = useState('')
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterClassId, setFilterClassId] = useState<number | 'all'>('all')

  useEffect(() => {
    Promise.all([
      apiRequest<{ data: Year[] }>('/v1/admin/academic-years'),
      apiRequest<{ data: SchoolClass[] }>('/classes'),
    ]).then(([yearResponse, classResponse]) => {
      setYears(yearResponse.data)
      setClasses(classResponse.data)
      setYearId(yearResponse.data.find((item) => item.is_current)?.id ?? yearResponse.data[0]?.id ?? 0)
      setClassId(classResponse.data[0]?.id ?? 0)
    })
  }, [])

  useEffect(() => {
    if (!yearId) return
    Promise.all([
      apiRequest<{ data: Assignment[] }>(`/v1/admin/teaching-assignments?academic_year_id=${yearId}`),
      apiRequest<{ data: Entry[] }>(`/v1/admin/class-schedules?academic_year_id=${yearId}`),
    ]).then(([assignmentResponse, entryResponse]) => {
      setAssignments(assignmentResponse.data)
      setEntries(entryResponse.data)
    })
  }, [yearId])

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === assignmentId),
    [assignments, assignmentId]
  )

  const relevantAssignments = useMemo(
    () => assignments.filter((item) => item.class_id === classId),
    [assignments, classId]
  )

  const filteredEntries = useMemo(() => {
    if (filterClassId === 'all') return entries
    return entries.filter((item) => item.class_id === filterClassId)
  }, [entries, filterClassId])

  const publishedCount = useMemo(
    () => entries.filter((e) => e.status === 'published').length,
    [entries]
  )
  const draftCount = useMemo(
    () => entries.filter((e) => e.status === 'draft').length,
    [entries]
  )

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setErrorNotice('')
    try {
      const response = await apiRequest<{ data: Entry }>('/v1/admin/class-schedules', {
        method: 'POST',
        body: {
          academic_year_id: yearId,
          class_id: classId,
          subject_id: selectedAssignment?.subject_id ?? null,
          teaching_assignment_id: assignmentId || null,
          title: title.trim(),
          day_of_week: day,
          starts_at: startsAt,
          ends_at: endsAt,
          location: location.trim() || null,
          status: 'draft',
        },
      })
      setEntries((items) => [...items, response.data])
      setTitle('')
      setLocation('')
      setNotice('Draft schedule entry created successfully.')
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Unable to create schedule entry.')
    } finally {
      setSaving(false)
    }
  }

  const publish = async (entry: Entry) => {
    try {
      const response = await apiRequest<{ data: Entry }>(`/v1/admin/class-schedules/${entry.id}`, {
        method: 'PATCH',
        body: { status: 'published' },
      })
      setEntries((items) => items.map((item) => (item.id === entry.id ? response.data : item)))
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Unable to publish schedule entry.')
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Academics"
        title="Class Schedule"
        description="Create, organize, and publish recurring weekly class timetables for the student and teacher app."
      />

      {/* Top 3 Stat Cards */}
      <div
        className="stat-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          label="Total Scheduled"
          value={entries.length.toString()}
          meta="Recurring weekly class sessions"
        />
        <StatCard
          label="Published Live"
          value={publishedCount.toString()}
          meta="Visible in Parent & Student App"
        />
        <StatCard
          label="Draft Entries"
          value={draftCount.toString()}
          meta="Pending verification & publish"
        />
      </div>

      {/* Draft Builder Panel */}
      <DataPanel eyebrow="New Entry" title="Create Schedule Draft">
        <form className="schedule-form-container" onSubmit={create}>
          {/* Row 1: Academic & Class Context */}
          <div className="schedule-form-grid three-columns">
            <label className="schedule-form-field">
              <span className="schedule-field-label">Academic Year</span>
              <CustomSelect
                ariaLabel="Academic year"
                value={yearId}
                onChange={(val) => setYearId(Number(val))}
                options={years.map((item) => ({ value: item.id, label: item.name }))}
              />
            </label>

            <label className="schedule-form-field">
              <span className="schedule-field-label">Target Class</span>
              <CustomSelect
                ariaLabel="Class"
                value={classId}
                onChange={(val) => {
                  setClassId(Number(val))
                  setAssignmentId(0)
                }}
                options={classes.map((item) => ({ value: item.id, label: item.name }))}
              />
            </label>

            <label className="schedule-form-field">
              <span className="schedule-field-label">Teaching Assignment (Optional)</span>
              <CustomSelect
                ariaLabel="Teaching assignment"
                value={assignmentId}
                onChange={(val) => setAssignmentId(Number(val))}
                options={[
                  { value: 0, label: 'No linked subject/teacher' },
                  ...relevantAssignments.map((item) => ({
                    value: item.id,
                    label: `Assignment #${item.id}`,
                  })),
                ]}
              />
            </label>
          </div>

          {/* Row 2: Subject & Location & Day */}
          <div className="schedule-form-grid three-columns">
            <label className="schedule-form-field">
              <span className="schedule-field-label">Subject / Title</span>
              <input
                className="schedule-form-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Mathematics - Geometry"
                required
              />
            </label>

            <label className="schedule-form-field">
              <span className="schedule-field-label">Day of Week</span>
              <CustomSelect
                ariaLabel="Day"
                value={day}
                onChange={(val) => setDay(Number(val))}
                options={days.map((name, index) => ({ value: index + 1, label: name }))}
              />
            </label>

            <label className="schedule-form-field">
              <span className="schedule-field-label">Room / Location</span>
              <input
                className="schedule-form-input"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Science Lab 2"
              />
            </label>
          </div>

          {/* Row 3: Timing & Action Button */}
          <div className="schedule-form-grid timing-row">
            <label className="schedule-form-field">
              <span className="schedule-field-label">Start Time</span>
              <TimePicker value={startsAt} onChange={setStartsAt} ariaLabel="Start time" className="schedule-form-input" />
            </label>

            <label className="schedule-form-field">
              <span className="schedule-field-label">End Time</span>
              <TimePicker value={endsAt} onChange={setEndsAt} ariaLabel="End time" className="schedule-form-input" />
            </label>

            <div className="schedule-form-btn-wrap">
              <button
                className="primary-button schedule-action-btn"
                disabled={saving || !yearId || !classId || !title.trim()}
                type="submit"
              >
                <Plus size={16} />
                <span>{saving ? 'Creating Draft…' : 'Create Draft Entry'}</span>
              </button>
            </div>
          </div>

          {notice && (
            <div className="schedule-alert-success" role="status">
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          {errorNotice && (
            <div className="schedule-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{errorNotice}</span>
            </div>
          )}
        </form>
      </DataPanel>

      {/* Timetable Entries Panel */}
      <DataPanel
        eyebrow="Published Timetable"
        title="Weekly Schedule Entries"
      >
        <FilterToolbar ariaLabel="Schedule Class Filter">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              Showing {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Filter Class:</span>
              <CustomSelect
                ariaLabel="Filter schedule by class"
                value={filterClassId}
                onChange={(val) => setFilterClassId(val as number | 'all')}
                options={[
                  { value: 'all', label: 'All Classes' },
                  ...classes.map((cls) => ({ value: cls.id, label: cls.name })),
                ]}
                size="compact"
              />
            </div>
          </div>
        </FilterToolbar>

        {filteredEntries.length === 0 ? (
          <div className="schedule-empty-state">
            <div className="schedule-empty-icon">
              <CalendarDays size={32} />
            </div>
            <strong>No schedule entries found</strong>
            <p>Use the draft builder above to create and publish recurring class schedules.</p>
          </div>
        ) : (
          <div className="schedule-admin-grid">
            {filteredEntries.map((entry) => {
              const className =
                classes.find((item) => item.id === entry.class_id)?.name ?? `Class #${entry.class_id}`
              const dayName = days[entry.day_of_week - 1] ?? 'Unknown Day'
              const formattedTime = `${entry.starts_at.slice(0, 5)} – ${entry.ends_at.slice(0, 5)}`

              return (
                <article className="schedule-entry-card" key={entry.id}>
                  <div className="schedule-entry-header">
                    <span className="schedule-day-badge">{dayName}</span>
                    <StatusBadge tone={entry.status === 'published' ? 'positive' : 'neutral'}>
                      {entry.status}
                    </StatusBadge>
                  </div>

                  <div className="schedule-entry-body">
                    <strong className="schedule-entry-title">{entry.title}</strong>
                    <div className="schedule-entry-meta">
                      <span className="schedule-meta-pill">
                        <Clock size={13} />
                        {formattedTime}
                      </span>
                      <span className="schedule-meta-pill class-pill">{className}</span>
                      {entry.location && (
                        <span className="schedule-meta-pill location-pill">
                          <MapPin size={13} />
                          {entry.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {entry.status === 'draft' && (
                    <div className="schedule-entry-actions">
                      <button
                        className="secondary-action compact"
                        type="button"
                        onClick={() => void publish(entry)}
                      >
                        Publish to App
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </DataPanel>
    </section>
  )
}
