import React, { useEffect, useState, useCallback } from 'react'
import './ParentPortalView.css'
import { portalApi, type StudentMe, type StudentEnrolment } from '../api/portalApi'
import {
  IconlyGraduationCap,
  IconlyUsers,
  IconlyCheck,
} from './icons/IconlyIcons'

export interface StudentPortalViewProps {
  studentName: string
  activeTab: string
}

function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="portal-skeleton-wrap">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="portal-skeleton-row" style={{ width: i === 0 ? '80%' : '60%' }} />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="portal-error-state">
      <span>⚠️</span>
      <p>{message}</p>
      <button onClick={onRetry} className="portal-retry-btn">Retry</button>
    </div>
  )
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({ studentName, activeTab }) => {
  const [studentData, setStudentData] = useState<StudentMe['data'] | null>(null)
  const [enrolments, setEnrolments] = useState<StudentEnrolment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'>('Tue')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [meResp, enrolResp] = await Promise.all([
        portalApi.getStudentMe(),
        portalApi.getStudentEnrolments(),
      ])
      setStudentData(meResp.data)
      setEnrolments(enrolResp.data)
    } catch {
      setError('Unable to load student profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const displayName = studentData?.full_name ?? studentName

  if (activeTab === 'academics') {
    return (
      <div className="parent-portal-view">
        <h2 className="portal-section-title">My Subjects & Courses</h2>
        {loading && <LoadingSkeleton lines={4} />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && (
          <>
            {enrolments.map((enrolment) => (
              <div key={enrolment.id}>
                <div className="portal-balance-card" style={{ marginBottom: '12px' }}>
                  <div className="child-name" style={{ fontSize: '15px' }}>
                    {enrolment.academic_year?.name ?? enrolment.academic_year?.code ?? 'Academic Year'}
                  </div>
                  <div className="child-class">
                    Class: {enrolment.class?.name ?? '—'} • {enrolment.status}
                  </div>
                </div>
                {enrolment.subjects.length === 0 ? (
                  <div className="portal-empty-state">No subjects assigned to this class yet.</div>
                ) : (
                  <div className="child-cards-container">
                    {enrolment.subjects.map((sub, i) => (
                      <div key={i} className="child-card" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '42px', height: '42px', borderRadius: '12px',
                            background: 'var(--brand-primary-soft, #fff1f2)',
                            color: 'var(--brand-primary, #e11d48)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <IconlyGraduationCap size={22} color="var(--brand-primary, #e11d48)" />
                          </div>
                          <div>
                            <div className="child-name">{sub.subject_name ?? '—'}</div>
                            <div className="child-class">
                              {sub.subject_code ?? ''}{sub.teacher_name ? ` • Teacher: ${sub.teacher_name}` : ''}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontWeight: 800,
                          }}
                        >
                          Enrolled
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {enrolments.length === 0 && (
              <div className="portal-empty-state">No active enrolments found.</div>
            )}
          </>
        )}
      </div>
    )
  }

  if (activeTab === 'schedule') {
    const scheduleDays: Array<{ day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'; num: string }> = [
      { day: 'Mon', num: '18' },
      { day: 'Tue', num: '19' },
      { day: 'Wed', num: '20' },
      { day: 'Thu', num: '21' },
      { day: 'Fri', num: '22' },
    ]

    return (
      <div className="parent-portal-view">
        <h2 className="portal-section-title">My Schedule</h2>
        <div className="portal-demo-notice">
          Demo timetable preview. Schedule records are not yet provided by the backend.
        </div>

        {/* Interactive Day Selector Chips */}
        <div className="schedule-day-row">
          {scheduleDays.map((d) => (
            <div
              key={d.day}
              className={`schedule-day-chip ${selectedDay === d.day ? 'active' : ''}`}
              onClick={() => setSelectedDay(d.day)}
              style={{ cursor: 'pointer' }}
            >
              <span className="day-name">{d.day}</span>
              <span className="day-num">{d.num}</span>
            </div>
          ))}
        </div>

        {loading && <LoadingSkeleton lines={4} />}

        {!loading && (
          <div className="schedule-timeline">
            {/* Slot 1 */}
            <div className="schedule-card-row">
              <div className="schedule-time-col">
                <span className="time-start">08:30 AM</span>
                <span className="time-end">10:00 AM</span>
              </div>
              <div className="schedule-card">
                <div className="schedule-subject">{selectedDay === 'Mon' ? 'Mathematics' : selectedDay === 'Wed' ? 'Physics' : 'Social Studies'}</div>
                <div className="schedule-room">Building B3, Room 124</div>
                <div className="schedule-teacher">
                  <div className="teacher-avatar" style={{ background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center' }}>
                    <IconlyUsers size={14} color="#475569" />
                  </div>
                  <span>Mrs. Goodman</span>
                </div>
              </div>
            </div>

            {/* NOW Banner Divider */}
            {selectedDay === 'Tue' && (
              <div className="schedule-now-divider">
                <span>Now</span>
                <div className="now-line" />
              </div>
            )}

            {/* Slot 2 */}
            <div className="schedule-card-row">
              <div className="schedule-time-col">
                <span className="time-start" style={{ color: selectedDay === 'Tue' ? 'var(--brand-primary, #e11d48)' : 'inherit' }}>10:30 AM</span>
                <span className="time-end">12:00 PM</span>
              </div>
              <div className={`schedule-card ${selectedDay === 'Tue' ? 'schedule-card-now' : ''}`}>
                <div className="schedule-subject">{selectedDay === 'Tue' ? 'English Literature' : 'Chemistry Lab'}</div>
                <div className="schedule-room">Building B2, Room 158</div>
                <div className="schedule-teacher">
                  <div className="teacher-avatar" style={{ background: '#fff1f2', color: '#e11d48', display: 'grid', placeItems: 'center' }}>
                    <IconlyUsers size={14} color="#e11d48" />
                  </div>
                  <span>Mrs. Melton</span>
                </div>
              </div>
            </div>

            {/* Slot 3 */}
            <div className="schedule-card-row">
              <div className="schedule-time-col">
                <span className="time-start">12:15 PM</span>
                <span className="time-end">01:45 PM</span>
              </div>
              <div className="schedule-card">
                <div className="schedule-subject">Computer Science</div>
                <div className="schedule-room">Lab B3, Room 310</div>
                <div className="schedule-teacher">
                  <div className="teacher-avatar" style={{ background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center' }}>
                    <IconlyUsers size={14} color="#475569" />
                  </div>
                  <span>Mr. Hodge</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (activeTab === 'profile') {
    return (
      <div className="parent-portal-view">
        <div className="portal-welcome-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff',
            }}>
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="portal-welcome-title">{displayName}</div>
              <div className="portal-welcome-sub">Student Portal Account</div>
            </div>
          </div>
        </div>

        <div className="child-card" style={{ flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Student Enrolment Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconlyGraduationCap size={16} color="#64748b" /> Student No: {studentData?.student_no ?? 'MIS-2026-001'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconlyCheck size={16} color="#16a34a" /> Status: Enrolled & Active
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Home / Overview Tab
  return (
    <div className="parent-portal-view">
      <div className="portal-welcome-card">
        <div className="portal-welcome-title">Hello, {displayName}!</div>
        <div className="portal-welcome-sub">Matahari Student Mobile Portal</div>
      </div>

      <h2 className="portal-section-title">My Current Class & Enrolments</h2>
      {loading && <LoadingSkeleton lines={3} />}
      {!loading && (
        <div className="child-card" style={{ flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
              {enrolments[0]?.class?.name ?? 'Class MB1'}
            </div>
            <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              ACTIVE
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {enrolments[0]?.subjects.length ?? 3} Active Subjects Enrolled
          </div>
        </div>
      )}
    </div>
  )
}
