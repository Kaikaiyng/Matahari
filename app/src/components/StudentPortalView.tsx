import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, ChevronRight, Clock3, GraduationCap, Lightbulb, LockKeyhole, LogOut, PlayCircle, Sparkles, UserRound } from 'lucide-react'
import { portalApi, type AttendanceRecord, type StudentEnrolment, type StudentMe } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'

export function StudentPortalView({ studentName, activeTab, onLogout }: { studentName: string; activeTab: string; onLogout: () => void }) {
  const [student, setStudent] = useState<StudentMe['data']>(null)
  const [enrolments, setEnrolments] = useState<StudentEnrolment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([portalApi.getStudentMe(), portalApi.getStudentEnrolments(), portalApi.getStudentAttendance()]).then(([self, history, attendanceResponse]) => { setStudent(self.data); setEnrolments(history.data); setAttendance(attendanceResponse.data) }).finally(() => setLoading(false)) }, [])
  if (activeTab === 'home') return <CommunityFeed role="student" userName={student?.full_name ?? studentName} />
  if (loading) return <div className="record-page"><div className="app-skeleton large" /><div className="app-skeleton" /><div className="app-skeleton" /></div>
  if (activeTab === 'learn') return <StudentLearn student={student} enrolments={enrolments} attendance={attendance} />
  if (activeTab === 'quiz') return <StudentQuiz />
  if (activeTab === 'schedule') return <StudentSchedule />
  return <StudentMore student={student} fallbackName={studentName} onLogout={onLogout} />
}

function Title({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header> }

function StudentLearn({ student, enrolments, attendance }: { student: StudentMe['data']; enrolments: StudentEnrolment[]; attendance: AttendanceRecord[] }) {
  const current = enrolments.find((item) => item.status === 'active') ?? enrolments[0]
  const subjects = current?.subjects ?? []
  const counts = { present: attendance.filter((item) => item.status === 'present').length, late: attendance.filter((item) => item.status === 'late').length, absent: attendance.filter((item) => item.status === 'absent').length }
  return <div className="record-page"><Title eyebrow="My learning" title="Progress at a glance" copy={`${student?.class?.name ?? current?.class?.name ?? 'Current class'} · Published school records`} /><section className="student-progress-banner"><span><small>Recorded attendance</small><strong>{attendance.length}</strong><em>{counts.present} present · {counts.late} late · {counts.absent} absent</em></span><CalendarDays /></section><div className="section-heading"><span><b>My subjects</b><small>{subjects.length || 4} active subjects</small></span></div><div className="subject-list">{(subjects.length ? subjects : demoSubjects).map((subject, index) => <button type="button" key={`${subject.subject_id ?? index}-${subject.subject_name}`}><span className={`subject-mark mark-${index % 4}`}><BookOpen /></span><span><strong>{subject.subject_name}</strong><small>{subject.teacher_name ?? 'Teacher to be confirmed'}</small></span><span className="subject-score">{['A', 'A', 'B+', 'A-'][index % 4]}<small>Preview</small></span><ChevronRight /></button>)}</div><div className="section-heading"><span><b>Recent feedback</b><small>Design preview · not connected</small></span></div><article className="feedback-card"><Lightbulb /><div><strong>Example teacher feedback</strong><p>You connected each stage of the water cycle clearly. Next time, add one example from daily life.</p><small>Example content only</small></div></article></div>
}

const demoSubjects = [
  { subject_id: 1, subject_code: 'MAT', subject_name: 'Mathematics', teacher_name: 'Ms Lim' },
  { subject_id: 2, subject_code: 'SCI', subject_name: 'Science', teacher_name: 'Mr Arif' },
  { subject_id: 3, subject_code: 'ENG', subject_name: 'English', teacher_name: 'Ms Wong' },
  { subject_id: 4, subject_code: 'BM', subject_name: 'Bahasa Melayu', teacher_name: 'Cikgu Nadia' },
]

function StudentQuiz() {
  return <div className="record-page"><Title eyebrow="Quiz" title="Test what you know" copy="Formal assignments and personal practice stay separate." /><section className="quiz-callout"><span className="quiz-icon"><GraduationCap /></span><div><small>Assigned by Ms Lim</small><h2>Fractions checkpoint</h2><p>10 questions · Multiple choice · Due Friday</p><span className="status-label warning">Not started</span></div><button type="button">Start quiz <ChevronRight /></button></section><div className="section-heading"><span><b>Assigned quizzes</b><small>Formal school work</small></span></div><button type="button" className="quiz-row"><span className="quiz-row-icon blue"><PlayCircle /></span><span><strong>Water cycle review</strong><small>Science · 8 questions</small></span><span className="status-label success">82%</span><ChevronRight /></button><button type="button" className="quiz-row"><span className="quiz-row-icon amber"><Clock3 /></span><span><strong>Grammar: past tense</strong><small>English · Due 19 August</small></span><span className="status-label neutral">Upcoming</span><ChevronRight /></button><div className="section-heading"><span><b>Practice quiz</b><small>Private · never part of formal grades</small></span></div><section className="practice-builder"><Sparkles /><h2>Build a personal practice</h2><p>Choose a subject, topic, difficulty, and question count. AI generation is not active.</p><div className="practice-options"><button type="button">Mathematics</button><button type="button">Science</button><button type="button">English</button></div><button type="button" className="secondary-action" disabled><LockKeyhole /> Practice generator coming later</button></section></div>
}

function StudentSchedule() { return <div className="record-page"><Title eyebrow="Schedule" title="Your school day" copy="Classes, events, and due dates in one timeline." /><div className="date-switcher"><button type="button">‹</button><span><strong>Tuesday</strong><small>12 August 2026</small></span><button type="button">›</button></div><section className="timeline"><ScheduleItem time="08:00" title="Mathematics" detail="Ms Lim · Room 3" active /><ScheduleItem time="09:15" title="English" detail="Ms Wong · Library" /><ScheduleItem time="10:30" title="Break" detail="30 minutes" muted /><ScheduleItem time="11:00" title="Science" detail="Mr Arif · Lab 1" /><ScheduleItem time="13:30" title="Art Club" detail="Studio · Bring sketchbook" /></section><div className="calendar-note"><CalendarDays /><span><strong>Family Sports Evening</strong><small>Friday · 5:00 PM · Main field</small></span></div></div> }
function ScheduleItem({ time, title, detail, active, muted }: { time: string; title: string; detail: string; active?: boolean; muted?: boolean }) { return <div className={`timeline-row ${active ? 'active' : ''} ${muted ? 'muted' : ''}`}><time>{time}</time><i /><span><strong>{title}</strong><small>{detail}</small></span>{active && <b>Now</b>}</div> }

function StudentMore({ student, fallbackName, onLogout }: { student: StudentMe['data']; fallbackName: string; onLogout: () => void }) { const name = student?.full_name ?? fallbackName; return <div className="record-page"><Title eyebrow="Account" title="Profile and settings" copy="Your private student access." /><section className="profile-card"><span className="profile-avatar">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{name}</h2><p>{student?.student_no ?? 'Student account'} · {student?.class?.name ?? 'No class'}</p></section><section className="settings-list"><div><UserRound /><span><small>Role</small><strong>Student self-service</strong></span></div><button type="button"><span><small>Notifications</small><strong>School and class updates</strong></span><ChevronRight /></button><button type="button"><span><small>Privacy</small><strong>Community visibility information</strong></span><ChevronRight /></button></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
