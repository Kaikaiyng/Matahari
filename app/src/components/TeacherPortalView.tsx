import { useEffect, useMemo, useState } from 'react'
import { Camera, Check, ChevronRight, Circle, FileText, Image, LogOut, MessageCircle, School, Send, UsersRound, Video } from 'lucide-react'
import { portalApi, type AttendanceStatus, type TeacherAssignment } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'

export function TeacherPortalView({ teacherName, activeTab, onTabChange, onLogout, staffMode = false }: { teacherName: string; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void; staffMode?: boolean }) {
  if (activeTab === 'home') return <CommunityFeed role={staffMode ? 'staff' : 'teacher'} userName={teacherName} onCreatePost={() => onTabChange('create')} />
  if (activeTab === 'classes') return <ClassesPage staffMode={staffMode} />
  if (activeTab === 'review' && staffMode) return <ClassesPage staffMode />
  if (activeTab === 'create') return <CreatePost staffMode={staffMode} onPublished={() => onTabChange('home')} />
  if (activeTab === 'attendance') return <AttendancePage />
  return <TeacherMore teacherName={teacherName} staffMode={staffMode} onLogout={onLogout} />
}

function Title({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header> }

function ClassesPage({ staffMode }: { staffMode: boolean }) {
  const [classes, setClasses] = useState<Array<{ assignment: TeacherAssignment; students: number }>>([])
  const [loading, setLoading] = useState(!staffMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (staffMode) return

    portalApi.getTeacherAssignments()
      .then(async ({ data }) => Promise.all(data.map(async (assignment) => ({
        assignment,
        students: (await portalApi.getTeacherStudents(assignment)).data.length,
      }))))
      .then(setClasses)
      .catch(() => setError('Unable to load your current teaching assignments.'))
      .finally(() => setLoading(false))
  }, [staffMode])

  if (staffMode) {
    return <div className="record-page"><Title eyebrow="School" title="School overview" copy="Community publishing access does not grant unrestricted student records." /><div className="preview-label">Design preview · broad school review remains in the Admin Panel</div><section className="teacher-quick-links"><button type="button" disabled><FileText /><span><strong>Content review</strong><small>Moderation API coming later</small></span><ChevronRight /></button></section></div>
  }

  return <div className="record-page"><Title eyebrow="Teaching" title="Your classes" copy="Only current teaching assignments and their scoped rosters appear." />{loading ? <div className="app-skeleton large" /> : error ? <div className="app-empty"><School /><h2>Classes unavailable</h2><p>{error}</p></div> : classes.length === 0 ? <div className="app-empty"><School /><h2>No assigned classes</h2><p>Ask the school office to review your current teaching assignments.</p></div> : classes.map(({ assignment, students }) => <ClassCard key={assignment.id} name={assignment.class.name} subject={assignment.subject.name} students={students} year={assignment.academic_year.code} />)}<section className="teacher-quick-links"><button type="button" disabled><FileText /><span><strong>Assessments</strong><small>Storage ready · workflow coming later</small></span><ChevronRight /></button><button type="button" disabled><MessageCircle /><span><strong>Class posts</strong><small>Publishing workflow coming later</small></span><ChevronRight /></button></section></div>
}
function ClassCard({ name, subject, students, year }: { name: string; subject: string; students: number; year: string }) { return <article className="class-card"><span className="class-monogram">{name}</span><span><strong>{name} · {subject}</strong><small><UsersRound /> {students} enrolled students</small><small>{year}</small></span></article> }

function CreatePost({ staffMode, onPublished }: { staffMode: boolean; onPublished: () => void }) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [audience, setAudience] = useState(staffMode ? 'school' : '')
  const [comments, setComments] = useState(true)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!staffMode) portalApi.getTeacherAssignments().then(({ data }) => { setAssignments(data); setAudience(data[0] ? String(data[0].class.id) : '') }).catch(() => setNotice('Unable to load your assigned classes.')) }, [staffMode])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!audience) return; setSaving(true); setNotice(''); try { await portalApi.createCommunityPost(message, comments, audience === 'school' ? [{ type: 'school' }] : [{ type: 'class', class_id: Number(audience) }]); onPublished() } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish this post.') } finally { setSaving(false) } }
  return <div className="record-page"><Title eyebrow="Community" title="Share a school moment" copy="Choose an authorized audience before publishing." /><form className="post-composer" onSubmit={submit}><label><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value)} required>{staffMode && <option value="school">Whole school</option>}{assignments.map((item) => <option key={item.id} value={item.class.id}>{item.class.name} · {item.subject.name}</option>)}</select></label><label><span>Post</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What happened in class today?" rows={6} maxLength={5000} required /></label><div className="media-actions"><button type="button" disabled><Camera /> Camera</button><button type="button" disabled><Image /> Photos</button><button type="button" disabled><Video /> Video</button><button type="button" disabled><FileText /> File</button></div><label className="comment-toggle"><span><strong>Allow comments</strong><small>Families and students in this audience may respond.</small></span><input type="checkbox" checked={comments} onChange={(event) => setComments(event.target.checked)} /></label>{notice && <p className="composer-notice">{notice}</p>}<button className="primary-action" type="submit" disabled={saving || !audience}><Send /> {saving ? 'Publishing…' : 'Publish post'}</button></form></div>
}

