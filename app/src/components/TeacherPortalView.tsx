import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Circle, FileText, LogOut, MessageCircle, School, Send, UsersRound } from 'lucide-react'
import { portalApi, type AssessmentItem, type AttendanceStatus, type TeacherAssignment, type TeacherStudent } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'

export function TeacherPortalView({ teacherName, activeTab, onTabChange, onLogout, staffMode = false }: { teacherName: string; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void; staffMode?: boolean }) {
  if (activeTab === 'home') return <CommunityFeed role={staffMode ? 'staff' : 'teacher'} userName={teacherName} onCreatePost={() => onTabChange('create')} />
  if (activeTab === 'classes') return <ClassesPage staffMode={staffMode} onAssessments={() => onTabChange('assessments')} />
  if (activeTab === 'review' && staffMode) return <CommunityFeed role="staff" userName={teacherName} moderation />
  if (activeTab === 'create') return <CreatePost staffMode={staffMode} onPublished={() => onTabChange('home')} />
  if (activeTab === 'attendance') return <AttendancePage />
  if (activeTab === 'assessments') return <AssessmentPage />
  if (activeTab === 'quizzes' && !staffMode) return <QuizAuthoringPage />
  return <TeacherMore teacherName={teacherName} staffMode={staffMode} onAssessments={() => onTabChange('assessments')} onQuizzes={() => onTabChange('quizzes')} onLogout={onLogout} />
}

function Title({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header> }

function ClassesPage({ staffMode, onAssessments }: { staffMode: boolean; onAssessments: () => void }) {
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

  return <div className="record-page"><Title eyebrow="Teaching" title="Your classes" copy="Only current teaching assignments and their scoped rosters appear." />{loading ? <div className="app-skeleton large" /> : error ? <div className="app-empty"><School /><h2>Classes unavailable</h2><p>{error}</p></div> : classes.length === 0 ? <div className="app-empty"><School /><h2>No assigned classes</h2><p>Ask the school office to review your current teaching assignments.</p></div> : classes.map(({ assignment, students }) => <ClassCard key={assignment.id} name={assignment.class.name} subject={assignment.subject.name} students={students} year={assignment.academic_year.code} />)}<section className="teacher-quick-links"><button type="button" onClick={onAssessments}><FileText /><span><strong>Assessments</strong><small>Create, score, and publish class results</small></span><ChevronRight /></button><button type="button" disabled><MessageCircle /><span><strong>Class posts</strong><small>Use Create in the main navigation</small></span><ChevronRight /></button></section></div>
}
function ClassCard({ name, subject, students, year }: { name: string; subject: string; students: number; year: string }) { return <article className="class-card"><span className="class-monogram">{name}</span><span><strong>{name} · {subject}</strong><small><UsersRound /> {students} enrolled students</small><small>{year}</small></span></article> }

function CreatePost({ staffMode, onPublished }: { staffMode: boolean; onPublished: () => void }) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [audience, setAudience] = useState(staffMode ? 'school' : '')
  const [comments, setComments] = useState(true)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  useEffect(() => { if (!staffMode) portalApi.getTeacherAssignments().then(({ data }) => { setAssignments(data); setAudience(data[0] ? String(data[0].class.id) : '') }).catch(() => setNotice('Unable to load your assigned classes.')) }, [staffMode])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!audience) return; setSaving(true); setNotice(''); try { await portalApi.createCommunityPost(message, comments, audience === 'school' ? [{ type: 'school' }] : [{ type: 'class', class_id: Number(audience) }], files); onPublished() } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish this post.') } finally { setSaving(false) } }
  return <div className="record-page"><Title eyebrow="Community" title="Share a school moment" copy="Choose an authorized audience before publishing." /><form className="post-composer" onSubmit={submit}><label><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value)} required>{staffMode && <option value="school">Whole school</option>}{assignments.map((item) => <option key={item.id} value={item.class.id}>{item.class.name} · {item.subject.name}</option>)}</select></label><label><span>Post</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What happened in class today?" rows={6} maxLength={5000} required /></label><label><span>Photos, short video, or PDF</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 6))} /></label>{files.length > 0 && <small>{files.length} file{files.length === 1 ? '' : 's'} selected</small>}<label className="comment-toggle"><span><strong>Allow comments</strong><small>Families and students in this audience may respond.</small></span><input type="checkbox" checked={comments} onChange={(event) => setComments(event.target.checked)} /></label>{notice && <p className="composer-notice">{notice}</p>}<button className="primary-action" type="submit" disabled={saving || !audience}><Send /> {saving ? 'Publishing…' : 'Publish post'}</button></form></div>
}

