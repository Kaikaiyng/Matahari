import { ArrowLeft, Eye, RefreshCw, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest } from '../api'
import { DataPanel, PageHeader, StatusBadge } from './AdminUi'

export type LevelGroup = 'kindergarten' | 'primary' | 'secondary' | 'stp'

export type SchoolClassOption = {
  id: number
  name: string
  level_group: LevelGroup
}

type ClassStudent = {
  id: number
  student_no: string
  full_name: string
  level_group: LevelGroup
  class: {
    id: number
    name: string
  } | null
  status: 'active' | 'withdraw' | 'graduate' | 'inactive'
}

type ClassesPageProps = {
  permissions: string[]
  initialClassId?: number | null
  onOpenStudent: (studentId: number, schoolClass: SchoolClassOption) => void
  onUnauthorized: () => void
}

const levelGroups: Array<{ key: LevelGroup; label: string }> = [
  { key: 'kindergarten', label: 'Kindergarten' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'stp', label: 'STP' },
]

export function ClassesPage({
  permissions,
  initialClassId = null,
  onOpenStudent,
  onUnauthorized,
}: ClassesPageProps) {
  const canView = permissions.includes('students.view')
  const [classes, setClasses] = useState<SchoolClassOption[]>([])
  const [students, setStudents] = useState<ClassStudent[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(initialClassId)
  const [isLoading, setIsLoading] = useState(canView)
  const [error, setError] = useState('')

  const loadDirectory = async () => {
    setIsLoading(true)
    setError('')

    try {
      const [classResponse, studentResponse] = await Promise.all([
        apiRequest<{ data: SchoolClassOption[] }>('/classes'),
        apiRequest<{ data: ClassStudent[] }>('/students?status=active'),
      ])

      setClasses(classResponse.data)
      setStudents(studentResponse.data.filter((student) => student.status === 'active'))
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        onUnauthorized()
        return
      }

      setError(
        loadError instanceof ApiError
          ? loadError.message
          : 'Unable to load classes. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (canView) {
      void loadDirectory()
    }
  }, [canView])

  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null
  const selectedLevelGroup =
    levelGroups.find((group) => group.key === selectedClass?.level_group)?.label ?? ''
  const roster = useMemo(
    () => students.filter((student) => student.class?.id === selectedClassId),
    [selectedClassId, students],
  )

  if (!canView) {
    return (
      <div className="message-card error" role="alert">
        You do not have permission to view classes.
      </div>
    )
  }

  return (
    <section className="page-stack classes-page">
      <PageHeader
        eyebrow="People"
        title="Classes"
        description="Browse each class and its Active student roster."
      />

      {error && (
        <div className="message-card error" role="alert">
          <span>{error}</span>
          <button className="secondary-action compact" onClick={() => void loadDirectory()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {selectedClass ? (
        <DataPanel
          eyebrow={selectedLevelGroup}
          title={selectedClass.name}
          action={
            <button className="secondary-action compact" onClick={() => setSelectedClassId(null)}>
              <ArrowLeft size={16} />
              Back to Classes
            </button>
          }
        >
          <div className="table-wrap">
            <table className="student-list-table class-roster-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Student ID">{student.student_no}</td>
                    <td className="student-primary-cell" data-label="Student Name">
                      {student.full_name}
                    </td>
                    <td data-label="Status">
                      <StatusBadge tone="positive">Active</StatusBadge>
                    </td>
                    <td className="student-open-cell" data-label="Action">
                      <button
                        className="table-action"
                        aria-label={`View ${student.full_name}`}
                        onClick={() => onOpenStudent(student.id, selectedClass)}
                      >
                        <Eye size={15} />
                        View Student
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && roster.length === 0 && (
                  <tr className="table-state-row">
                    <td colSpan={4}>No active students in this class.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DataPanel>
      ) : (
        <DataPanel eyebrow="Directory" title="Class Directory">
          {isLoading && (
            <div className="empty-state" role="status">
              Loading classes...
            </div>
          )}
          {!isLoading && !error && classes.length === 0 && (
            <div className="empty-state">No classes are configured.</div>
          )}
          {!isLoading && classes.length > 0 && (
            <div className="class-directory-groups">
              {levelGroups.map((group) => {
                const groupClasses = classes.filter(
                  (schoolClass) => schoolClass.level_group === group.key,
                )

                if (groupClasses.length === 0) {
                  return null
                }

                return (
                  <section className="class-group" key={group.key}>
                    <h3>{group.label}</h3>
                    <div className="class-card-grid">
                      {groupClasses.map((schoolClass) => {
                        const count = students.filter(
                          (student) => student.class?.id === schoolClass.id,
                        ).length

                        return (
                          <article
                            className="class-card"
                            data-testid={`class-card-${schoolClass.id}`}
                            key={schoolClass.id}
                          >
                            <Users size={20} aria-hidden="true" />
                            <div>
                              <h4>{schoolClass.name}</h4>
                              <p>{group.label}</p>
                            </div>
                            <strong>
                              {count} Active student{count === 1 ? '' : 's'}
                            </strong>
                            <button
                              className="table-action"
                              aria-label={`View ${schoolClass.name}`}
                              onClick={() => setSelectedClassId(schoolClass.id)}
                            >
                              View Class
                            </button>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </DataPanel>
      )}
    </section>
  )
}
