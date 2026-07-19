# Shared School Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a school-scoped shared Calendar in the sidebar where every role can view, create, edit, and delete appointments, training, meetings, school events, and other events, with explicit confirmation before deletion.

**Architecture:** Add a school-owned Laravel `CalendarEvent` model and permission-gated CRUD API, then consume it from a focused React `CalendarPage` component. The backend is the authority for school isolation and audit users; the frontend owns month-grid presentation, modal forms, optimistic-free mutations, and responsive behavior without adding a calendar dependency.

**Tech Stack:** Laravel 13, PHP 8.4, Eloquent, PHPUnit, React 19, TypeScript 6, Vite 8, Testing Library, Vitest, Lucide React, project CSS.

## Global Constraints

- Calendar appears in the `Overview` sidebar group directly below `Dashboard`.
- Every record is isolated by required `school_id`; a school-bound user cannot read or mutate another school's event.
- All initial roles receive `calendar.view`, `calendar.create`, `calendar.update`, and `calendar.delete`.
- Support `appointment`, `training`, `meeting`, `school_event`, and `other` event types.
- Support all-day and timed events, with optional location, participants/person-in-charge, notes, and end time.
- Deletion requires a second dialog naming the event and an explicit confirmation.
- Do not add recurring events, reminders, drag-and-drop, invitations, attendance, external synchronization, or a calendar package.
- Preserve existing uncommitted user changes and stage only files named by the current task.
- Follow strict red-green-refactor: every production behavior must have a failing test first.

## File Map

- Create `backend/database/migrations/2026_07_19_000001_create_calendar_events_table.php`: calendar persistence and foreign keys.
- Create `backend/app/Models/CalendarEvent.php`: fillable fields, casts, and relationships.
- Modify `backend/app/Models/School.php`: `calendarEvents()` relationship.
- Modify `backend/app/Models/User.php`: created/updated calendar relationships.
- Modify `backend/database/seeders/DatabaseSeeder.php`: permission definitions and grants to all four initial roles.
- Create `backend/app/Http/Requests/StoreCalendarEventRequest.php`: create validation.
- Create `backend/app/Http/Requests/UpdateCalendarEventRequest.php`: update validation.
- Create `backend/app/Http/Controllers/Api/CalendarEventController.php`: school-scoped list/create/update/delete and JSON serialization.
- Modify `backend/routes/api.php`: authenticated permission-gated calendar routes.
- Create `backend/tests/Feature/CalendarEventApiTest.php`: permissions, CRUD, range filtering, audit, validation, and isolation.
- Create `frontend/src/components/CalendarPage.tsx`: calendar state, month calculations, API flow, event form, and delete confirmation.
- Create `frontend/src/components/CalendarPage.css`: desktop/tablet month grid and narrow mobile agenda layout.
- Create `frontend/src/components/CalendarPage.test.tsx`: focused calendar behavior tests.
- Modify `frontend/src/App.tsx`: page key, sidebar item, active school prop, and page rendering.
- Modify `frontend/src/App.test.tsx`: sidebar order and integrated navigation/API mock.
- Modify `docs/IMPLEMENTATION_STATUS.md`: record the implemented Calendar capability and verification evidence.

---

### Task 1: Calendar persistence and role permissions

**Files:**
- Create: `backend/database/migrations/2026_07_19_000001_create_calendar_events_table.php`
- Create: `backend/app/Models/CalendarEvent.php`
- Modify: `backend/app/Models/School.php`
- Modify: `backend/app/Models/User.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Test: `backend/tests/Feature/CalendarEventApiTest.php`

**Interfaces:**
- Produces: `CalendarEvent` fields `school_id`, `title`, `event_type`, `is_all_day`, `starts_at`, `ends_at`, `location`, `participants`, `notes`, `created_by`, and `updated_by`.
- Produces: permissions `calendar.view`, `calendar.create`, `calendar.update`, and `calendar.delete` on every initial role.

- [ ] **Step 1: Write failing persistence and permission tests**

Create the feature test with `RefreshDatabase`. Seed the application, verify every role has all calendar permissions, and verify the model casts dates and booleans:

```php
public function test_every_initial_role_has_calendar_crud_permissions(): void
{
    $this->seed();

    foreach (['super-admin', 'ceo', 'school-admin', 'finance'] as $roleSlug) {
        $permissionSlugs = Role::query()->where('slug', $roleSlug)->firstOrFail()
            ->permissions()->pluck('slug')->all();

        $this->assertEqualsCanonicalizing([
            'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
        ], array_values(array_intersect($permissionSlugs, [
            'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
        ])));
    }
}