function AssessmentPage() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(0)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(0)
  const [students, setStudents] = useState<TeacherStudent[]>([])
  const [scores, setScores] = useState<Record<number, string>>({})
  const [title, setTitle] = useState('')
  const [type, setType] = useState('test')
  const [maxScore, setMaxScore] = useState(100)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId)
  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId)

  const reload = () => Promise.all([portalApi.getTeacherAssignments(), portalApi.getAssessments()]).then(([assignmentResponse, assessmentResponse]) => {
    setAssignments(assignmentResponse.data); setAssessments(assessmentResponse.data)
    setSelectedAssignmentId((current) => current || assignmentResponse.data[0]?.id || 0)
    setSelectedAssessmentId((current) => current || assessmentResponse.data[0]?.id || 0)
  }).catch(() => setNotice('Unable to load assessment records.'))
  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (!selectedAssignment) return
    portalApi.getTeacherStudents(selectedAssignment).then(({ data }) => setStudents(data)).catch(() => setStudents([]))
  }, [selectedAssignmentId])
  useEffect(() => {
    if (!selectedAssessment) return
    setScores(Object.fromEntries(selectedAssessment.results.map((result) => [result.student_id, result.score === null ? '' : String(result.score)])))
  }, [selectedAssessmentId, assessments])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedAssignment) return; setSaving(true); setNotice('')
    try { const { data } = await portalApi.createAssessment(selectedAssignment, title, type, maxScore); setAssessments((items) => [data, ...items]); setSelectedAssessmentId(data.id); setTitle(''); setNotice('Assessment draft created.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to create assessment.') } finally { setSaving(false) }
  }
  const save = async () => {
    if (!selectedAssessment) return
    const rows = students.filter((student) => scores[student.id] !== undefined && scores[student.id] !== '').map((student) => ({ student_id: student.id, score: Number(scores[student.id]) }))
    setSaving(true); setNotice('')
    try { const { data } = await portalApi.saveAssessmentResults(selectedAssessment.id, rows); setAssessments((items) => items.map((item) => item.id === data.id ? data : item)); setNotice('Draft results saved.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save results.') } finally { setSaving(false) }
  }
  const publish = async () => {
    if (!selectedAssessment) return; setSaving(true); setNotice('')
    try { const { data } = await portalApi.publishAssessment(selectedAssessment.id); setAssessments((items) => items.map((item) => item.id === data.id ? data : item)); setNotice('Results published to authorized families and students.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish results.') } finally { setSaving(false) }
  }

  return <div className="record-page"><Title eyebrow="Assessments" title="Class results" copy="Draft first. Families and students see results only after explicit publication." />
    <form className="post-composer" onSubmit={create}><label><span>Class and subject</span><select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(Number(event.target.value))}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.class.name} · {item.subject.name}</option>)}</select></label><label><span>Title</span><input value={title} maxLength={200} required onChange={(event) => setTitle(event.target.value)} /></label><label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="quiz">Quiz</option><option value="test">Test</option><option value="project">Project</option><option value="exam">Exam</option></select></label><label><span>Maximum score</span><input type="number" min="1" step="0.01" value={maxScore} onChange={(event) => setMaxScore(Number(event.target.value))} /></label><button className="primary-action" disabled={saving || !selectedAssignment} type="submit">Create draft</button></form>
    <div className="section-heading"><span><b>Assessment drafts and history</b><small>{assessments.length} records</small></span></div>{assessments.length > 0 && <label className="child-selector"><span>Assessment</span><select value={selectedAssessmentId} onChange={(event) => setSelectedAssessmentId(Number(event.target.value))}>{assessments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>}
    {selectedAssessment && <section className="assessment-editor"><p>{selectedAssessment.subject.name} · {selectedAssessment.max_score} points · <strong>{selectedAssessment.status}</strong></p>{students.map((student) => <label key={student.id}><span>{student.full_name}</span><input type="number" min="0" max={selectedAssessment.max_score} step="0.01" disabled={selectedAssessment.status === 'published'} value={scores[student.id] ?? ''} onChange={(event) => setScores((items) => ({ ...items, [student.id]: event.target.value }))} /></label>)}{selectedAssessment.status !== 'published' && <><button type="button" className="secondary-action" disabled={saving} onClick={() => void save()}>Save draft results</button><button type="button" className="primary-action" disabled={saving} onClick={() => void publish()}>Publish complete results</button></>}</section>}
    {notice && <p className="composer-notice">{notice}</p>}
  </div>
}

