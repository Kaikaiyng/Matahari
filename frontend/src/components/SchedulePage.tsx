import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { apiRequest } from '../api'
import { DataPanel, PageHeader, StatusBadge } from './AdminUi'

type Year = { id: number; code: string; name: string; is_current: boolean }
type SchoolClass = { id: number; name: string }
type Assignment = { id: number; class_id: number; subject_id: number; teacher_user_id: number }
type Entry = { id: number; class_id: number; subject_id: number | null; teaching_assignment_id: number | null; title: string; day_of_week: number; starts_at: string; ends_at: string; location: string | null; status: 'draft' | 'published' | 'archived' }

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([apiRequest<{ data: Year[] }>('/v1/admin/academic-years'), apiRequest<{ data: SchoolClass[] }>('/classes')]).then(([yearResponse, classResponse]) => {
      setYears(yearResponse.data); setClasses(classResponse.data)
      setYearId(yearResponse.data.find((item) => item.is_current)?.id ?? yearResponse.data[0]?.id ?? 0)
      setClassId(classResponse.data[0]?.id ?? 0)
    })
  }, [])
  useEffect(() => {
    if (!yearId) return
    Promise.all([
      apiRequest<{ data: Assignment[] }>(`/v1/admin/teaching-assignments?academic_year_id=${yearId}`),
      apiRequest<{ data: Entry[] }>(`/v1/admin/class-schedules?academic_year_id=${yearId}`),
    ]).then(([assignmentResponse, entryResponse]) => { setAssignments(assignmentResponse.data); setEntries(entryResponse.data) })
  }, [yearId])
  const selectedAssignment = useMemo(() => assignments.find((item) => item.id === assignmentId), [assignments, assignmentId])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice('')
    try {
      const response = await apiRequest<{ data: Entry }>('/v1/admin/class-schedules', { method: 'POST', body: { academic_year_id: yearId, class_id: classId, subject_id: selectedAssignment?.subject_id ?? null, teaching_assignment_id: assignmentId || null, title, day_of_week: day, starts_at: startsAt, ends_at: endsAt, location: location || null, status: 'draft' } })
      setEntries((items) => [...items, response.data]); setTitle(''); setNotice('Draft schedule entry created.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to create schedule entry.') } finally { setSaving(false) }
  }
  const publish = async (entry: Entry) => {
    const response = await apiRequest<{ data: Entry }>(`/v1/admin/class-schedules/${entry.id}`, { method: 'PATCH', body: { status: 'published' } })
    setEntries((items) => items.map((item) => item.id === entry.id ? response.data : item))
  }

  return <section className="page-stack"><PageHeader eyebrow="Academics" title="Class Schedule" description="Create and publish recurring weekly class times for the MIS App." /><DataPanel eyebrow="New entry" title="Schedule draft"><form className="schedule-admin-form" onSubmit={create}><label>Academic year<select value={yearId} onChange={(event) => setYearId(Number(event.target.value))}>{years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Class<select value={classId} onChange={(event) => { setClassId(Number(event.target.value)); setAssignmentId(0) }}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Teaching assignment<select value={assignmentId} onChange={(event) => setAssignmentId(Number(event.target.value))}><option value={0}>No linked subject/teacher</option>{assignments.filter((item) => item.class_id === classId).map((item) => <option key={item.id} value={item.id}>Assignment #{item.id}</option>)}</select></label><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Day<select value={day} onChange={(event) => setDay(Number(event.target.value))}>{days.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>Starts<input type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Ends<input type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><button className="primary-action" disabled={saving || !yearId || !classId} type="submit">{saving ? 'Saving…' : 'Create draft'}</button></form>{notice && <p>{notice}</p>}</DataPanel><DataPanel eyebrow="Published timetable" title="Schedule entries">{entries.length === 0 ? <div className="empty-state compact"><CalendarDays /><strong>No schedule entries</strong><p>Create the first draft above.</p></div> : <div className="schedule-admin-list">{entries.map((entry) => <article key={entry.id}><span><strong>{entry.title}</strong><small>{days[entry.day_of_week - 1]} · {entry.starts_at.slice(0, 5)}–{entry.ends_at.slice(0, 5)} · {classes.find((item) => item.id === entry.class_id)?.name ?? `Class #${entry.class_id}`}</small></span><StatusBadge tone={entry.status === 'published' ? 'positive' : 'neutral'}>{entry.status}</StatusBadge>{entry.status === 'draft' && <button className="secondary-action compact" type="button" onClick={() => void publish(entry)}>Publish</button>}</article>)}</div>}</DataPanel></section>
}
