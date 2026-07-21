# Class Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Classes directory where staff can view Active student counts, open an Active class roster, enter the existing Student Detail workspace, and return to the originating roster.

**Architecture:** A focused `ClassesPage` component will own class/student loading, grouping, counts, roster selection, and retry states using the existing `/classes` and `/students?status=active` APIs. `App` will own only cross-page navigation state so the existing `StudentsPage` can return to the class that launched Student Detail; no backend, database, router, or permission changes are needed.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, existing Laravel 13 JSON APIs, existing CSS design system.

## Global Constraints

- Add one `Classes` item under `People`, between `Students` and `Parents`; do not add 13 sidebar links.
- Classes is read-only and must not expose create, edit, delete, deactivate, or student-reassignment controls.
- Show only students with status `active` whose `class.id` matches the selected class.
- Use the existing `students.view` permission; introduce no permission slug.
- Use only `GET /api/classes` and `GET /api/students?status=active`; add no backend endpoint or database change.
- Student Detail must remain the existing implementation, and its return action must restore the originating class roster.
- A deliberate sidebar selection clears the class-return context.
- Desktop, tablet, and mobile layouts must not create viewport-level horizontal overflow.
- Loading, retryable failure, empty catalog, zero-student roster, and `401` session handling must be explicit.

---

## File Structure

- Create `frontend/src/components/ClassesPage.tsx`: class catalog types, API loading, permission gate, level grouping, Active counts, directory cards, selected roster, retry, and callbacks into application navigation.
- Create `frontend/src/components/ClassesPage.test.tsx`: focused component tests for data requests, grouping, Active filtering, empty/error/retry states, permission behavior, and unauthorized-session behavior.
- Modify `frontend/src/App.tsx`: add the Classes navigation key/item, render `ClassesPage`, preserve a selected-class return context, and let `StudentsPage` accept an optional external detail-return action.
- Modify `frontend/src/App.test.tsx`: test sidebar order and the Classes → roster → Student Detail → same roster integration.
- Modify `frontend/src/App.css`: add responsive class-directory cards and reuse the existing responsive student table pattern for rosters.

### Task 1: Build the Read-Only Classes Page

**Files:**
- Create: `frontend/src/components/ClassesPage.tsx`
- Create: `frontend/src/components/ClassesPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest<T>(path: string)` and `ApiError` from `frontend/src/api.ts`; `PageHeader`, `DataPanel`, and `StatusBadge` from `frontend/src/components/AdminUi.tsx`.
- Produces: `SchoolClassOption` and `ClassesPage({ permissions, initialClassId, onOpenStudent, onUnauthorized })`.
- Callback signature: `onOpenStudent(studentId: number, schoolClass: SchoolClassOption): void`.

- [ ] **Step 1: Write component tests for the permission gate, grouped directory, counts, and roster**

Create `frontend/src/components/ClassesPage.test.tsx` with fixtures for all four level groups, one Active MA1 student, one inactive MA1 student returned defensively by the mock, and this test structure:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassesPage } from './ClassesPage'

const classes = [
  { id: 1, name: 'Kindergarten', level_group: 'kindergarten' },
  { id: 2, name: 'MA1', level_group: 'primary' },
  { id: 3, name: 'MB1', level_group: 'primary' },
  { id: 4, name: 'MC1', level_group: 'primary' },
  { id: 5, name: 'MD1', level_group: 'primary' },
  { id: 6, name: 'ME1', level_group: 'primary' },
  { id: 7, name: 'MF1', level_group: 'primary' },
  { id: 8, name: 'MP1', level_group: 'secondary' },
  { id: 9, name: 'MQ1', level_group: 'secondary' },
  { id: 10, name: 'MR1', level_group: 'secondary' },
  { id: 11, name: 'MS1', level_group: 'secondary' },
  { id: 12, name: 'MT1', level_group: 'secondary' },
  { id: 13, name: 'STP', level_group: 'stp' },
]

const students = [
  { id: 21, student_no: 'MIS-021', full_name: 'Amina Lee', level_group: 'primary', class: { id: 2, name: 'MA1' }, status: 'active' },
  { id: 22, student_no: 'MIS-022', full_name: 'Inactive Child', level_group: 'primary', class: { id: 2, name: 'MA1' }, status: 'inactive' },
]

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function installSuccessApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/classes')) return json({ data: classes })
    if (url.pathname.endsWith('/students')) return json({ data: students })
    return json({ message: 'Not found' }, 404)
  })
}