function QuizAuthoringPage() {
  const [assignments,setAssignments]=useState<TeacherAssignment[]>([]);const [assignmentId,setAssignmentId]=useState(0);const [title,setTitle]=useState('');const [prompt,setPrompt]=useState('');const [type,setType]=useState<'multiple_choice'|'true_false'>('multiple_choice');const [options,setOptions]=useState(['','','','']);const [correct,setCorrect]=useState(0);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('')
  useEffect(()=>{portalApi.getTeacherAssignments().then(({data})=>{setAssignments(data);setAssignmentId(data[0]?.id??0)}).catch(()=>setNotice('Unable to load teaching assignments.'))},[])
  useEffect(()=>{if(type==='true_false'){setOptions(['True','False']);setCorrect(0)}else setOptions(['','','',''])},[type])
  const submit=async(event:React.FormEvent)=>{event.preventDefault();const assignment=assignments.find((item)=>item.id===assignmentId);if(!assignment)return;setSaving(true);setNotice('');try{const quiz=await portalApi.createFormalQuiz(assignment,title,prompt,options,correct);const assigned=await portalApi.createQuizAssignment(quiz.data.id,assignment);await portalApi.publishQuizAssignment(assigned.data.id);setTitle('');setPrompt('');setNotice('Quiz published to the current class roster.')}catch(error){setNotice(error instanceof Error?error.message:'Unable to publish quiz.')}finally{setSaving(false)}}
  return <div className="record-page"><Title eyebrow="Formal Quiz" title="Create a class quiz" copy="V1 supports multiple choice and true/false. Correct answers stay server-side."/><form className="post-composer" onSubmit={submit}><label><span>Class and subject</span><select value={assignmentId} onChange={(e)=>setAssignmentId(Number(e.target.value))}>{assignments.map((a)=><option key={a.id} value={a.id}>{a.class.name} · {a.subject.name}</option>)}</select></label><label><span>Quiz title</span><input required maxLength={200} value={title} onChange={(e)=>setTitle(e.target.value)}/></label><label><span>Question type</span><select value={type} onChange={(e)=>setType(e.target.value as 'multiple_choice'|'true_false')}><option value="multiple_choice">Multiple choice</option><option value="true_false">True / False</option></select></label><label><span>Question</span><textarea required rows={4} value={prompt} onChange={(e)=>setPrompt(e.target.value)}/></label>{options.map((value,index)=><label key={index}><span>Option {index+1} {correct===index?'· correct':''}</span><span className="quiz-option-editor"><input type="radio" name="correct" checked={correct===index} onChange={()=>setCorrect(index)}/><input required readOnly={type==='true_false'} value={value} onChange={(e)=>setOptions((all)=>all.map((item,i)=>i===index?e.target.value:item))}/></span></label>)}<button className="primary-action" disabled={saving||!assignmentId} type="submit">{saving?'Publishing…':'Create and publish'}</button>{notice&&<p className="composer-notice">{notice}</p>}</form></div>
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

function TeacherMore({ teacherName, staffMode, onAssessments, onQuizzes, onLogout }: { teacherName: string; staffMode: boolean; onAssessments: () => void; onQuizzes: () => void; onLogout: () => void }) { return <div className="record-page"><Title eyebrow="Account" title={staffMode ? 'Staff tools' : 'Teacher tools'} copy="Mobile access follows your current role and assignments." /><section className="profile-card"><span className="profile-avatar">{teacherName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{teacherName}</h2><p>{staffMode ? 'Authorized Staff' : 'Teacher'}</p></section><section className="settings-list"><div><School /><span><small>Publishing</small><strong>{staffMode ? 'School and assigned audiences' : 'Assigned classes only'}</strong></span></div>{staffMode?<button type="button" disabled><span><small>Formal Quiz</small><strong>Use an assigned Teacher role or future Admin workspace</strong></span><ChevronRight/></button>:<button type="button" onClick={onQuizzes}><span><small>Formal Quiz</small><strong>Create and publish class quizzes</strong></span><ChevronRight/></button>}{staffMode ? <button type="button" disabled><span><small>Assessment administration</small><strong>Use the Admin assessment workspace when connected</strong></span><ChevronRight /></button> : <button type="button" onClick={onAssessments}><span><small>Assessment results</small><strong>Draft and publish marks</strong></span><ChevronRight /></button>}</section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