function AttendancePage() {
  const attendanceDate = new Date().toISOString().slice(0, 10)
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(0)
  const [students, setStudents] = useState<Array<{ id: number; name: string; status: AttendanceStatus }>>([])
  const [hasSubmittedSession, setHasSubmittedSession] = useState(false)
  const [correctionReason, setCorrectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedAssignment = useMemo(() => assignments.find((item) => item.id === selectedAssignmentId), [assignments, selectedAssignmentId])

  useEffect(() => {
    portalApi.getTeacherAssignments()
      .then((response) => {
        setAssignments(response.data)
        setSelectedAssignmentId(response.data[0]?.id ?? 0)
      })
      .catch(() => setError('Unable to load your current teaching assignments.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedAssignment) return
    setLoading(true)
    setError('')
    Promise.all([
      portalApi.getTeacherStudents(selectedAssignment),
      portalApi.getDailyAttendance(selectedAssignment, attendanceDate),
    ]).then(([rosterResponse, attendanceResponse]) => {
      const saved = new Map(attendanceResponse.data?.records.map((record) => [record.student_id, record.status]))
      setStudents(rosterResponse.data.map((student) => ({ id: student.id, name: student.full_name, status: saved.get(student.id) ?? 'present' })))
      setHasSubmittedSession(Boolean(attendanceResponse.data))
      setCorrectionReason('')
      setNotice('')
    }).catch(() => setError('Unable to load this class roster or attendance.')).finally(() => setLoading(false))
  }, [selectedAssignmentId, attendanceDate])

  const update = (id: number, status: AttendanceStatus) => setStudents((items) => items.map((student) => student.id === id ? { ...student, status } : student))
  const submit = async () => {
    if (!selectedAssignment || students.length === 0) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await portalApi.saveDailyAttendance(selectedAssignment, attendanceDate, students.map((student) => ({ student_id: student.id, status: student.status })), correctionReason)
      setHasSubmittedSession(true)
      setCorrectionReason('')
      setNotice('Daily attendance saved to the school record.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="record-page"><Title eyebrow="Attendance" title="Daily class check-in" copy={`${attendanceDate} · ${selectedAssignment?.class.name ?? 'Select an assigned class'} · ${students.length} enrolled students`} />{assignments.length > 1 && <label className="child-selector"><span>Class</span><select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(Number(event.target.value))}>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.class.name} · {assignment.subject.name}</option>)}</select></label>}{loading ? <div className="app-skeleton large" /> : error && students.length === 0 ? <div className="app-empty"><School /><h2>Attendance unavailable</h2><p>{error}</p></div> : assignments.length === 0 ? <div className="app-empty"><School /><h2>No assigned classes</h2><p>Only current teaching assignments can submit attendance.</p></div> : <><div className="attendance-summary"><span><strong>{students.filter((item) => item.status === 'present').length}</strong><small>Present</small></span><span><strong>{students.filter((item) => item.status === 'late').length}</strong><small>Late</small></span><span><strong>{students.filter((item) => item.status === 'absent').length}</strong><small>Absent</small></span></div><div className="attendance-roster">{students.map((student) => <div className="attendance-student" key={student.id}><span className="student-avatar small">{student.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{student.name}</strong><div className="attendance-statuses">{(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((status) => <button key={status} type="button" className={student.status === status ? `selected ${status}` : ''} onClick={() => update(student.id, status)} aria-label={`${student.name}: ${status}`}>{student.status === status ? <Check /> : <Circle />}</button>)}</div></div>)}</div><div className="attendance-legend"><span>Present</span><span>Late</span><span>Absent</span><span>Excused</span></div>{hasSubmittedSession && <label className="correction-reason"><span>Reason for any correction</span><textarea rows={2} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Required only when changing a submitted record" /></label>}{error && <p className="form-error">{error}</p>}{notice && <p className="composer-notice">{notice}</p>}<button type="button" className="primary-action" disabled={saving || students.length === 0} onClick={submit}><Check /> {saving ? 'Saving…' : hasSubmittedSession ? 'Update attendance' : 'Submit attendance'}</button></>}</div>
}

function TeacherMore({ teacherName, staffMode, onLogout }: { teacherName: string; staffMode: boolean; onLogout: () => void }) { return <div className="record-page"><Title eyebrow="Account" title={staffMode ? 'Staff tools' : 'Teacher tools'} copy="Mobile access follows your current role and assignments." /><section className="profile-card"><span className="profile-avatar">{teacherName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{teacherName}</h2><p>{staffMode ? 'Authorized Staff' : 'Teacher'}</p></section><section className="settings-list"><div><School /><span><small>Publishing</small><strong>{staffMode ? 'School and assigned audiences' : 'Assigned classes only'}</strong></span></div><button type="button" disabled><span><small>Quiz authoring · coming later</small><strong>Formal Quiz workspace</strong></span><ChevronRight /></button><button type="button" disabled><span><small>Assessment results · coming later</small><strong>Draft and publish marks</strong></span><ChevronRight /></button></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
