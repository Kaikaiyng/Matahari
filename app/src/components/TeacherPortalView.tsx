import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardCheck, FileText, LogOut, MessageCircle, School, Send, Upload, UsersRound, X } from 'lucide-react'
import { portalApi, type AssessmentItem, type AttendanceStatus, type TeacherAssignment, type TeacherStudent } from '../api/portalApi'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySafetyCentre } from '../features/community-safety/CommunitySafetyCentre'
import { CommunitySafetyLinks } from '../features/community-safety/CommunitySafetyLinks'
import { CustomSelect } from './CustomSelect'

import { useSwipe } from './MobileShell'
import { useSwipeBack } from './useSwipeBack'

export function TeacherPortalView({ teacherName, activeTab, onTabChange, onLogout, staffMode = false }: { teacherName: string; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void; staffMode?: boolean }) {
  const { dragOffset, isDragging } = useSwipe()
  const [previousTab, setPreviousTab] = useState<string>(staffMode ? 'classes' : 'home')

  useEffect(() => {
    if (activeTab !== 'safety' && activeTab !== 'assessments' && activeTab !== 'quizzes') {
      setPreviousTab(activeTab)
    }
  }, [activeTab])

  if (activeTab === 'safety') return <CommunitySafetyCentre onBack={() => onTabChange(previousTab)} />
  if (activeTab === 'assessments') return <AssessmentPage staffMode={staffMode} onBack={() => onTabChange(previousTab)} />
  if (activeTab === 'quizzes') return <QuizAuthoringPage staffMode={staffMode} onBack={() => onTabChange(previousTab)} />

  const primaryTabs = staffMode
    ? ['home', 'classes', 'create', 'review', 'more']
    : ['home', 'classes', 'create', 'attendance', 'more']
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
          <CommunityFeed role={staffMode ? 'staff' : 'teacher'} userName={teacherName} onCreatePost={() => onTabChange('create')} activeTab={activeTab} />
        </div>
        <div className={`portal-tab-slide ${activeTab === 'classes' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <ClassesPage staffMode={staffMode} onAssessments={() => onTabChange('assessments')} onQuizzes={() => onTabChange('quizzes')} onReview={() => onTabChange('review')} onAttendance={() => onTabChange('attendance')} onCreatePost={() => onTabChange('create')} />
        </div>
        <div className={`portal-tab-slide ${activeTab === 'create' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <CreatePost staffMode={staffMode} onPublished={() => onTabChange('home')} />
        </div>
        <div className={`portal-tab-slide ${(staffMode ? activeTab === 'review' : activeTab === 'attendance') ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          {staffMode ? (
            <CommunityFeed role="staff" userName={teacherName} moderation />
          ) : (
            <AttendancePage />
          )}
        </div>
        <div className={`portal-tab-slide ${activeTab === 'more' ? 'active' : ''} ${isDragging ? 'swiping' : ''}`}>
          <TeacherMore teacherName={teacherName} staffMode={staffMode} onAssessments={() => onTabChange('assessments')} onQuizzes={() => onTabChange('quizzes')} onSafety={() => onTabChange('safety')} onLogout={onLogout} />
        </div>
      </div>
    </div>
  )
}

function Title({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="record-page-title"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></header> }

function ClassesPage({
  staffMode,
  onAssessments,
  onQuizzes,
  onReview,
  onAttendance,
  onCreatePost,
}: {
  staffMode: boolean
  onAssessments: () => void
  onQuizzes: () => void
  onReview: () => void
  onAttendance: () => void
  onCreatePost: () => void
}) {
  const [classes, setClasses] = useState<Array<{ assignment: TeacherAssignment; students: number }>>([])
  const [loading, setLoading] = useState(!staffMode)
  const [error, setError] = useState('')
  const [selectedClass, setSelectedClass] = useState<{ assignment: TeacherAssignment; students: number } | null>(null)

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
    return <div className="record-page"><Title eyebrow="School" title="School tools" copy="Authorized workflows remain protected by backend permissions." /><section className="teacher-quick-links"><button type="button" onClick={onReview}><FileText /><span><strong>Content review</strong><small>Review and hide inappropriate posts</small></span><ChevronRight /></button><button type="button" onClick={onAssessments}><FileText/><span><strong>Assessments</strong><small>Manage same-school results</small></span><ChevronRight/></button><button type="button" onClick={onQuizzes}><MessageCircle/><span><strong>Formal Quiz</strong><small>Create assignments for school classes</small></span><ChevronRight/></button></section></div>
  }

  return (
    <div className="record-page">
      <Title eyebrow="Teaching" title="Your classes" copy="Only current teaching assignments and their scoped rosters appear." />
      {loading ? (
        <div className="app-skeleton large" />
      ) : error ? (
        <div className="app-empty"><School /><h2>Classes unavailable</h2><p>{error}</p></div>
      ) : classes.length === 0 ? (
        <div className="app-empty"><School /><h2>No assigned classes</h2><p>Ask the school office to review your current teaching assignments.</p></div>
      ) : (
        classes.map(({ assignment, students }) => (
          <ClassCard
            key={assignment.id}
            name={assignment.class.name}
            subject={assignment.subject.name}
            students={students}
            year={assignment.academic_year.code}
            onClick={() => setSelectedClass({ assignment, students })}
          />
        ))
      )}

      <section className="teacher-quick-links">
        <button type="button" onClick={onAssessments}>
          <FileText />
          <span><strong>Assessments</strong><small>Create, score, and publish class results</small></span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onCreatePost}>
          <MessageCircle />
          <span><strong>Class posts</strong><small>Publish announcements for your assigned classes</small></span>
          <ChevronRight />
        </button>
      </section>

      {selectedClass && (
        <ClassDetailSubpage
          assignment={selectedClass.assignment}
          studentCount={selectedClass.students}
          onClose={() => setSelectedClass(null)}
          onAttendance={onAttendance}
          onAssessments={onAssessments}
          onCreatePost={onCreatePost}
        />
      )}
    </div>
  )
}

function ClassCard({
  name,
  subject,
  students,
  year,
  onClick,
}: {
  name: string
  subject: string
  students: number
  year: string
  onClick: () => void
}) {
  return (
    <button type="button" className="class-card" onClick={onClick} aria-label={`Open class ${name} ${subject}`}>
      <span className="class-monogram">{name}</span>
      <span>
        <strong>{name} · {subject}</strong>
        <small><UsersRound size={13} style={{ verticalAlign: '-2px' }} /> {students} enrolled student{students === 1 ? '' : 's'}</small>
        <small>{year}</small>
      </span>
      <ChevronRight size={18} style={{ color: 'var(--app-muted)' }} />
    </button>
  )
}

function ClassDetailSubpage({
  assignment,
  studentCount,
  onClose,
  onAttendance,
  onAssessments,
  onCreatePost,
}: {
  assignment: TeacherAssignment
  studentCount: number
  onClose: () => void
  onAttendance: () => void
  onAssessments: () => void
  onCreatePost: () => void
}) {
  const [students, setStudents] = useState<TeacherStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { isExiting, requestBack: handleBack, surfaceStyle, gestureHandlers } = useSwipeBack(onClose)

  useEffect(() => {
    portalApi.getTeacherStudents(assignment)
      .then(({ data }) => setStudents(data))
      .catch(() => setError('Unable to load roster for this class.'))
      .finally(() => setLoading(false))
  }, [assignment])

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label={`Class details for ${assignment.class.name}`}
      {...gestureHandlers}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        ...surfaceStyle,
      }}
    >
      <div className="subpage-container">
        <header className="subpage-header">
          <button
            type="button"
            className="subpage-back-btn"
            onClick={handleBack}
            aria-label="Back to classes"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">{assignment.class.name} · {assignment.subject.name}</h1>
          <div style={{ width: '38px', flexShrink: 0 }} />
        </header>

        <section className="subpage-hero-card">
          <p className="subpage-eyebrow">Academic Year {assignment.academic_year.code}</p>
          <h1 className="subpage-title">{assignment.class.name}</h1>
          <p className="subpage-version">Subject: {assignment.subject.name}</p>
          <p className="subpage-desc">
            <UsersRound size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
            {studentCount} enrolled student{studentCount === 1 ? '' : 's'} assigned to this roster.
          </p>
        </section>

        <section className="subpage-content-group">
          <div className="subpage-section-heading">
            <b>Class Workflows</b>
            <small>Quick actions</small>
          </div>
          <div className="about-policy-list-card">
            <button
              type="button"
              className="about-policy-item"
              onClick={() => { onClose(); onAttendance() }}
            >
              <ClipboardCheck size={18} className="about-item-icon" />
              <span className="about-item-title">Check Daily Attendance</span>
              <ChevronRight size={18} className="about-item-arrow" />
            </button>

            <button
              type="button"
              className="about-policy-item"
              onClick={() => { onClose(); onAssessments() }}
            >
              <FileText size={18} className="about-item-icon" />
              <span className="about-item-title">Manage Assessments & Marks</span>
              <ChevronRight size={18} className="about-item-arrow" />
            </button>

            <button
              type="button"
              className="about-policy-item"
              onClick={() => { onClose(); onCreatePost() }}
            >
              <Send size={18} className="about-item-icon" />
              <span className="about-item-title">Publish Class Announcement</span>
              <ChevronRight size={18} className="about-item-arrow" />
            </button>
          </div>
        </section>

        <section className="subpage-content-group">
          <div className="subpage-section-heading">
            <b>Class Roster</b>
            <small>{students.length} student{students.length === 1 ? '' : 's'}</small>
          </div>

          {loading ? (
            <div className="app-skeleton large" />
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : (
            <div className="about-policy-list-card">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="about-policy-item"
                  style={{ display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: '10px', alignItems: 'center' }}
                >
                  <span className="student-avatar small">
                    {student.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <span>
                    <strong style={{ fontSize: '14px', display: 'block' }}>{student.full_name}</strong>
                    <small style={{ color: 'var(--app-muted)', fontSize: '11px' }}>ID #{student.id}</small>
                  </span>
                  <span className="status-label success">Enrolled</span>
                </div>
              ))}
              {students.length === 0 && (
                <p className="quiet-empty" style={{ padding: '16px', margin: 0 }}>
                  No students currently enrolled in this class.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  )
}

function AudienceSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (val: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((opt) => opt.value === value) ?? options[0]

  return (
    <div className="custom-select-container">
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label ?? 'Select audience'}</span>
        <ChevronDown size={18} className={`select-arrow-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="select-backdrop" onClick={() => setIsOpen(false)} />
          <div className="custom-select-dropdown">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`custom-select-option ${value === option.value ? 'active' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                <span>{option.label}</span>
                {value === option.value && <Check size={16} className="check-icon" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CreatePost({ staffMode, onPublished }: { staffMode: boolean; onPublished: () => void }) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [audience, setAudience] = useState(staffMode ? 'school' : '')
  const [comments, setComments] = useState(true)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    if (!staffMode) {
      portalApi.getTeacherAssignments()
        .then(({ data }) => {
          setAssignments(data)
          setAudience(data.length > 1 ? 'all_classes' : (data[0] ? String(data[0].class.id) : ''))
        })
        .catch(() => setNotice('Unable to load your assigned classes.'))
    }
  }, [staffMode])

  const audienceOptions = [
    ...(staffMode ? [{ value: 'school', label: 'Whole school' }] : []),
    ...(assignments.length > 0 ? [{ value: 'all_classes', label: 'All assigned classes' }] : []),
    ...assignments.map((item) => ({
      value: String(item.class.id),
      label: `${item.class.name} · ${item.subject.name}`,
    })),
  ]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!audience) return
    setSaving(true)
    setNotice('')
    try {
      const uniqueClassIds = Array.from(new Set(assignments.map((item) => item.class.id)))
      const targetAudiences = audience === 'school'
        ? [{ type: 'school' as const }]
        : audience === 'all_classes'
          ? uniqueClassIds.map((id) => ({ type: 'class' as const, class_id: id }))
          : [{ type: 'class' as const, class_id: Number(audience) }]

      await portalApi.createCommunityPost(
        message,
        comments,
        targetAudiences,
        files
      )
      setMessage('')
      setFiles([])
      window.dispatchEvent(new CustomEvent('app-refresh'))
      onPublished()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to publish this post.')
    } finally {
      setSaving(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  return (
    <div className="record-page">
      <Title eyebrow="Community" title="Share a school moment" copy="Choose an authorized audience before publishing." />
      <form className="post-composer" onSubmit={submit}>
        <div className="composer-field">
          <span className="field-label">Audience</span>
          <AudienceSelect
            value={audience}
            onChange={setAudience}
            options={audienceOptions}
          />
        </div>

        <div className="composer-field">
          <span className="field-label">Post</span>
          <textarea
            className="custom-textarea"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What happened in class today?"
            rows={5}
            maxLength={5000}
            required
          />
        </div>

        <div className="composer-field">
          <span className="field-label">Photos, short video, or PDF</span>
          <label className="file-upload-dropzone">
            <Upload size={20} />
            <div>
              <strong>Choose files</strong>
              <small>Images, MP4 video, or PDF document</small>
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
              className="sr-only"
              onChange={(event) => setFiles((prev) => [...prev, ...Array.from(event.target.files ?? [])].slice(0, 6))}
            />
          </label>

          {files.length > 0 && (
            <div className="file-pills-list">
              {files.map((file, index) => (
                <span className="file-pill" key={`${file.name}-${index}`}>
                  <span className="file-name">{file.name}</span>
                  <button type="button" className="file-remove-btn" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="comment-toggle">
          <span>
            <strong>Allow comments</strong>
            <small>Families and students in this audience may respond.</small>
          </span>
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={comments}
            onChange={(event) => setComments(event.target.checked)}
          />
        </label>

        {notice && <p className="composer-notice">{notice}</p>}

        <button className="publish-btn" type="submit" disabled={saving || !audience}>
          <Send size={18} /> {saving ? 'Publishing…' : 'Publish post'}
        </button>
      </form>
    </div>
  )
}

function AssessmentPage({ staffMode = false, onBack }: { staffMode?: boolean; onBack?: () => void }) {
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

  const closeAssessment = () => onBack?.()
  const { isExiting, requestBack: handleClose, surfaceStyle, gestureHandlers } = useSwipeBack(closeAssessment)

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId)
  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId)

  const reload = () => Promise.all([staffMode ? portalApi.getStaffAssignments() : portalApi.getTeacherAssignments(), portalApi.getAssessments()]).then(([assignmentResponse, assessmentResponse]) => {
    setAssignments(assignmentResponse.data); setAssessments(assessmentResponse.data)
    setSelectedAssignmentId((current) => current || assignmentResponse.data[0]?.id || 0)
    setSelectedAssessmentId((current) => current || assessmentResponse.data[0]?.id || 0)
  }).catch(() => setNotice('Unable to load assessment records.'))
  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (!selectedAssignment) return
    (staffMode ? portalApi.getStaffStudents(selectedAssignment) : portalApi.getTeacherStudents(selectedAssignment)).then(({ data }) => setStudents(data)).catch(() => setStudents([]))
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
    try { const { data } = await portalApi.publishAssessment(selectedAssessment.id); setAssessments((items) => items.map((item) => item.id === data.id ? data : item)); setNotice('Assessment results published to parents and students.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish results.') } finally { setSaving(false) }
  }

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label="Assessments Subpage"
      {...gestureHandlers}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        ...surfaceStyle,
      }}
    >
      <div className="subpage-container">
        <header className="subpage-header">
          <button
            type="button"
            className="subpage-back-btn"
            onClick={handleClose}
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">Assessments</h1>
          <div style={{ width: '38px', flexShrink: 0 }} />
        </header>

        {notice && <p className="composer-notice">{notice}</p>}

        <form className="assessment-editor" onSubmit={create}>
          <h3>Create assessment draft</h3>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span>Class</span>
            <CustomSelect
              value={selectedAssignmentId}
              onChange={(val) => setSelectedAssignmentId(Number(val))}
              options={assignments.map((item) => ({ value: item.id, label: `${item.class.name} · ${item.subject.name}` }))}
            />
          </label>
          <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Unit 2 Quiz" required /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span>Type</span>
            <CustomSelect
              value={type}
              onChange={(val) => setType(String(val))}
              options={[
                { value: 'test', label: 'Test' },
                { value: 'assignment', label: 'Assignment' },
                { value: 'exam', label: 'Exam' },
              ]}
            />
          </label>
          <label><span>Max score</span><input type="number" min={1} max={1000} value={maxScore} onChange={(event) => setMaxScore(Number(event.target.value))} required /></label>
          <button type="submit" className="primary-action" disabled={saving || !selectedAssignmentId}>Create draft</button>
        </form>

        {assessments.length > 0 && (
          <section className="assessment-editor">
            <h3>Score & publish</h3>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span>Assessment</span>
              <CustomSelect
                value={selectedAssessmentId}
                onChange={(val) => setSelectedAssessmentId(Number(val))}
                options={assessments.map((item) => ({ value: item.id, label: `${item.title} (${item.subject.code})` }))}
              />
            </label>
            {selectedAssessment && (
              <>
                <p>{selectedAssessment.classes.map((c) => c.name).join(', ')} · Max {selectedAssessment.max_score} points · Status: {selectedAssessment.status}</p>
                {students.map((student) => <label key={student.id}><span>{student.full_name}</span><input type="number" min={0} max={selectedAssessment.max_score} value={scores[student.id] ?? ''} onChange={(event) => setScores((prev) => ({ ...prev, [student.id]: event.target.value }))} placeholder="Score" /></label>)}
                <button type="button" className="secondary-action" disabled={saving} onClick={() => void save()}>Save scores draft</button>
                <button type="button" className="primary-action" disabled={saving || selectedAssessment.status === 'published'} onClick={() => void publish()}>{selectedAssessment.status === 'published' ? 'Published' : 'Publish to families'}</button>
              </>
            )}
          </section>
        )}
      </div>
    </div>,
    document.body
  )
}

function QuizAuthoringPage({ staffMode, onBack }: { staffMode: boolean; onBack?: () => void }) {
  const [title, setTitle] = useState('')
  const [notice, setNotice] = useState('')

  const closeQuizAuthoring = () => onBack?.()
  const { isExiting, requestBack: handleClose, surfaceStyle, gestureHandlers } = useSwipeBack(closeQuizAuthoring)

  const create = (event: React.FormEvent) => { event.preventDefault(); setNotice(`Formal Quiz "${title}" authoring draft created.`) }

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label="Formal Quiz Subpage"
      {...gestureHandlers}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        ...surfaceStyle,
      }}
    >
      <div className="subpage-container">
        <header className="subpage-header">
          <button
            type="button"
            className="subpage-back-btn"
            onClick={handleClose}
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">Formal Quiz</h1>
          <div style={{ width: '38px', flexShrink: 0 }} />
        </header>

        {notice && <p className="composer-notice">{notice}</p>}

        <form className="assessment-editor" onSubmit={create}>
          <h3>New quiz assignment</h3>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--app-muted)' }}>
            {staffMode ? 'School-wide quiz assignments' : 'Class quiz assignments'}
          </p>
          <label>
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Science Chapter 4 Check" required />
          </label>
          <button type="submit" className="primary-action">Create quiz</button>
        </form>
      </div>
    </div>,
    document.body
  )
}

function AttendancePage() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(0)
  const [attendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState<Array<{ id: number; name: string; status: AttendanceStatus }>>([])
  const [hasSubmittedSession, setHasSubmittedSession] = useState(false)
  const [correctionReason, setCorrectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId)

  useEffect(() => {
    portalApi.getTeacherAssignments().then(({ data }) => {
      setAssignments(data)
      if (data[0]) setSelectedAssignmentId(data[0].id)
    }).catch(() => setError('Unable to load assigned classes.')).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedAssignmentId) return
    setLoading(true)
    setError('')
    setNotice('')
    Promise.all([
      portalApi.getTeacherStudents(selectedAssignment!),
      portalApi.getDailyAttendance(selectedAssignment!, attendanceDate),
    ]).then(([rosterResponse, attendanceResponse]) => {
      const saved = new Map(attendanceResponse.data?.records.map((record) => [record.student_id, record.status]))
      setStudents(rosterResponse.data.map((student) => ({ id: student.id, name: student.full_name, status: saved.get(student.id) ?? 'unmarked' })))
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

  return <div className="record-page"><Title eyebrow="Attendance" title="Daily class check-in" copy={`${attendanceDate} · ${selectedAssignment?.class.name ?? 'Select an assigned class'} · ${students.length} enrolled students`} />{assignments.length > 1 && <div className="child-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-muted)' }}>Class:</span><CustomSelect value={selectedAssignmentId} onChange={(val) => setSelectedAssignmentId(Number(val))} options={assignments.map((assignment) => ({ value: assignment.id, label: `${assignment.class.name} · ${assignment.subject.name}` }))} size="compact" /></div>}{loading ? <div className="app-skeleton large" /> : error && students.length === 0 ? <div className="app-empty"><School /><h2>Attendance unavailable</h2><p>{error}</p></div> : assignments.length === 0 ? <div className="app-empty"><School /><h2>No assigned classes</h2><p>Only current teaching assignments can submit attendance.</p></div> : <><div className="attendance-summary">{students.filter((item) => item.status === 'unmarked').length > 0 && <span><strong>{students.filter((item) => item.status === 'unmarked').length}</strong><small>Unmarked</small></span>}<span><strong>{students.filter((item) => item.status === 'present').length}</strong><small>Present</small></span><span><strong>{students.filter((item) => item.status === 'late').length}</strong><small>Late</small></span><span><strong>{students.filter((item) => item.status === 'absent').length}</strong><small>Absent</small></span><span><strong>{students.filter((item) => item.status === 'excused').length}</strong><small>Excused</small></span></div><div className="attendance-roster">{students.map((student) => <div className="attendance-student" key={student.id}><span className="student-avatar small">{student.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{student.name}</strong><div className="attendance-statuses">{(['unmarked', 'present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((status) => <button key={status} type="button" className={student.status === status ? `selected ${status}` : ''} onClick={() => update(student.id, status)} aria-label={`${student.name}: ${status}`}>{student.status === status ? <Check /> : <Circle />}</button>)}</div></div>)}</div><div className="attendance-legend"><span>Unmarked</span><span>Present</span><span>Late</span><span>Absent</span><span>Excused</span></div>{hasSubmittedSession && <label className="correction-reason"><span>Reason for any correction</span><textarea rows={2} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Required only when changing a submitted record" /></label>}{error && <p className="form-error">{error}</p>}{notice && <p className="composer-notice">{notice}</p>}<button type="button" className="primary-action" disabled={saving || students.length === 0} onClick={submit}><Check /> {saving ? 'Saving…' : hasSubmittedSession ? 'Update attendance' : 'Submit attendance'}</button></>}</div>
}

function TeacherMore({ teacherName, staffMode, onAssessments, onQuizzes, onLogout }: { teacherName: string; staffMode: boolean; onAssessments: () => void; onQuizzes: () => void; onSafety?: () => void; onLogout: () => void }) { return <div className="record-page"><Title eyebrow="Account" title={staffMode ? 'Staff tools' : 'Teacher tools'} copy="Mobile access follows your current role and assignments." /><section className="profile-card"><span className="profile-avatar">{teacherName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><h2>{teacherName}</h2><p>{staffMode ? 'Authorized Staff' : 'Teacher'}</p></section><section className="settings-list"><div><School /><span><small>Publishing</small><strong>{staffMode ? 'School and assigned audiences' : 'Assigned classes only'}</strong></span></div><button type="button" onClick={onQuizzes}><span><small>Formal Quiz</small><strong>{staffMode ? 'Create school-authorized assignments' : 'Create and publish class quizzes'}</strong></span><ChevronRight/></button><button type="button" onClick={onAssessments}><span><small>Assessment results</small><strong>{staffMode ? 'Manage same-school marks' : 'Draft and publish marks'}</strong></span><ChevronRight /></button><CommunitySafetyLinks /><div><MessageCircle/><span><small>Notifications</small><strong>Open the bell in the header</strong></span></div></section><button type="button" className="logout-action" aria-label="Sign out" onClick={onLogout}><LogOut /><span><strong>Sign out</strong><small>End this session on this device</small></span></button></div> }