afterEach(() => vi.restoreAllMocks())

describe('ClassesPage', () => {
  it('does not request data without students.view', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ClassesPage permissions={[]} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('permission')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('groups classes and counts only Active students', async () => {
    installSuccessApi()
    render(<ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Kindergarten' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Secondary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'STP' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(13)
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Kindergarten',
      'Primary',
      'Secondary',
      'STP',
    ])
    expect(within(screen.getByTestId('class-card-2')).getByText('1 Active student')).toBeInTheDocument()
    expect(within(screen.getByTestId('class-card-8')).getByText('0 Active students')).toBeInTheDocument()
    const studentRequest = vi.mocked(globalThis.fetch).mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/students'))
    expect(new URL(String(studentRequest?.[0])).searchParams.get('status')).toBe('active')
  })

  it('opens an Active roster and forwards the selected class with the student', async () => {
    const user = userEvent.setup()
    const onOpenStudent = vi.fn()
    installSuccessApi()
    render(<ClassesPage permissions={['students.view']} onOpenStudent={onOpenStudent} onUnauthorized={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'View MA1' }))
    expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()
    expect(screen.getByText('Amina Lee')).toBeInTheDocument()
    expect(screen.queryByText('Inactive Child')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View Amina Lee' }))
    expect(onOpenStudent).toHaveBeenCalledWith(21, classes[1])
  })

  it('restores initialClassId and shows a zero-student message', async () => {
    installSuccessApi()
    render(<ClassesPage permissions={['students.view']} initialClassId={8} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'MP1' })).toBeInTheDocument()
    expect(screen.getByText('No active students in this class.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused tests and verify the component is missing**

Run: `npm test -- --run src/components/ClassesPage.test.tsx`

Working directory: `frontend`

Expected: FAIL because `./ClassesPage` cannot be resolved.

- [ ] **Step 3: Implement the minimal Classes page**

Create `frontend/src/components/ClassesPage.tsx` with these exact public types and behaviors:

```tsx
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
  class: { id: number; name: string } | null
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

export function ClassesPage({ permissions, initialClassId = null, onOpenStudent, onUnauthorized }: ClassesPageProps) {
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
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load classes. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (canView) void loadDirectory()
  }, [canView])

  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null
  const selectedLevelGroup = levelGroups.find((group) => group.key === selectedClass?.level_group)?.label ?? ''
  const roster = useMemo(
    () => students.filter((student) => student.class?.id === selectedClassId),
    [selectedClassId, students],
  )

  if (!canView) {
    return <div className="message-card error" role="alert">You do not have permission to view classes.</div>
  }

  return (
    <section className="page-stack classes-page">
      <PageHeader eyebrow="People" title="Classes" description="Browse each class and its Active student roster." />
      {error && (
        <div className="message-card error" role="alert">
          <span>{error}</span>
          <button className="secondary-action compact" onClick={() => void loadDirectory()}><RefreshCw size={16} />Retry</button>
        </div>
      )}
      {selectedClass ? (
        <DataPanel
          eyebrow={selectedLevelGroup}
          title={selectedClass.name}
          action={<button className="secondary-action compact" onClick={() => setSelectedClassId(null)}><ArrowLeft size={16} />Back to Classes</button>}
        >
          <div className="table-wrap">
            <table className="student-list-table class-roster-table">
              <thead><tr><th>Student ID</th><th>Student Name</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Student ID">{student.student_no}</td>
                    <td className="student-primary-cell" data-label="Student Name">{student.full_name}</td>
                    <td data-label="Status"><StatusBadge tone="positive">Active</StatusBadge></td>
                    <td className="student-open-cell" data-label="Action">
                      <button className="table-action" aria-label={`View ${student.full_name}`} onClick={() => onOpenStudent(student.id, selectedClass)}><Eye size={15} />View Student</button>
                    </td>
                  </tr>
                ))}
                {!isLoading && roster.length === 0 && <tr className="table-state-row"><td colSpan={4}>No active students in this class.</td></tr>}
              </tbody>
            </table>
          </div>
        </DataPanel>
      ) : (
        <DataPanel eyebrow="Directory" title="Class Directory">
          {isLoading && <div className="empty-state" role="status">Loading classes...</div>}
          {!isLoading && !error && classes.length === 0 && <div className="empty-state">No classes are configured.</div>}
          {!isLoading && classes.length > 0 && (
            <div className="class-directory-groups">
              {levelGroups.map((group) => {
                const groupClasses = classes.filter((schoolClass) => schoolClass.level_group === group.key)
                if (groupClasses.length === 0) return null
                return (
                  <section className="class-group" key={group.key}>
                    <h3>{group.label}</h3>
                    <div className="class-card-grid">
                      {groupClasses.map((schoolClass) => {
                        const count = students.filter((student) => student.class?.id === schoolClass.id).length
                        return (
                          <article className="class-card" data-testid={`class-card-${schoolClass.id}`} key={schoolClass.id}>
                            <Users size={20} aria-hidden="true" />
                            <div><h4>{schoolClass.name}</h4><p>{group.label}</p></div>
                            <strong>{count} Active student{count === 1 ? '' : 's'}</strong>
                            <button className="table-action" aria-label={`View ${schoolClass.name}`} onClick={() => setSelectedClassId(schoolClass.id)}>View Class</button>
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
```

- [ ] **Step 4: Add explicit error, retry, empty-catalog, and unauthorized tests**

Append tests that mock `/classes` with `500`, click `Retry`, then return success; mock both endpoints with empty arrays and assert `No classes are configured.`; and mock `/classes` with `401` and assert `onUnauthorized` is called once. Use deferred mock state rather than timers so each result is deterministic.

```tsx
it('retries a failed directory request', async () => {
  const user = userEvent.setup()
  let shouldFail = true
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input))
    if (shouldFail && url.pathname.endsWith('/classes')) return json({ message: 'Service unavailable' }, 500)
    if (url.pathname.endsWith('/classes')) return json({ data: classes })
    if (url.pathname.endsWith('/students')) return json({ data: students })
    return json({}, 404)
  })
  render(<ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('The service is temporarily unavailable. Please try again.')
  shouldFail = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'Primary' })).toBeInTheDocument()
})

it('shows an empty class catalog', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
  render(<ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={vi.fn()} />)
  expect(await screen.findByText('No classes are configured.')).toBeInTheDocument()
})

it('hands a 401 to the application session handler', async () => {
  const onUnauthorized = vi.fn()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthenticated.' }), { status: 401 }))
  render(<ClassesPage permissions={['students.view']} onOpenStudent={vi.fn()} onUnauthorized={onUnauthorized} />)
  await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
})
```

- [ ] **Step 5: Run the focused test file**

Run: `npm test -- --run src/components/ClassesPage.test.tsx`

Working directory: `frontend`

Expected: PASS with all `ClassesPage` tests green.

- [ ] **Step 6: Commit the independently working page**

```bash
git add frontend/src/components/ClassesPage.tsx frontend/src/components/ClassesPage.test.tsx
git commit -m "feat: add class directory page"
```

### Task 2: Integrate Sidebar and Student Detail Return Navigation

**Files:**
- Modify: `frontend/src/App.tsx:3-45, 133-137, 468-502, 1033-1041, 2528-2548, 4645-4781`
- Modify: `frontend/src/App.test.tsx:50-80, 268-289, 347-358`

**Interfaces:**
- Consumes: `ClassesPage` and `SchoolClassOption` from Task 1.
- Produces: optional `detailReturn: { label: string; onReturn: () => void }` prop on `StudentsPage`; application-owned `classReturnContext: SchoolClassOption | null`.
- Navigation callbacks: `openClassStudentDetail(studentId, schoolClass)`, `returnToClass()`, and `handleSelectPage(page)`.

- [ ] **Step 1: Write failing application integration tests**

Update the sidebar expectation in `frontend/src/App.test.tsx` so `Classes` appears between `Students` and `Parents`. Change the main student fixture class to `{ id: 2, name: 'MA1' }`, then add this integration test:

```tsx
it('returns Student Detail to the originating class roster', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Classes' }))
  await user.click(await screen.findByRole('button', { name: 'View MA1' }))
  expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()
  expect(screen.getByText('Alyssa Tan')).toBeInTheDocument()

  const fetchMock = vi.mocked(globalThis.fetch)
  const studentListRequestsBefore = fetchMock.mock.calls.filter(([input]) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/students') && url.searchParams.has('status')
  }).length
  await user.click(screen.getByRole('button', { name: 'View Alyssa Tan' }))
  await screen.findByRole('heading', { name: /Alyssa Tan/ })
  expect(screen.getByRole('button', { name: 'Back to MA1' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.filter(([input]) => {
    const url = new URL(String(input))
    return url.pathname.endsWith('/students') && url.searchParams.has('status')
  })).toHaveLength(studentListRequestsBefore)
  await user.click(screen.getByRole('button', { name: 'Back to MA1' }))
  expect(await screen.findByRole('heading', { name: 'MA1' })).toBeInTheDocument()
  expect(screen.getByText('Alyssa Tan')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Classes' })).toHaveClass('active')
})
```

Add this second test to verify deliberate sidebar navigation clears the return context:

```tsx
it('clears the selected class after deliberate sidebar navigation', async () => {
  const user = userEvent.setup()
  await renderAuthenticatedApp()

  await user.click(screen.getByRole('button', { name: 'Classes' }))
  await user.click(await screen.findByRole('button', { name: 'View MA1' }))
  expect(screen.getByRole('heading', { name: 'MA1' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Parents' }))
  await screen.findByRole('heading', { name: 'Parent Directory' })
  await user.click(screen.getByRole('button', { name: 'Classes' }))

  expect(await screen.findByRole('heading', { name: 'Class Directory' })).toBeInTheDocument()
  expect(screen.queryByText('No active students in this class.')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the App test and verify navigation is absent**

Run: `npm test -- --run src/App.test.tsx`

Working directory: `frontend`

Expected: FAIL because the Classes navigation button and page do not exist.

- [ ] **Step 3: Add the Classes page key, icon, item, and render branch**

In `frontend/src/App.tsx`, import `School` from `lucide-react`, import `ClassesPage`, import its `SchoolClassOption` type, add `'classes'` to `PageKey`, remove the local duplicate `SchoolClassOption` type, and change the People group to:

```tsx
items: [
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'classes', label: 'Classes', icon: School },
  { key: 'parents', label: 'Parents', icon: Users },
],
```

Add this page branch before the Parents branch:

```tsx
if (activePage === 'classes') {
  return (
    <ClassesPage
      permissions={user.permissions}
      initialClassId={classReturnContext?.id}
      onOpenStudent={openClassStudentDetail}
      onUnauthorized={handleUnauthorized}
    />
  )
}
```

- [ ] **Step 4: Add application-owned return context**

Add state and handlers beside the existing `focusedStudentId` state and `openStudentDetail` handler:

```tsx
const [classReturnContext, setClassReturnContext] = useState<SchoolClassOption | null>(null)

const openStudentDetail = (studentId: number) => {
  setClassReturnContext(null)
  setFocusedStudentId(studentId)
  setActivePage('students')
}

const openClassStudentDetail = (studentId: number, schoolClass: SchoolClassOption) => {
  setClassReturnContext(schoolClass)
  setFocusedStudentId(studentId)
  setActivePage('students')
}

const returnToClass = () => {
  setFocusedStudentId(null)
  setActivePage('classes')
}

const handleSelectPage = (page: PageKey) => {
  setClassReturnContext(null)
  setFocusedStudentId(null)
  setActivePage(page)
}
```

Pass `handleSelectPage` to `AdminShell` instead of `setActivePage`. Clear both navigation states inside logout as well.

- [ ] **Step 5: Teach Student Detail to use an optional external return action**

Extend `StudentsPage` props with:

```tsx
detailReturn?: {
  label: string
  onReturn: () => void
}
```

Replace the existing Back to students button handler and label with:

```tsx
onClick={() => {
  if (detailReturn) {
    detailReturn.onReturn()
    return
  }
  setSelectedStudent(null)
  initialStudentIdRef.current = null
  startedWithFocusedStudentRef.current = false
  void loadStudentsRef.current(statusFilter)
}}
>
  {detailReturn?.label ?? 'Back to students'}
```

Render `StudentsPage` with the optional class return:

```tsx
return (
  <StudentsPage
    key={focusedStudentId ?? 'students'}
    user={user}
    onUnauthorized={handleUnauthorized}
    initialStudentId={focusedStudentId}
    detailReturn={classReturnContext ? { label: `Back to ${classReturnContext.name}`, onReturn: returnToClass } : undefined}
  />
)
```

Keep the sidebar active page as `students` while Student Detail is open. The `Back to MA1` action returns to Classes and then makes Classes active.

- [ ] **Step 6: Run application and component tests**

Run: `npm test -- --run src/App.test.tsx src/components/ClassesPage.test.tsx`

Working directory: `frontend`

Expected: PASS for both test files; existing Fee Record direct-to-student test must still show no `/students?` request before Student Detail loads.

- [ ] **Step 7: Commit navigation integration**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: connect classes to student details"
```

### Task 3: Add Responsive Presentation and Complete Verification

**Files:**
- Modify: `frontend/src/App.css:219-280, 1569-1770, 1864-1915`
- Test: `frontend/src/components/ClassesPage.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `.classes-page`, `.class-directory-groups`, `.class-group`, `.class-card-grid`, `.class-card`, and `.class-roster-table` markup from Task 1.
- Produces: responsive directory cards and a roster that follows the existing stacked student-row behavior at widths below `1024px`.

- [ ] **Step 1: Add exact desktop and responsive CSS**

Add these rules near the existing `.cards-grid` styles in `frontend/src/App.css`:

```css
.class-directory-groups {
  display: grid;
  gap: 24px;
  padding: 18px;
}

.class-group {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.class-group > h3 {
  margin: 0;
  color: #3a3d44;
  font-size: 15px;
}

.class-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}

.class-card {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 16px;
  border: 1px solid #e1e4ea;
  border-radius: 8px;
  background: #fff;
}

.class-card > svg {
  color: #d82730;
}

.class-card h4,
.class-card p {
  margin: 0;
}

.class-card h4 {
  font-size: 17px;
}

.class-card p {
  margin-top: 3px;
  color: #747985;
  font-size: 12px;
}

.class-card > strong,
.class-card > button {
  grid-column: 1 / -1;
}

.class-card > strong {
  color: #167a4a;
  font-size: 13px;
}

.class-card > button {
  justify-self: start;
}
```

Inside `@media screen and (max-width: 767px)`, add:

```css
.class-directory-groups {
  padding: 14px;
}

.class-card-grid {
  grid-template-columns: 1fr;
}
```

The roster already uses `student-list-table`, so it inherits the established stacked rows below `1024px` and full-width action below `480px`.

- [ ] **Step 2: Run formatting-independent static checks**

Run: `npm run lint`

Working directory: `frontend`

Expected: exit code 0 with no new oxlint diagnostics.

Run: `npm run build`

Working directory: `frontend`

Expected: TypeScript and Vite production build both exit 0.

- [ ] **Step 3: Run the complete automated suites**

Run: `npm test`

Working directory: `frontend`

Expected: every Vitest file passes.

Run: `composer test`

Working directory: `backend`

Expected: every Laravel/PHPUnit test passes; no backend files changed.

- [ ] **Step 4: Verify the feature in a real browser**

Start the existing frontend/backend development stack, log in with a user holding `students.view`, and verify at desktop width `1440px`, tablet width `768px`, and mobile width `390px`:

1. People navigation order is Students, Classes, Parents.
2. Classes displays Kindergarten, Primary, Secondary, and STP groups with accurate Active counts.
3. MA1 opens only its Active students.
4. View Student opens the existing Student Detail without first loading the full Students list.
5. Back to MA1 restores the MA1 roster.
6. Back to Classes restores the directory.
7. The mobile drawer closes after selecting Classes.
8. No viewport-level horizontal scrollbar appears; the roster action remains reachable.
9. The browser console has no new errors or warnings.

- [ ] **Step 5: Commit responsive styling**

```bash
git add frontend/src/App.css
git commit -m "style: add responsive class directory"
```

- [ ] **Step 6: Record final verification evidence**

Run:

```bash
git status --short
git log -3 --oneline
```

Expected: only the user's pre-existing unrelated untracked artifacts remain; the latest three commits correspond to the Classes page, navigation integration, and responsive styling.
