# Class Directory Design

**Date:** 2026-07-21
**Status:** Approved for implementation

## Purpose

Add a read-only Classes area that lets staff browse the school's class structure, open an Active student roster for a class, and move from that roster into the existing Student Detail workflow without losing the class they came from.

## Scope

- Add `Classes` to the `People` sidebar group between `Students` and `Parents`.
- Add a Classes directory page grouped by Kindergarten, Primary, Secondary, and STP.
- Show each configured class with its level group and Active student count.
- Open a class roster that contains only Active students assigned to that class.
- Open the existing Student Detail workflow from a class roster.
- Return from Student Detail to the same class roster.

Classes remain read-only. Student-to-class assignment continues to happen through Add Student and the existing student data workflow.

## Navigation

The `People` sidebar order becomes:

1. Students
2. Classes
3. Parents

The sidebar contains one `Classes` item. It does not expand into 13 individual class links, which keeps the desktop sidebar compact and the mobile navigation drawer usable.

Selecting `Classes` opens the class directory. Selecting a class replaces the directory with that class's roster. The roster includes a `Back to Classes` action.

Selecting `View Student` opens the existing Student Detail workflow. The application records the source class before navigating. Student Detail then shows `Back to <class name>`, such as `Back to MA1`. Selecting it restores the Classes page with the same roster open and the Classes sidebar item active.

## Classes Directory

The directory groups classes in the order defined by the existing school class catalog:

- Kindergarten: Kindergarten
- Primary: MA1, MB1, MC1, MD1, ME1, MF1
- Secondary: MP1, MQ1, MR1, MS1, MT1
- STP: STP

Each class is presented as a card containing:

- Class name
- Level group
- Active student count
- `View Class` action

The desktop layout uses a responsive card grid. Tablet and mobile layouts reduce columns until cards appear in a single column without viewport-level horizontal overflow.

## Class Roster

The roster heading contains the class name and level group. Its table contains:

- Student ID
- Student name
- Status
- `View Student` action

Only students whose status is `active` and whose `class.id` matches the selected class are shown. The page does not expose an additional status filter because the agreed purpose is an Active class roster.

If a class has no Active students, the roster displays `No active students in this class.` rather than an empty table.

## Data Flow

The Classes page loads these existing endpoints in parallel:

- `GET /api/classes`
- `GET /api/students?status=active`

No new backend endpoint or database change is required. The frontend groups the returned Active students by `class.id`, calculates card counts, and filters the selected roster from the same data set.

Student Detail continues to use the current student detail, fee agreement, fee record, payment, and receipt requests. The Classes page does not duplicate any Student Detail business logic.

The application owns a small navigation context containing the selected class ID and the student-detail return target. It clears that context when the user deliberately selects another sidebar destination.

## Permissions

Classes uses the existing `students.view` permission. An authenticated user without this permission cannot load class rosters. No new permission slug is introduced.

The page does not include controls for creating, renaming, deactivating, or deleting classes. It also does not reassign a student to another class.

## Loading, Error, and Empty States

- While classes and Active students are loading, the directory shows a clear loading state.
- If either request fails, the page shows an accessible error message and a `Retry` action.
- A successful response with no configured classes shows a class-directory empty state.
- A configured class with no Active students remains visible with a count of zero and an empty-roster message.
- A `401` response continues to use the application's existing unauthorized-session handling.

## Component Boundaries

- `ClassesPage` owns class-directory loading, grouping, selected-class state, and roster presentation.
- Existing shared `PageHeader`, `DataPanel`, status badge, table, and action styles are reused.
- `App` owns the active page and the return context needed to move from a roster into Student Detail and back.
- `StudentsPage` keeps the existing Student Detail implementation and receives an optional class-return callback and label. It does not fetch the full Students list when opened directly from a class roster.

This targeted integration avoids extracting or rewriting the large existing Student Detail workflow.

## Testing

Automated frontend tests cover:

- `Classes` appears in the People navigation group in the agreed order.
- The 13 configured classes render under the correct level groups.
- Class counts include only Active students.
- A class roster contains only matching Active students.
- A zero-count class shows the empty-roster message.
- `View Student` opens the existing Student Detail workflow.
- `Back to MA1` returns to the original MA1 roster and restores Classes as the active sidebar item.
- Loading, retryable API failure, and unauthorized handling remain correct.

Browser verification covers desktop, tablet, and mobile layouts; mobile navigation; class-card responsiveness; roster readability; Student Detail navigation; and browser console health.

The complete frontend test suite, lint, production build, and backend test suite must pass before completion.

## Non-Goals

- Class creation, editing, deletion, or deactivation
- Student class reassignment from the Classes page
- Expanding every class directly in the sidebar
- Adding a duplicate Class filter to the Students page
- Adding new backend endpoints, tables, permissions, or routing libraries
- Refactoring unrelated Student Detail business logic

## Acceptance Criteria

- Staff with `students.view` can open Classes from the sidebar.
- All configured classes appear in the correct catalog grouping with accurate Active student counts.
- Selecting a class shows only that class's Active students.
- Selecting a student opens the existing Student Detail workflow.
- The detail return action restores the originating class roster.
- Empty, loading, error, unauthorized, desktop, tablet, and mobile states behave as specified.
- No class-management or student-reassignment controls are introduced.
- Automated and browser verification pass without new console errors or warnings.