public function test_calendar_event_casts_all_day_and_date_fields(): void
{
    $school = $this->school('MIS');
    $user = User::factory()->create(['school_id' => $school->id]);
    $event = CalendarEvent::query()->create([
        'school_id' => $school->id,
        'title' => 'Staff Training',
        'event_type' => 'training',
        'is_all_day' => true,
        'starts_at' => '2026-07-21 00:00:00',
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);

    $this->assertTrue($event->is_all_day);
    $this->assertSame('2026-07-21', $event->starts_at->toDateString());
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter CalendarEventApiTest
```

Expected: FAIL because `CalendarEvent`, `calendar_events`, and calendar permission definitions do not exist.

- [ ] **Step 3: Add migration, model, relationships, and permissions**

Migration schema:

```php
Schema::create('calendar_events', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('school_id')->constrained()->cascadeOnDelete();
    $table->string('title');
    $table->string('event_type', 32);
    $table->boolean('is_all_day')->default(false);
    $table->dateTime('starts_at');
    $table->dateTime('ends_at')->nullable();
    $table->string('location')->nullable();
    $table->text('participants')->nullable();
    $table->text('notes')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
    $table->index(['school_id', 'starts_at']);
});
```

Model contract:

```php
final class CalendarEvent extends Model
{
    protected $fillable = [
        'school_id', 'title', 'event_type', 'is_all_day', 'starts_at', 'ends_at',
        'location', 'participants', 'notes', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['is_all_day' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function school(): BelongsTo { return $this->belongsTo(School::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function updater(): BelongsTo { return $this->belongsTo(User::class, 'updated_by'); }
}
```

Add the four permission definitions to the seeder, keep Super Admin's existing all-permission sync, add a CEO sync containing the four calendar permissions, and add all four slugs to the School Admin and Finance sync lists. Add these exact relationships:

```php
// School.php
public function calendarEvents(): HasMany
{
    return $this->hasMany(CalendarEvent::class);
}

// User.php
public function createdCalendarEvents(): HasMany
{
    return $this->hasMany(CalendarEvent::class, 'created_by');
}

public function updatedCalendarEvents(): HasMany
{
    return $this->hasMany(CalendarEvent::class, 'updated_by');
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the command from Step 2. Expected: the two Task 1 tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add backend/database/migrations/2026_07_19_000001_create_calendar_events_table.php backend/app/Models/CalendarEvent.php backend/app/Models/School.php backend/app/Models/User.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/CalendarEventApiTest.php
git commit -m "feat: add school calendar persistence"
```

### Task 2: School-scoped Calendar CRUD API

**Files:**
- Create: `backend/app/Http/Requests/StoreCalendarEventRequest.php`
- Create: `backend/app/Http/Requests/UpdateCalendarEventRequest.php`
- Create: `backend/app/Http/Controllers/Api/CalendarEventController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/CalendarEventApiTest.php`

**Interfaces:**
- Consumes: `CalendarEvent` model and four calendar permission slugs from Task 1.
- Produces: `GET /api/calendar-events?start&end&school_id`, `POST /api/calendar-events`, `PATCH /api/calendar-events/{id}`, and `DELETE /api/calendar-events/{id}`.
- Produces JSON event shape: `{id, school_id, title, event_type, is_all_day, starts_at, ends_at, location, participants, notes, created_by, updated_by, created_at, updated_at}` where audit users are `{id, name}` or `null`.

- [ ] **Step 1: Add failing CRUD, range, audit, validation, and isolation tests**

Add separate tests that use real users with the required permissions:

```php
public function test_school_user_can_create_list_update_and_delete_calendar_event(): void
{
    $school = $this->school('MIS');
    $user = $this->userWithPermissions($school, [
        'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    ]);

    $create = $this->actingAs($user)->postJson('/api/calendar-events', [
        'title' => 'Parent Appointment',
        'event_type' => 'appointment',
        'is_all_day' => false,
        'starts_at' => '2026-07-21T09:00:00+08:00',
        'ends_at' => '2026-07-21T10:00:00+08:00',
        'location' => 'Meeting Room',
        'participants' => 'Michelle Tan, School Admin',
        'notes' => 'Admission discussion',
    ])->assertCreated()
      ->assertJsonPath('calendar_event.school_id', $school->id)
      ->assertJsonPath('calendar_event.created_by.id', $user->id);

    $eventId = $create->json('calendar_event.id');

    $this->actingAs($user)
        ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31')
        ->assertOk()->assertJsonPath('data.0.id', $eventId);

    $this->actingAs($user)->patchJson("/api/calendar-events/{$eventId}", [
        'title' => 'Updated Parent Appointment',
        'event_type' => 'appointment',
        'is_all_day' => false,
        'starts_at' => '2026-07-21T09:30:00+08:00',
        'ends_at' => '2026-07-21T10:30:00+08:00',
    ])->assertOk()
      ->assertJsonPath('calendar_event.title', 'Updated Parent Appointment')
      ->assertJsonPath('calendar_event.updated_by.id', $user->id);

    $this->actingAs($user)->deleteJson("/api/calendar-events/{$eventId}")->assertNoContent();
    $this->assertDatabaseMissing('calendar_events', ['id' => $eventId]);
}
```

Also add individual tests named:

- `test_range_query_includes_events_that_overlap_the_boundary`
- `test_school_user_cannot_view_update_or_delete_another_schools_event`
- `test_group_user_must_supply_a_valid_active_school_context`
- `test_calendar_event_rejects_invalid_type_missing_title_and_end_before_start`
- `test_calendar_routes_require_the_matching_permission`

Cross-school assertions must be `404`, not `403`, so event existence is not disclosed.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter CalendarEventApiTest
```

Expected: the new API tests FAIL with missing routes or `404` responses.

- [ ] **Step 3: Implement request validation**

Use the same complete rules in both request classes so PATCH remains a full form update:

```php
public function rules(): array
{
    return [
        'title' => ['required', 'string', 'max:255'],
        'event_type' => ['required', Rule::in(['appointment', 'training', 'meeting', 'school_event', 'other'])],
        'is_all_day' => ['required', 'boolean'],
        'starts_at' => ['required', 'date'],
        'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        'location' => ['nullable', 'string', 'max:255'],
        'participants' => ['nullable', 'string', 'max:2000'],
        'notes' => ['nullable', 'string', 'max:5000'],
    ];
}
```

Both requests return `true` from `authorize()` because route middleware owns permissions.

- [ ] **Step 4: Implement controller school resolution, range overlap, serialization, and mutations**

The controller must resolve the school this way:

```php
private function schoolId(Request $request): int
{
    $schoolId = $request->user()?->school_id ?: $request->integer('school_id');
    if (! $schoolId || ! School::query()->whereKey($schoolId)->where('status', 'active')->exists()) {
        throw ValidationException::withMessages(['school_id' => 'An active school is required.']);
    }
    return $schoolId;
}

private function eventForSchool(Request $request, int $eventId): CalendarEvent
{
    return CalendarEvent::query()
        ->where('school_id', $this->schoolId($request))
        ->findOrFail($eventId);
}
```

Validate the list query before parsing it:

```php
$validated = $request->validate([
    'start' => ['required', 'date'],
    'end' => ['required', 'date', 'after_or_equal:start'],
]);
```

Use `CarbonImmutable::parse($validated['start'])->startOfDay()` and `CarbonImmutable::parse($validated['end'])->endOfDay()` for range bounds. The query condition is:

```php
->where('starts_at', '<=', $rangeEnd)
->where(function (Builder $query) use ($rangeStart): void {
    $query->where('ends_at', '>=', $rangeStart)
        ->orWhere(function (Builder $inner) use ($rangeStart): void {
            $inner->whereNull('ends_at')->where('starts_at', '>=', $rangeStart);
        });
})
->orderBy('starts_at')->orderBy('title')
```

On create, ignore client ownership/audit fields and set `school_id`, `created_by`, and `updated_by` from context. On update, change only validated event fields and set `updated_by`. Load `creator:id,name` and `updater:id,name` before serialization. Return `201` on create, `200` on update, and `204` on delete.

- [ ] **Step 5: Register permission-gated authenticated routes**

Inside the existing session plus `auth` route group add:

```php
Route::get('/calendar-events', [CalendarEventController::class, 'index'])
    ->middleware('permission:calendar.view');
Route::post('/calendar-events', [CalendarEventController::class, 'store'])
    ->middleware('permission:calendar.create');
Route::patch('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'update'])
    ->middleware('permission:calendar.update');
Route::delete('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'destroy'])
    ->middleware('permission:calendar.delete');
```

- [ ] **Step 6: Run the focused test until GREEN, then the full backend suite**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter CalendarEventApiTest
..\tools\php\php-local.cmd vendor\bin\phpunit
```

Expected: all calendar tests PASS, then the complete backend suite reports zero failures.

- [ ] **Step 7: Commit Task 2**

```powershell
git add backend/app/Http/Requests/StoreCalendarEventRequest.php backend/app/Http/Requests/UpdateCalendarEventRequest.php backend/app/Http/Controllers/Api/CalendarEventController.php backend/routes/api.php backend/tests/Feature/CalendarEventApiTest.php
git commit -m "feat: add school-scoped calendar API"
```

### Task 3: Focused React Calendar page

**Files:**
- Create: `frontend/src/components/CalendarPage.tsx`
- Create: `frontend/src/components/CalendarPage.css`
- Test: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes props `{schoolId: number, permissions: string[], onUnauthorized: () => void}`.
- Consumes Task 2 API and existing `apiRequest`, `ApiError`, `ModalFrame`, `PageHeader`, and `InlineMessage`.
- Produces `CalendarPage` component and exported `CalendarEvent` / `CalendarEventForm` types.

- [ ] **Step 1: Write failing month rendering and navigation tests**

Use a fetch mock that returns a timed appointment and an all-day training event. Render with all four permissions and assert:

```tsx
expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /Parent Appointment/ })).toHaveTextContent('9:00 AM')
expect(screen.getByRole('button', { name: /Staff Training/ })).not.toHaveTextContent(/AM|PM/)
await user.click(screen.getByRole('button', { name: 'Next month' }))
expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument()
expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('start=2026-07-26'), expect.anything())
```

Freeze the test clock at `2026-07-19T04:00:00Z` so the initial month is deterministic.

- [ ] **Step 2: Run the focused frontend test and verify RED**

Run:

```powershell
cd frontend
npm.cmd test -- src/components/CalendarPage.test.tsx
```

Expected: FAIL because `CalendarPage.tsx` does not exist.

- [ ] **Step 3: Implement types, month calculations, fetching, and month grid**

Define the API type exactly:

```ts
export type CalendarEvent = {
  id: number
  school_id: number
  title: string
  event_type: 'appointment' | 'training' | 'meeting' | 'school_event' | 'other'
  is_all_day: boolean
  starts_at: string
  ends_at: string | null
  location: string | null
  participants: string | null
  notes: string | null
  created_by: { id: number; name: string } | null
  updated_by: { id: number; name: string } | null
  created_at: string
  updated_at: string
}
```

Build a 42-day visible grid starting Sunday before the first day of the month. Fetch with `school_id`, the first visible date, and the last visible date using `URLSearchParams`. Append `?school_id=${schoolId}` to every POST, PATCH, and DELETE endpoint as well, so group-level users with no assigned `school_id` mutate the same active school shown by the workspace. Render event buttons in each day cell, use `Intl.DateTimeFormat('en-MY', {hour: 'numeric', minute: '2-digit'})` for timed labels, and render the event type as accessible text in the button label. Use `CalendarDays`, `ChevronLeft`, `ChevronRight`, and `Plus` icons.

- [ ] **Step 4: Run the month tests and verify GREEN**

Run the command from Step 2. Expected: month rendering and navigation tests PASS.

- [ ] **Step 5: Write failing create and edit form tests**

Add tests that click `Add event`, fill labelled fields, submit, and inspect the request body. Add an edit test that opens an event, changes its title, submits `PATCH`, and keeps values in the dialog on a `422` response:

```tsx
await user.click(screen.getByRole('button', { name: 'Add event' }))
await user.type(screen.getByLabelText('Title'), 'Teacher Training')
await user.selectOptions(screen.getByLabelText('Event type'), 'training')
await user.click(screen.getByLabelText('All-day event'))
await user.clear(screen.getByLabelText('Start date'))
await user.type(screen.getByLabelText('Start date'), '2026-07-24')
await user.click(screen.getByRole('button', { name: 'Create event' }))
await waitFor(() => expect(requestBody()).toMatchObject({
  title: 'Teacher Training', event_type: 'training', is_all_day: true,
}))
```

- [ ] **Step 6: Run the form tests and verify RED**

Run the focused test. Expected: FAIL because the form interactions do not exist.

- [ ] **Step 7: Implement create/edit modal and validation handling**

Use this form contract:

```ts
export type CalendarEventForm = {
  title: string
  event_type: CalendarEvent['event_type']
  is_all_day: boolean
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  location: string
  participants: string
  notes: string
}
```

Convert form values to ISO strings before submitting. For all-day events use local `00:00:00` values and omit time inputs; for timed events require a start time and include the end only when both end date and end time are supplied. Disable submit while saving. Render `Add event`, editable event buttons, `Save changes`, and `Delete event` only when the matching permission is present; the seeded initial roles receive all four, while this keeps the page compatible with future custom roles. If an `ApiError` is `401`, call `onUnauthorized`; otherwise preserve the form and show its message plus field errors from `error.errors`.

- [ ] **Step 8: Run form tests and verify GREEN**

Run the focused test. Expected: create/edit and month tests PASS.

- [ ] **Step 9: Write failing two-stage deletion tests**

Prove cancel does not call DELETE, successful confirmation waits for the API before removing the chip, duplicate clicks are disabled, and a failed DELETE keeps both the event and actionable error visible:

```tsx
await user.click(screen.getByRole('button', { name: /Parent Appointment/ }))
await user.click(screen.getByRole('button', { name: 'Delete event' }))
expect(screen.getByRole('dialog', { name: 'Delete Parent Appointment?' })).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Cancel deletion' }))
expect(deleteRequests()).toHaveLength(0)
```

- [ ] **Step 10: Run deletion tests and verify RED**

Run the focused test. Expected: FAIL because delete confirmation behavior does not exist.

- [ ] **Step 11: Implement destructive confirmation and mutation state**

Open a second `ModalFrame` with title `Delete ${event.title}?`, explanatory copy `This event will be permanently removed and cannot be recovered.`, and buttons `Cancel deletion` and `Confirm delete`. Only remove the event from state after the DELETE resolves with success. Keep the confirmation open and show an `InlineMessage` after failure.

- [ ] **Step 12: Add responsive and event-type styling**

Use a seven-column CSS grid at `min-width: 768px`. At `max-width: 767px`, hide empty outside-month cells and render populated/current-month cells as vertically stacked `.calendar-mobile-day` rows; do not set a fixed width that causes page overflow. Give every event type a distinct border/accent class while retaining a visible text type label for non-color identification.

- [ ] **Step 13: Run Calendar component tests, lint, and build**

```powershell
cd frontend
npm.cmd test -- src/components/CalendarPage.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: focused tests PASS, lint reports zero warnings/errors, and the production build exits `0`.

- [ ] **Step 14: Commit Task 3**

```powershell
git add frontend/src/components/CalendarPage.tsx frontend/src/components/CalendarPage.css frontend/src/components/CalendarPage.test.tsx
git commit -m "feat: build shared calendar page"
```

### Task 4: Integrate Calendar into the application shell

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `CalendarPage` from Task 3 and `dashboard.school.id` as active school context.
- Produces: `calendar` page key and sidebar button directly below Dashboard.

- [ ] **Step 1: Update the existing sidebar test first and verify RED**

Change the expected Overview order to start with:

```ts
['Dashboard', 'Calendar', 'Students', 'Parents', 'Fees', 'Fee Record',
 'Invoices', 'Payments', 'Receipts', 'Reports', 'Settings']
```

Add an integration test that clicks Calendar, sees `School Calendar`, and verifies the list request contains `school_id=1`. Add `/calendar-events` to `installApiMock()` returning `{data: []}`.

Run:

```powershell
cd frontend
npm.cmd test -- src/App.test.tsx
```

Expected: FAIL because Calendar is not in the app shell.

- [ ] **Step 2: Add the page key, sidebar item, import, and render branch**

Import `CalendarDays` and `CalendarPage`, add `'calendar'` to `PageKey`, then change Overview to:

```tsx
items: [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
]
```

Add before the Students branch:

```tsx
if (activePage === 'calendar') {
  return (
    <CalendarPage
      schoolId={dashboard.school.id}
      permissions={user.permissions}
      onUnauthorized={handleUnauthorized}
    />
  )
}
```

- [ ] **Step 3: Run App and Calendar tests until GREEN**

```powershell
cd frontend
npm.cmd test -- src/App.test.tsx src/components/CalendarPage.test.tsx
```

Expected: both test files PASS with no unhandled request warnings.

- [ ] **Step 4: Commit Task 4**

```powershell
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add Calendar to admin sidebar"
```

### Task 5: Documentation, full verification, and responsive visual QA

**Files:**
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Test: all backend and frontend suites

**Interfaces:**
- Consumes: completed backend API and frontend Calendar.
- Produces: current implementation record and fresh evidence against every acceptance criterion.

- [ ] **Step 1: Update implementation documentation**

Add Calendar to implemented modules with exact scope: school-isolated month view, all-role CRUD, all-day/timed events, five event types, optional details/audit users, and confirmed deletion. Add current route/test counts only after the commands below provide them.

- [ ] **Step 2: Run fresh complete backend verification**

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd artisan route:list --path=api/calendar-events
```

Expected: PHPUnit reports zero failures and route list shows four authenticated calendar routes with their matching permission middleware.

- [ ] **Step 3: Run fresh complete frontend verification**

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all Vitest tests pass, lint reports zero errors/warnings, and TypeScript plus Vite production build exits `0`.

- [ ] **Step 4: Run focused browser QA**

Start the local backend and frontend using the documented commands, log in as each seeded role, and verify Calendar at widths `1440x900`, `1024x768`, `768x1024`, and `390x844`. Confirm sidebar placement, no page-level horizontal overflow, readable event chips/mobile rows, create/edit success, cancel deletion, confirmed deletion, keyboard Escape, and error state preservation. Verify a second-school fixture is not returned to the MIS user.

- [ ] **Step 5: Re-read the approved spec and audit each requirement**

Compare `docs/superpowers/specs/2026-07-19-shared-calendar-design.md` against code, test names, command output, and browser QA. Do not claim completion if any requirement lacks direct evidence.

- [ ] **Step 6: Commit documentation after verification**

```powershell
git add docs/IMPLEMENTATION_STATUS.md
git commit -m "docs: record shared calendar delivery"
```
