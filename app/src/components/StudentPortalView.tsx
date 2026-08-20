import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Lightbulb, LockKeyhole, LogOut, PlayCircle, Sparkles, UserRound } from 'lucide-react'
import { portalApi, type AttendanceRecord, type FormalQuizAssignment, type FormalQuizAttempt, type PublishedAssessmentResult, type StudentEnrolment, type StudentMe, type StudentSchedule as StudentScheduleData } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySafetyCentre } from '../features/community-safety/CommunitySafetyCentre'
import { CommunitySafetyLinks } from '../features/community-safety/CommunitySafetyLinks'
import { useSwipe } from './MobileShell'

export function StudentPortalView({ studentName, activeTab, onTabChange = () => undefined, onLogout }: { studentName: string; activeTab: string; onTabChange?: (tab: string) => void; onLogout: () => void }) {
  const { dragOffset, isDragging } = useSwipe()
  const [student, setStudent] = useState<StudentMe['data']>(null)
  const [enrolments, setEnrolments] = useState<StudentEnrolment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [results, setResults] = useState<PublishedAssessmentResult[]>([])
  const [schedule, setSchedule] = useState<StudentScheduleData>({ entries: [], due_dates: [] })
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([portalApi.getStudentMe(), portalApi.getStudentEnrolments(), portalApi.getStudentAttendance(), portalApi.getStudentAssessmentResults(), portalApi.getStudentSchedule()]).then(([self, history, attendanceResponse, resultResponse, scheduleResponse]) => { setStudent(self.data); setEnrolments(history.data); setAttendance(attendanceResponse.data); setResults(resultResponse.data); setSchedule(scheduleResponse.data) }).finally(() => setLoading(false)) }, [])

  const [previousTab, setPreviousTab] = useState<string>('home')

  useEffect(() => {
    if (activeTab !== 'safety') {
      setPreviousTab(activeTab)
    }
  }, [activeTab])

  if (activeTab === 'safety') return <CommunitySafetyCentre onBack={() => onTabChange(previousTab)} />

  const primaryTabs = ['home', 'learn', 'quiz', 'schedule', 'more']
  const activeIndex = primaryTabs.indexOf(activeTab)

  const trackTransform = activeIndex !== -1
    ? `calc(-${activeIndex * 100}% + ${dragOffset}px)`
    : '0px'

  return (
    <div className="portal-viewpager-container">
      <div
        className="portal-viewpager-track"
        style={{
          transform: `translateX(${trackTransform})`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        <div className={`portal-tab-slide ${activeTab === 'home' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <CommunityFeed role="student" userName={student?.full_name ?? studentName} activeTab={activeTab} />
        </div>
        <div className={`portal-tab-slide ${activeTab === 'learn' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {loading ? (
            <div className="record-page"><div className="app-skeleton large" /><div className="app-skeleton" /><div className="app-skeleton" /></div>
          ) : (
            <StudentLearn student={student} enrolments={enrolments} attendance={attendance} results={results} />
          )}
        </div>
        <div className={`portal-tab-slide ${activeTab === 'quiz' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <StudentQuiz />
        </div>
        <div className={`portal-tab-slide ${activeTab === 'schedule' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {loading ? (
            <div className="record-page"><div className="app-skeleton large" /><div className="app-skeleton" /><div className="app-skeleton" /></div>
          ) : (
            <StudentSchedule schedule={schedule} />
          )}
        </div>
        <div className={`portal-tab-slide ${activeTab === 'more' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <StudentMore student={student} fallbackName={studentName} onSafety={() => onTabChange('safety')} onLogout={onLogout} />
        </div>
      </div>
    </div>
  )
}

function Title({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header> }

function StudentLearn({ student, enrolments, attendance, results }: { student: StudentMe['data']; enrolments: StudentEnrolment[]; attendance: AttendanceRecord[]; results: PublishedAssessmentResult[] }) {
  const current = enrolments.find((item) => item.status === 'active') ?? enrolments[0]
  const subjects = current?.subjects ?? []
  const counts = { present: attendance.filter((item) => item.status === 'present').length, late: attendance.filter((item) => item.status === 'late').length, absent: attendance.filter((item) => item.status === 'absent').length }
  return <div className="record-page"><Title eyebrow="My learning" title="Progress at a glance" copy={`${student?.class?.name ?? current?.class?.name ?? 'Current class'} · live enrolment, attendance, and published results`} /><section className="student-progress-banner"><span><small>Recorded attendance</small><strong>{attendance.length}</strong><em>{counts.present} present · {counts.late} late · {counts.absent} absent</em></span><CalendarDays /></section><div className="section-heading"><span><b>My subjects</b><small>{subjects.length} current subject{subjects.length === 1 ? '' : 's'}</small></span></div><div className="subject-list">{subjects.map((subject, index) => <button type="button" disabled key={`${subject.subject_id ?? index}-${subject.subject_name}`}><span className={`subject-mark mark-${index % 4}`}><BookOpen /></span><span><strong>{subject.subject_name}</strong><small>{subject.teacher_name ?? 'Teacher to be confirmed'}</small></span><span className="subject-score">Current<small>Enrolment</small></span><ChevronRight /></button>)}</div><div className="section-heading"><span><b>Published results</b><small>{results.length} result{results.length === 1 ? '' : 's'}</small></span></div>{results.map((result) => <article className="feedback-card" key={result.id}><Lightbulb /><div><strong>{result.subject} · {result.title}</strong><p>{result.score} / {result.max_score}{result.grade_label ? ` · ${result.grade_label}` : ''}</p>{result.teacher_comment && <small>{result.teacher_comment}</small>}</div></article>)}{results.length === 0 && <p className="quiet-empty">No assessment results have been published.</p>}</div>
}

function StudentQuiz() {
  const [items, setItems] = useState<FormalQuizAssignment[]>([])
  const [attempt, setAttempt] = useState<FormalQuizAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<{ score: number; max_score: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [isExiting, setIsExiting] = useState(false)

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  useEffect(() => {
    portalApi.getStudentQuizzes().then(({ data }) => setItems(data)).catch(() => setNotice('Unable to load assigned quizzes.'))
  }, [])

  const start = async (id: number) => {
    try {
      const { data } = await portalApi.startQuizAttempt(id)
      setAttempt(data)
      setAnswers({})
      setResult(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to start quiz.')
    }
  }

  const submit = async () => {
    if (!attempt) return
    try {
      const { data } = await portalApi.submitQuizAttempt(attempt.id, attempt.questions.map((q) => ({ question_id: q.id, option_id: answers[q.id] })))
      setResult(data)
      setAttempt(null)
      const list = await portalApi.getStudentQuizzes()
      setItems(list.data)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to submit quiz.')
    }
  }

  const handleCloseAttempt = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      setAttempt(null)
      setIsExiting(false)
    }, 200)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (!touchStart) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y

    if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      setDragOffset(deltaX)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (!touchStart) return
    setIsDragging(false)

    if (dragOffset > 80) {
      handleCloseAttempt()
    }

    setDragOffset(0)
    setTouchStart(null)
  }

  return (
    <div className="record-page">
      <Title eyebrow="Quiz" title="Assigned quizzes" copy="Formal work is assigned by your teacher and scored by MIS." />
      {notice && <p className="form-error">{notice}</p>}

      {result && (
        <section className="quiz-callout">
          <GraduationCap />
          <div>
            <small>Latest result</small>
            <h2>{result.score} / {result.max_score}</h2>
            <p>Scored automatically by MIS.</p>
          </div>
        </section>
      )}

      {items.map((item) => (
        <button
          type="button"
          className="quiz-row"
          key={item.id}
          disabled={item.attempts_used >= item.attempt_limit}
          onClick={() => void start(item.id)}
        >
          <span className="quiz-row-icon blue"><PlayCircle /></span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.question_count} questions · {item.attempts_used}/{item.attempt_limit} attempts</small>
          </span>
          <ChevronRight />
        </button>
      ))}

      {items.length === 0 && <p className="quiet-empty">No formal quizzes are assigned.</p>}

      <div className="section-heading">
        <span><b>Practice quiz</b><small>Private · never part of formal grades</small></span>
      </div>

      <section className="practice-builder">
        <Sparkles />
        <h2>Personal practice</h2>
        <p>AI practice generation remains intentionally disabled.</p>
        <button type="button" className="secondary-action" disabled>
          <LockKeyhole /> Practice generator coming later
        </button>
      </section>

      {attempt && createPortal(
        <div
          className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
          role="region"
          aria-label={`Taking ${attempt.title}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99990,
            background: '#f6f3ee',
            overflowY: 'auto',
            transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
            opacity: dragOffset > 0 ? Math.max(0.2, 1 - dragOffset / 400) : undefined,
            transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
            willChange: 'transform, opacity',
          }}
        >
          <div className="subpage-container">
            <header className="subpage-header">
              <button
                type="button"
                className="subpage-back-btn"
                onClick={handleCloseAttempt}
                aria-label="Back to quizzes"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="subpage-nav-title">{attempt.title}</h1>
              <div style={{ width: '38px', flexShrink: 0 }} />
            </header>

            <section className="quiz-attempt">
              <h2>{attempt.title}</h2>
              {attempt.questions.map((q, index) => (
                <fieldset key={q.id}>
                  <legend>{index + 1}. {q.prompt}</legend>
                  {q.options.map((o) => (
                    <label key={o.id}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === o.id}
                        onChange={() => setAnswers((all) => ({ ...all, [q.id]: o.id }))}
                      />
                      {o.option_text}
                    </label>
                  ))}
                </fieldset>
              ))}
              <button
                className="primary-action"
                type="button"
                disabled={Object.keys(answers).length !== attempt.questions.length}
                onClick={() => void submit()}
              >
                Submit answers
              </button>
            </section>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
function StudentSchedule({ schedule }: { schedule: StudentScheduleData }) {
  const today = new Date().getDay()
  const [day, setDay] = useState(today === 0 ? 7 : today)
  const entries = schedule.entries.filter((entry) => entry.day_of_week === day)
  return <div className="record-page"><Title eyebrow="Schedule" title="Your school week" copy="Published classes and assessment due dates from MIS." /><div className="date-switcher"><button type="button" aria-label="Previous day" onClick={() => setDay(day === 1 ? 7 : day - 1)}>‹</button><span><strong>{dayNames[day - 1]}</strong><small>Published class schedule</small></span><button type="button" aria-label="Next day" onClick={() => setDay(day === 7 ? 1 : day + 1)}>›</button></div>{entries.length ? <section className="timeline">{entries.map((entry) => <ScheduleItem key={entry.id} time={entry.starts_at} title={entry.title} detail={[entry.teacher, entry.location, entry.ends_at].filter(Boolean).join(' · ')} />)}</section> : <p className="quiet-empty">No published classes for {dayNames[day - 1]}.</p>}<div className="section-heading"><span><b>Assessment due dates</b><small>{schedule.due_dates.length} published</small></span></div>{schedule.due_dates.map((item) => <div className="calendar-note" key={item.assessment_id}><CalendarDays /><span><strong>{item.subject} · {item.title}</strong><small>{new Date(item.due_at).toLocaleString()}</small></span></div>)}{schedule.due_dates.length === 0 && <p className="quiet-empty">No published assessment due dates.</p>}</div>
}
function ScheduleItem({ time, title, detail }: { time: string; title: string; detail: string }) { return <div className="timeline-row"><time>{time}</time><i /><span><strong>{title}</strong><small>{detail}</small></span></div> }

function StudentMore({ student, fallbackName, onLogout }: { student: StudentMe['data']; fallbackName: string; onSafety?: () => void; onLogout: () => void }) { const name = student?.full_name ?? fallbackName; return <div className="record-page"><Title eyebrow="Account" title="Profile and settings" copy="Your private student access." /><section className="profile-card"><span className="profile-avatar">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{name}</h2><p>{student?.student_no ?? 'Student account'} · {student?.class?.name ?? 'No class'}</p></section><section className="settings-list"><div><UserRound /><span><small>Role</small><strong>Student self-service</strong></span></div><CommunitySafetyLinks /><div><ChevronRight/><span><small>Notifications</small><strong>Open the bell in the header</strong></span></div><div><ChevronRight/><span><small>Privacy</small><strong>Only your own records and authorized class content are shown</strong></span></div></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
