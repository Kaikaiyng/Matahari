# Dashboard Consistency, School Scoping, and Login Rate-Limit Design

**Date:** 2026-07-22

**Status:** Second-gate candidate; implementation is not authorized until this document is approved

**Repository baseline:** `origin/master` at `32ad7a5ceb680586633ba4d74762f53abbbdfba7`

**Supersedes:** `2026-07-21-dashboard-outstanding-fees-design.md` where that document retains hardcoded 2026 request values, legacy Dashboard fallback behavior, or describes only the outstanding metric. It does not supersede the Invoice module or the broader Fee Record design.

## 1. Problem statement

The Dashboard currently combines two financial models that do not describe the same balance:

- `metrics.outstanding_fees` is calculated from active Fee Record charge summaries.
- `outstanding_students`, `overdue_accounts`, and `invoices_this_month` are calculated from legacy Invoice records.

That split lets the Dashboard show a real non-zero Fee Record balance while claiming that no accounts need attention. The endpoint also trusts a client-provided school ID, uses hardcoded frontend school/date/year values, has no dedicated permission, and derives its date from Laravel's UTC application clock rather than the Malaysian business date.

The Login endpoint has no credential-attempt throttle. A caller can repeatedly try a normalized username and password without a server-enforced 60-second lock. The frontend disables the button after React state updates, but it has no synchronous guard against two submit events in the same render interval.

The change must correct these problems without changing payment verification, Fee Record calculations, receipt behavior, global timestamp storage, the Calendar, or the Invoice module.

## 2. Current inconsistency evidence

The current `DashboardController` at the inspected baseline imports `Invoice` and builds `outstanding_students` from `Invoice::query()`, while `outstanding_fees` comes from `FeeRecordSummaryService`. The current frontend then renders those invoice rows as `Outstanding accounts`.

The live local Dashboard captured on 2026-07-22 showed:

- Outstanding Fees: `RM 4,050`
- Outstanding accounts: `No urgent outstanding accounts`
- Monthly Collection: `RM 1,290`
- Today Collection: `RM 0`

This is not an empty-state wording problem. It is a source-of-truth contradiction. The current 1024px composition also leaves four metric cards in one narrow row, causing labels and currency values to wrap before the existing 900px two-column breakpoint applies.

The current Login screen correctly keeps the entered username, shows the generic invalid-credentials response, and disables the button while its request is pending. The error is attached to the Username field, but there is no top-level throttling state because the backend never returns `429`, and a second submit can enter before `isSubmitting` is committed.

## 3. Approved product rules

The active finance flow remains:

```text
Student
  -> Fee Agreement
  -> Fee Agreement Items
  -> Fee Record Preview
  -> Activated Fee Record Charges
  -> Outstanding Charge Selection
  -> Payment Allocation
  -> Payment Verification
  -> Receipt
  -> Fee Record Summary / Category Monthly View
```

The Dashboard follows these rules:

1. Fee Record charges are authoritative for outstanding balances.
2. `FeeRecordSummaryService` supplies both the outstanding total and the students-with-outstanding population.
3. Only payments with `status = verified` contribute to collected totals or Recent Collections.
4. Payments with `status = pending_verification` appear only in Pending Verification and never contribute to collected totals.
5. Pending payments do not reduce Dashboard outstanding unless the existing verification and allocation workflow has already updated Fee Record charge balances. This change does not alter that workflow.
6. Receipts remain evidence. Receipt fields returned internally by `FeeRecordSummaryService` do not calculate Dashboard balances.
7. Invoice queries and Invoice-shaped fields are removed only from the Dashboard endpoint, frontend Dashboard contract, mocks, and Dashboard tests.
8. The Invoice table, model, migrations, generation endpoint, and possible future use remain untouched.
9. Actual zero data is rendered as zero. A request failure is rendered as unavailable. No demo or fabricated metrics replace a failure.
10. The Dashboard remains an internal school finance control page. It will not gain charts, trend widgets, selectors, or a new routing system in this change.

## 4. Dashboard response contract

`GET /api/dashboard/school` returns the following successful `200` contract. Money values are JSON numbers and are formatted by the client. Dates use ISO date strings.

```json
{
  "school": {
    "id": 1,
    "code": "MIS",
    "name": "Matahari International School"
  },
  "context": {
    "date": "2027-01-01",
    "month": "2027-01",
    "academic_year": "2027",
    "timezone": "Asia/Kuala_Lumpur"
  },
  "metrics": {
    "today_collection": 0,
    "monthly_collection": 0,
    "outstanding_fees": 0,
    "active_students": 0,
    "pending_verification_count": 0,
    "students_with_outstanding_count": 0
  },
  "pending_payments": [
    {
      "payment_id": 42,
      "student_id": 7,
      "student_no": "MIS-2026-007",
      "student_name": "Student Name",
      "amount": 450,
      "payment_method": "bank_transfer",
      "payment_date": "2027-01-01",
      "reference_no": "BANK-123",
      "status": "pending_verification"
    }
  ],
  "outstanding_students": [
    {
      "student_id": 7,
      "student_no": "MIS-2026-007",
      "student_name": "Student Name",
      "class_name": "MD1",
      "total_outstanding": 1250,
      "outstanding_months": ["2027-01", "2027-02"],
      "collection_status": "partial"
    }
  ],
  "recent_payments": [
    {
      "payment_id": 41,
      "student_id": 9,
      "student_no": "MIS-2026-009",
      "student_name": "Another Student",
      "amount": 800,
      "payment_method": "cash",
      "payment_date": "2027-01-01"
    }
  ]
}
```

Contract decisions:

- `context` records the resolved business date so users and tests can explain which day, month, year, and timezone produced the figures.
- The list names remain close to existing project conventions, but row fields become explicit and student-oriented.
- `payment_id` replaces ambiguous `id` in both payment lists.
- `student_name` and `total_outstanding` replace invoice-oriented `student` and `amount` in outstanding rows.
- `reference_no` and `class_name` are nullable when the source record has no value.
- `invoice_id`, `due_date`, invoice `status`, `overdue_accounts`, and `invoices_this_month` are absent.
- `pending_verification_count` and `students_with_outstanding_count` count every matching record, not only the five returned rows.
- Pending and recent rows are limited to five. Outstanding rows are the top five by balance.
- A successful zero-data response has the full shape above with numeric zeros and empty arrays.

Validation and failure contracts:

- Invalid `academic_year` returns Laravel's normal `422` validation response.
- A global user requesting a missing or inactive school receives a readable `404` response.
- A global user with no requested school and no active school receives a readable `404` response.
- An unauthenticated caller receives `401`.
- An authenticated caller without `dashboard.view` receives `403`.
- Unexpected service or database failures remain non-`200` responses. The backend does not replace them with a successful zero payload.

## 5. Dashboard data-source mapping

| Response field | Source | Filters and ordering | Explicit exclusions |
| --- | --- | --- | --- |
| `school` | Resolved `schools` row | Algorithm in section 6 | Client scope never overrides a school-bound user |
| `context.*` | `CarbonImmutable` in `config('business.timezone')` | Calculated per request | No hardcoded 2026 values; no global timezone change |
| `today_collection` | `payments.amount` | Resolved school, `verified`, `payment_date = context.date` | Pending, voided, other schools |
| `monthly_collection` | `payments.amount` | Resolved school, `verified`, payment date inside the business month's date bounds | Pending, voided, string-prefix shortcuts |
| `outstanding_fees` | `FeeRecordSummaryService::summary()` | Resolved school, resolved academic year, active students | Invoice balances; receipt totals |
| `active_students` | `students` count | Resolved school, `status = active` | Other schools and inactive students |
| `pending_verification_count` | `payments` count | Resolved school, `pending_verification` | Verified and voided payments |
| `students_with_outstanding_count` | Fee Record summary rows | `total_outstanding > 0` | Invoice counts and zero-balance students |
| `pending_payments` | `payments` with `student` | Pending, resolved school, newest `created_at`, then highest `id`, first five | No new Payment page or route |
| `outstanding_students` | Fee Record summary rows | Positive balance, descending balance, then student name and number, first five | Invoice IDs, due dates, invoice status |
| `recent_payments` | `payments` with `student` | Verified, resolved school, newest `payment_date`, then highest `id`, first five | Pending and voided payments |

The controller calls `FeeRecordSummaryService` once. It derives the total, positive-row count, and ordered top five from that one result. It does not recalculate charge balances or duplicate the service's category/month logic.

`FeeRecordSummaryService` currently materializes active students and their matching charge rows and also loads latest issued receipts. The Dashboard will accept that existing behavior for v0.1 rather than modify Fee Record business logic. Receipt metadata may be loaded by the service but is not copied into the Dashboard contract and does not participate in balance arithmetic.

The processing flow is:

```text
Authenticated request
  -> permission:dashboard.view
  -> validate academic_year
  -> resolve school from authenticated scope
  -> resolve Malaysia business date/month/default year
  -> FeeRecordSummaryService once
       -> total outstanding
       -> positive count
       -> top five positive balances
  -> verified payment queries
       -> today total
       -> month total
       -> five recent rows
  -> pending payment query
       -> total count
       -> five newest rows
  -> active student count
  -> one truthful response
```

## 6. School-resolution algorithm

The backend, not the client, owns school scope.

```text
user.school_id present?
  yes -> load that exact school
         ignore any school_id query parameter, including a different value
         use the user's school ID for every Dashboard query

  no  -> validate optional school_id as an integer
         school_id supplied?
           yes -> load that school only if status = active
                  missing/inactive -> readable 404
           no  -> first active school ordered by id ascending
                  none -> readable 404
```

Detailed rules:

1. `academic_year` is validated for every caller as an optional four-digit string.
2. For a user whose `school_id` is non-null, the controller does not validate, trust, or use the query-string `school_id`. Ignoring it is the chosen consistent behavior because it preserves old bookmarked URLs without opening cross-school access.
3. The user's assigned school must exist. If the foreign record is unexpectedly missing, the endpoint returns `404` rather than falling back to school 1.
4. For a permitted global user, a supplied `school_id` must identify an active school. An inactive school is treated as unavailable for this Dashboard request.
5. With no global selection, `orderBy('id')->where('status', 'active')->first()` provides a deterministic fallback.
6. The endpoint always returns the resolved school object. The frontend uses its name as context and does not infer scope from a request parameter.
7. Every Payment, Student, and Fee Record summary query receives the same resolved school ID.
8. The frontend will not add a school selector. A global user may supply `school_id` through an API client, but the normal Dashboard request remains parameter-free.

This algorithm prevents both direct cross-school leakage and accidental metric/list mismatches where separate queries resolve different schools.

## 7. `dashboard.view` migration and seeder strategy

The route becomes:

```text
GET /api/dashboard/school
  -> session middleware
  -> auth
  -> permission:dashboard.view
```

Fresh databases:

- `DatabaseSeeder` creates or updates `dashboard.view` with the label `View dashboard`.
- The permission is included in the existing role synchronization for `super-admin`, `ceo`, `school-admin`, and `finance`.
- No seeded usernames, passwords, or role slugs change.

Preserved databases:

- A new idempotent data migration creates `dashboard.view` if it does not exist.
- It finds the four known roles by slug and inserts missing `role_permissions` rows with `insertOrIgnore` or the project's equivalent duplicate-safe operation.
- It skips any role that does not exist instead of failing the entire migration.
- Re-running `up()` produces one permission and at most one pivot per role.
- The migration uses table operations rather than application service code so it remains stable if models evolve.
- The migration is additive. Its `down()` is intentionally non-destructive: it leaves the permission and assignments in place because a later administrator may have assigned the permission to another role, and removing authorization data is not required to roll application code back.

The migration must run before the protected route is deployed. Otherwise preserved users would temporarily receive `403` even though their role should retain Dashboard access.

Frontend permission behavior:

- Filter the Dashboard navigation item when `dashboard.view` is absent.
- Do not call `/dashboard/school` after session restoration or login when the user lacks the permission.
- If an already selected Dashboard page is encountered without permission, render a non-financial `You do not have permission to view the Dashboard` state. Do not render cached metrics.
- The API middleware remains the security boundary; frontend checks are only navigation and request hygiene.

## 8. Business-timezone strategy

Laravel's application timezone remains exactly `UTC`. This change does not modify `config('app.timezone')`, timestamp storage, Calendar conversion, Payment writes, Receipt writes, or global `now()` behavior elsewhere.

A focused configuration file is added:

```php
// config/business.php
return [
    'timezone' => env('BUSINESS_TIMEZONE', 'Asia/Kuala_Lumpur'),
];
```

`.env.example` gains:

```text
BUSINESS_TIMEZONE=Asia/Kuala_Lumpur
```

At the start of each Dashboard request:

1. Read and validate the configured timezone through Carbon. Invalid configuration should fail visibly during the request rather than silently use UTC.
2. Create one immutable business clock: `CarbonImmutable::now(config('business.timezone'))`.
3. Derive `context.date` with `Y-m-d`.
4. Derive `context.month` with `Y-m`.
5. Default `academic_year` to the business clock's `Y`; use a validated explicit request value when present.
6. Derive inclusive start/end date strings for the business month and use date comparisons for the monthly Payment query.

`payments.payment_date` is a date field, not a timestamp. The timezone determines which business date/month to query; stored payment dates are not converted.

Boundary test:

```text
Frozen UTC instant:       2026-12-31 16:30:00 UTC
Malaysia business time:   2027-01-01 00:30:00 +08:00
Expected context.date:    2027-01-01
Expected context.month:   2027-01
Expected default year:    2027
```

A verified payment dated `2027-01-01` must count as today's and January's collection at that instant. A payment dated `2026-12-31` must not count as today's collection. This proves the Dashboard crosses both the UTC date and year boundary without changing the global application timezone.

## 9. Login limiter algorithm

The endpoint continues to use `LoginRequest`, Laravel session authentication, and Laravel's native `RateLimiter`.

Limiter constants:

- Maximum failed credential attempts: `5`
- Decay/lock window: `60` seconds
- Key input: normalized username plus Laravel-resolved request IP
- Key storage: SHA-256 hash, prefixed with a non-secret namespace

```text
POST /api/login
  -> LoginRequest validates and normalizes username
  -> key = "login:" + sha256(normalized username + "|" + request.ip())
  -> RateLimiter::tooManyAttempts(key, 5)?
       yes -> seconds = max(1, RateLimiter::availableIn(key))
              return 429 + Retry-After + generic readable message
              do not call Auth::attempt
       no  -> Auth::attempt(normalized credentials)
              wrong credentials?
                yes -> RateLimiter::hit(key, 60)
                       return existing generic 422 username error
              credentials correct
                -> preserve session regeneration
                -> account inactive?
                     yes -> preserve logout, session invalidation,
                            and CSRF-token regeneration
                            RateLimiter::hit(key, 60)
                            return existing generic 422 username error
                     no  -> preserve last_login_at update
                            RateLimiter::clear(key)
                            return existing success payload
```

Exact attempt behavior:

- Failed attempts 1 through 5 return the existing generic `422` response.
- Attempt 6 while the key is locked returns `429` before authentication.
- Further attempts during the window return `429`.
- A correct password does not bypass an active lock.
- A successful active login clears only that normalized-username/IP key.
- After a clear, the next failure is failure 1 of a new window.
- An inactive account consumes an attempt but remains indistinguishable from a wrong or nonexistent account.
- Missing, malformed, or otherwise invalid FormRequest input does not count as a credential failure.
- Username case and surrounding whitespace converge on the same key because the controller uses the normalized value from `LoginRequest`.
- Different normalized usernames at the same IP have separate keys.
- The same normalized username at different Laravel-resolved IPs has separate keys.
- The controller uses `$request->ip()` only. It does not read `CF-Connecting-IP`, `X-Forwarded-For`, or any raw proxy header directly.

Locked response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{
  "message": "Too many login attempts. Please try again in 42 seconds."
}
```

The limiter check followed by credential attempt and increment follows the explicitly approved Laravel-native sequence. It does not add a custom cache table, middleware package, CAPTCHA, account-level lock column, or permanent lockout.

## 10. Frontend Dashboard hierarchy

The current application shell, typography, colors, cards, panel components, and navigation model remain. The change reorganizes Dashboard content, not the whole product.

DOM and visual priority:

```text
Page header
  -> School overview
  -> Open Students action only when students.view exists

Four metric cards
  -> Collected Today
  -> Collected This Month
  -> Outstanding Fees (opens Fee Record when fee_record.view exists)
  -> Active Students

Action-needed row
  -> Pending Verification
       count badge in header
       five newest pending payments
  -> Students With Outstanding
       count badge in header
       five highest balances

Lower-priority activity
  -> Recent Collections
       five newest verified payments
```

Pending Verification and Students With Outstanding appear before Recent Collections in both DOM and visual order. They use the existing panel language with a restrained attention treatment such as an eyebrow, status badge, or top-border accent. They do not become charts or oversized marketing cards. Recent Collections remains a neutral activity panel below them.

List rows:

- Pending rows show student name, formatted payment method, payment date, optional reference, amount, and a clear `Pending verification` status.
- Outstanding rows show student name, class or `Not assigned`, amount, and optionally a concise month list when present.
- Recent rows show student name, formatted payment method, payment date, and amount.
- Amounts use a Dashboard-specific two-decimal Ringgit formatter so zero is `RM 0.00` without changing existing Fee Record formatting across the rest of the application.
- Long names wrap inside the text column. Amounts remain right-aligned and do not split across lines.
- When `students.view` exists, a row is a real button or link-like button with keyboard focus and opens the existing Student Detail flow through the current `openStudentDetail` path.
- When `students.view` is absent, the row remains readable but non-interactive. No fake click target is presented.
- No standalone Payment page, route, modal, or routing rewrite is introduced.

The response's `school.name` remains the shell context. `context.date`, month, year, and timezone are available for future explanation but do not create a selector or extra control in v0.1.

## 11. Responsive behavior

The design uses existing breakpoints and adds Dashboard-scoped overrides so unrelated pages are not reflowed.

| Viewport | Metric cards | Operational panels | Notes |
| --- | --- | --- | --- |
| 1440 x 900 desktop | Four columns | Two action panels side by side; Recent Collections below | Preserves at-a-glance metrics and action priority |
| 1180 x 820 or 1024 x 768 landscape tablet | Two columns by two rows | One column in priority order | Avoids the current narrow four-card row beside the fixed shell |
| 820 x 1180 or 768 x 1024 portrait tablet | Two columns by two rows | One column | Drawer/shell behavior remains unchanged |
| 390 x 844 mobile | One column | One column | Full-width touch targets and readable stacked metadata |

Rules:

1. At or below 1180px, `.dashboard-page .stats-grid` becomes two columns before card text begins wrapping at approximately 1024px.
2. At or below 640px, Dashboard metrics become one column, matching the existing small-screen pattern.
3. The action panels collapse to one column at or below 1180px because the shell leaves too little content width for two dense finance lists at 1024px.
4. No Dashboard container may set a fixed minimum width that creates page-level horizontal overflow.
5. Row text containers use `min-width: 0`; names and metadata can wrap. Currency uses `white-space: nowrap`.
6. Interactive rows and buttons have a minimum 44px target. List rows target at least 52 to 56px where two lines of metadata are present.
7. Keyboard focus remains visible on metric and list-row buttons.
8. Panel headers wrap without sending count badges off-screen.
9. Responsive CSS changes are scoped to the Dashboard in `App.css`; the full application shell and shared `AdminUi.css` grid remain unchanged unless implementation proves a scoped override impossible.
10. Responsive test assertions confirm critical sections remain rendered. Browser QA confirms actual reflow, overflow, wrapping, focus, and touch-target appearance.

## 12. Error, loading, empty, and zero states

Dashboard request state is modeled explicitly as `loading`, `live`, `error`, or `forbidden/no-access`; the current internal name `demo` is not retained because no demo fallback is rendered.

| State | Metric cards | Operational panels | Page message |
| --- | --- | --- | --- |
| Loading | `Loading...` | Loading title and short fetching copy | No error message |
| Live with values | Formatted values | Up to five rows each | None |
| Live with zero data | `RM 0.00` and `0` | Truthful section-specific empty states | None |
| API failure | `Unavailable` | `Dashboard unavailable`; no stale rows | Readable `Dashboard data could not be loaded. Please reload the page to try again.` |
| No permission | No financial values or requests | No financial panels | `You do not have permission to view the Dashboard.` |

Truthful empty copy:

- Pending Verification: `No payments awaiting verification.`
- Students With Outstanding: `No students have an outstanding Fee Record balance for this academic year.`
- Recent Collections: `No verified collection activity yet.`

The positive outstanding empty state no longer refers to `urgent`, `overdue`, or future invoice items. A zero outstanding total and an empty students-with-outstanding list are produced by the same Fee Record summary result, so they cannot disagree inside one successful response.

The frontend clears prior Dashboard data before a new request and on failure. It stores a safe display message separately from the data. It never converts a `500`, network failure, `401`, or `403` into successful zero data.

Login states:

- Existing `422` credential errors remain next to the login form/Username field with the same generic copy.
- A `429` message appears in the form's error message area, not as a network-error replacement and not only as field validation.
- Error messaging uses an alert semantic so screen readers announce the state change.
- Username and password retention remain consistent with current behavior: entered values remain after `422` or `429`.
- The Login button remains disabled and says `Logging in...` while the request is pending.
- A synchronous `useRef` guard is checked and set before the async request and cleared in `finally`; it blocks a second submit before React commits `isSubmitting`.
- No countdown is added. The backend's seconds remain visible in the `429` message.

## 13. Backend test matrix

All tests use deterministic database setup. Time-sensitive tests freeze Carbon. Limiter tests clear their exact hashed keys or reset cache state and never sleep.

### Dashboard route, permission, and migration

| Test | Setup | Expected assertion |
| --- | --- | --- |
| Authentication required | No authenticated user | `401` |
| Permission required | Authenticated role without `dashboard.view` | `403` |
| Seeded permission exists | Fresh `DatabaseSeeder` | Permission exists and all four role slugs contain it |
| Existing database migration | Roles exist, permission removed, run migration `up()` twice | One permission, one assignment for each present role, no duplicate error |
| Missing role tolerance | Remove one expected role before migration | Migration succeeds and assigns all roles that exist |
| Route middleware contract | Inspect route or request as unauthorized user | Session/auth/permission enforcement remains active |

### School resolution and isolation

| Test | Setup | Expected assertion |
| --- | --- | --- |
| Bound user uses own school | User has school A; A and B have data | Response school and all values are A only |
| Bound user cannot override | School A user requests `school_id=B` | Response remains school A; no B values appear |
| Malformed irrelevant override | School A user sends malformed `school_id` | Parameter is ignored; own-school response succeeds |
| Global selects active school | Null-school permitted user requests active B | Response is B only |
| Global rejects inactive school | Null-school user requests inactive B | Readable `404` |
| Global deterministic default | Multiple active schools, no parameter | Lowest active school ID is selected |
| No active school | Null-school user, no active schools | Readable `404` |
| Cross-school leakage regression | Same dates/statuses/amounts in A and B | No metric, pending row, recent row, or outstanding row from B appears in A response |

### Date, collection, and data sources

| Test | Setup | Expected assertion |
| --- | --- | --- |
| No hardcoded 2026 | Freeze a non-2026 business date | Context date/month/year follow frozen time |
| Explicit academic year | Request valid four-digit year | Fee Record results and context use it while date/month stay current |
| Invalid academic year | Non-four-digit value | `422` |
| Business timezone | App timezone remains UTC; business timezone Malaysia | Response reports `Asia/Kuala_Lumpur`; app timezone assertion stays UTC |
| UTC-to-Malaysia boundary | Freeze `2026-12-31 16:30 UTC`; payments on Dec 31 and Jan 1 | Context is Jan 1, 2027; only Jan 1 is today; January monthly total is correct |
| Today verified only | Same-date verified, pending, and voided payments | Only verified amount is summed |
| Month verified only | Verified payments inside/outside month plus pending inside | Only verified in-month values are summed |
| Pending list/count | More than five pending payments | Count includes all; list contains newest five with deterministic order and fields |
| Pending not collected | Pending amount exists | Today/month totals exclude it |
| Recent verified only | Mixed statuses and dates | Five newest verified rows only |
| Fee Record total | Fee Record charges with known cached balances | Sum matches `FeeRecordSummaryService` rows |
| Outstanding students source | Positive Fee Record charge but no Invoice | Student appears with Fee Record fields |
| Invoice non-influence | Outstanding Invoice but zero/no Fee Record outstanding | Dashboard outstanding total/list remain zero/empty |
| Outstanding order and limit | Six positive students with ties | Highest five returned; deterministic name/number tie-break |
| Active students | Mixed status students in two schools | Count includes active resolved-school students only |
| Real zero response | Active school with no matching finance data | Full `200` shape, numeric zeros, empty arrays |

### Login rate limiting and session regression

| Test | Setup | Expected assertion |
| --- | --- | --- |
| Normal failure | One wrong password | Existing generic `422` and Username validation error |
| First five failures | Repeat same normalized username/IP | Attempts 1-5 each return generic `422` |
| Sixth blocked | Five prior failures | Attempt 6 returns `429` |
| Retry metadata | Locked request | `Retry-After` is present and positive; generic message includes seconds |
| Generic identity handling | Existing username and nonexistent username | Both expose the same invalid-credentials copy before their independent keys lock |
| Inactive generic response | Correct password for inactive account | Generic `422`; no account-status disclosure |
| Inactive counts | Five inactive attempts | Sixth is `429` |
| Success clears | Fail several times, then successful active login | Key is cleared |
| Failure after clear | Successful clear, then wrong password | New failure returns `422`, not `429` |
| Normalized key | Use username case/space variants | Variants share one limiter count |
| Username separation | Different usernames, same IP | Separate limits |
| IP separation | Same username, different `REMOTE_ADDR` values | Separate limits; raw forwarding headers are not manually consumed |
| Locked request skips auth | Lock key, submit correct credentials | `429`, `last_login_at` unchanged, session not authenticated |
| Session regeneration | Successful login | Session ID changes and authenticated user is available |
| Inactive cleanup | Inactive correct password | Session remains unauthenticated after logout/invalidation path |
| Existing logout and `/me` | Login, read `/me`, logout, read again | Existing success and `401` behavior remains |
| Validation does not count | Submit missing/malformed credentials repeatedly | Validation `422`; a later valid credential failure starts at attempt 1 |

### Backend commands

From the repository root, use the project runtime before claiming an environment limitation:

```text
tools\php\php-local.cmd backend\artisan test
tools\php\php-local.cmd backend\artisan route:list
```

If invoked from `backend`, use `..\tools\php\php-local.cmd artisan test`. Focused suites run first, followed by the full suite. A test run that did not execute is not a pass.

## 14. Frontend test matrix

| Area | Test | Expected assertion |
| --- | --- | --- |
| Request | Default Dashboard request | Exact path is `/dashboard/school`; no school/date/month/year query |
| Permission | User has `dashboard.view` | Dashboard nav visible and request made |
| Permission | User lacks `dashboard.view` | Nav hidden, no Dashboard request, no finance values rendered |
| Loading | Request remains pending | Four cards show `Loading...`; three section loading states remain present |
| Failure | API returns `500` or rejects | Cards show `Unavailable`, readable message shown, no fake or stale values |
| Zero | Successful zero contract | `RM 0.00`, `0`, and three truthful empty states |
| Contract | Pending data | Count/state/reference/method/date/amount render from pending fields |
| Contract | Fee Record outstanding data | Student/class/months/total render; no invoice due date/status copy |
| Contract | Recent verified data | Recent payment fields render in lower-priority section |
| Regression | Invoice-shaped mock removed | Types, fixtures, and assertions contain no `invoice_id`, `due_date`, `overdue_accounts`, or `invoices_this_month` for Dashboard |
| Navigation | Outstanding Fees with permission | Existing Fee Record page opens |
| Navigation | Student row with `students.view` | Existing Student Detail opens with correct student ID |
| Navigation | Student row without `students.view` | Row is readable and not interactive |
| Responsive structure | All critical sections | Pending, outstanding, and recent sections stay in DOM at all widths; CSS controls reflow rather than conditional rendering |
| Login 422 | Generic invalid credentials | Existing readable message remains |
| Login 429 | Backend rate-limit response | Exact backend message is shown in alert area, not converted to network error |
| Pending submit | Login promise unresolved | Button disabled and displays `Logging in...` |
| Duplicate submit | Fire two submits before state commit | One `/login` request is issued |
| Login success | Successful response | Existing authenticated application flow remains |

Frontend verification commands:

```text
npm test -- --run
npm run lint
npm run build
```

Run them from `frontend`. Existing tests are updated to the new contract; assertions are not weakened or deleted merely to obtain a passing result.

Browser verification uses the running application at 1440 x 900, 1180 x 820 or 1024 x 768, 820 x 1180 or 768 x 1024, and 390 x 844. It covers live values, zero data, API failure, loading, `422`, `429`, locked correct credentials, and successful login after a limiter clear. It checks page overflow, wrapping, focus, row target size, and that action-needed panels remain ahead of Recent Collections.

## 15. Expected files

Design artifact created at this gate:

- `docs/superpowers/specs/2026-07-22-dashboard-consistency-login-rate-limit-design.md`

Expected production and test files after second-gate approval:

### Backend

- `backend/app/Http/Controllers/Api/DashboardController.php`
- `backend/app/Http/Controllers/Api/AuthController.php`
- `backend/routes/api.php`
- `backend/database/seeders/DatabaseSeeder.php`
- `backend/database/migrations/2026_07_22_000001_add_dashboard_view_permission.php`
- `backend/config/business.php`
- `backend/.env.example`
- `backend/tests/Feature/DashboardApiTest.php`
- `backend/tests/Feature/DashboardPermissionMigrationTest.php`
- `backend/tests/Feature/AuthApiTest.php`
- `backend/tests/Feature/ApiWorkflowTest.php`

### Frontend

- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`

No new Dashboard service, school-resolver class, state-management library, route system, or Payment component is planned. `App.tsx` remains large, but extracting unrelated architecture during this focused consistency/security change would increase risk. A small local helper or type inside an already touched file is acceptable when it removes repetition and is directly tested.

The file count exceeds the gstack eight-file smell threshold because the completed change must cover authorization migration, seeding, backend data/security, frontend states/layout, and regression tests. Reducing the count would mean omitting an existing-database migration, test coverage, or client contract update. No extra production abstraction is introduced to justify the count.

## 16. Risks and mitigations

| Risk | User impact | Mitigation |
| --- | --- | --- |
| Seeder-only permission rollout | Preserved users receive `403` | Idempotent data migration runs before protected route; seeder remains for fresh DBs |
| Client attempts cross-school override | Financial data leakage | Authenticated school wins; all queries share resolved ID; explicit isolation tests |
| Global fallback selects unpredictably | User sees another active school on different runs | Order active schools by ID and return resolved school in response |
| UTC/Malaysia midnight mismatch | Today/month/year figures lag by a day | Focused business timezone plus year-boundary test; global UTC unchanged |
| Fee Record total/list diverge | Non-zero card with empty list | Derive total, count, and list from one service result |
| Pending amount counted as collected | Inflated collection figures | Status-scoped verified queries and mixed-status tests |
| Invoice functionality accidentally removed | Future invoice use breaks | Do not edit Invoice model/table/migrations/generation route; test only its non-influence on Dashboard |
| Fee summary materializes many rows | Slow Dashboard for a much larger school | One service call, eager-loaded existing relationships, five-row response; no duplicate call or cache. Reassess with measurements beyond MVP scale |
| Rate-limit key exposes username | Sensitive identifiers appear in cache keys | Hash normalized username and Laravel-resolved IP |
| Proxy headers spoofed manually | Attacker rotates apparent IP | Use `$request->ip()` and existing trusted-proxy handling only |
| Concurrent attempts cross the threshold | More than five attempts arrive nearly simultaneously | Use Laravel's native atomic cache increments and the approved precheck/hit sequence; no custom lock infrastructure in this task |
| Limiter tests contaminate each other | Order-dependent failures | Exact key clearing, array cache, and deterministic IP/time setup |
| Frontend double click beats state update | Duplicate Login requests | Synchronous ref guard plus disabled pending button |
| API failure looks like zero | Staff trust incorrect finance figures | Separate error state, clear stale data, show `Unavailable` |
| Partial backend/frontend deploy | Contract mismatch during release | Treat as one release: migration first, then backend and frontend together; no compatibility period with Invoice-shaped rows |
| Long names or currency wrap at tablet width | Lists/cards become hard to scan | 2 x 2 cards before 1024px, one-column panels, wrapping text, non-wrapping amounts, live browser QA |

No critical failure mode remains without both an error path and a planned test. The performance limit is explicit and acceptable for the current school-scale MVP; no unmeasured cache is added to financial data.

## 17. Explicit out-of-scope list

The implementation must not modify or add:

- seeded usernames, seeded passwords, or demo password behavior;
- public-demo scripts;
- Cloudflare configuration or trusted-proxy policy;
- session lifetime;
- global Laravel application timezone or UTC timestamp storage;
- Calendar date/time behavior;
- payment creation, allocation, verification, or void logic;
- receipt generation, viewing, printing, allocation, or void logic;
- Fee Record charge generation, cached-balance, category, month, or collection-status rules;
- Invoice tables, model, relationships, migrations, generation endpoint, or future invoice functionality;
- a school selector UI;
- an academic-year selector UI;
- a new standalone Payment module or page;
- charts, trends, forecasts, or marketing-style Dashboard widgets;
- Classes, Statements, Reminders, Reports, Export, PDF, or Parent Portal;
- a frontend routing rewrite, state-management rewrite, or broad `App.tsx` architecture refactor;
- CAPTCHA, permanent account lock columns, password reset, or account enumeration changes;
- caching or precomputed Dashboard tables without measured evidence;
- unrelated responsive changes to the application shell.

The Invoice module remains available for payment notices, monthly/term invoices, or future parent-facing documents. It is only removed as the current Dashboard's outstanding source.

No follow-up backlog item is added for these exclusions in this gate. They are deliberate product boundaries, not forgotten implementation work.

## 18. Implementation sequence

Implementation begins only after this written specification receives second-gate approval. The subsequent implementation plan will break these into test-first tasks. The design-level order is:

1. **Lock the backend contracts with failing tests.** Add Dashboard authorization, school isolation, timezone boundary, data-source, zero/failure, and pending/recent/outstanding tests. Extend Auth tests for the limiter contract.
2. **Add authorization data safely.** Create the idempotent `dashboard.view` data migration and migration tests; update the seeder for fresh databases.
3. **Add focused business-time configuration.** Create `config/business.php` and `.env.example` entry while asserting global UTC remains unchanged.
4. **Implement secure Dashboard resolution and response.** Protect the route, resolve school, derive business context, remove Dashboard Invoice queries, call Fee Record summary once, and return the new lists/counts.
5. **Implement Login throttling.** Use the normalized request value, hashed username/IP key, five-failure limit, `429` metadata, inactive counting, success clear, and unchanged session/logout behavior.
6. **Update workflow regression coverage.** Replace legacy Dashboard invoice assertions in `ApiWorkflowTest` while leaving invoice generation coverage intact.
7. **Lock frontend behavior with failing tests.** Replace the Dashboard contract fixture, add permission/request/state/panel/navigation tests, and add Login `429`/duplicate-submit tests.
8. **Implement frontend hierarchy and state handling.** Request the parameter-free endpoint only with permission; render four metrics and three ordered sections; use existing navigation paths; add safe errors and two-decimal Dashboard money.
9. **Implement scoped responsive styling.** Add Dashboard-only 1180px/640px card and panel rules, touch-friendly list rows, wrapping text, and stable amount columns.
10. **Run focused then full automation.** Use the repository PHP helper, frontend tests, lint, build, route list, and `git diff --check`.
11. **Run live browser QA.** Verify desktop, landscape/portrait tablet, mobile, loading, zero, error, `422`, `429`, lock, and successful login states.
12. **Run final engineering and design review.** Inspect the complete diff for scope leaks, Invoice preservation, school isolation, failure honesty, responsive regressions, and test integrity before any commit, push, or pull request decision.

The work is mostly sequential because backend and frontend converge on one response contract and `App.tsx`/`App.test.tsx` are shared hotspots. Backend migration/config and initial frontend test-fixture preparation can be developed independently, but merging parallel worktrees would create more coordination cost than time saved. The default implementation strategy is sequential.

## 19. Rollback considerations

The change has no finance-schema or destructive data migration. Rollback principles:

1. Deploy the permission migration before code that requires `dashboard.view`.
2. Roll backend and frontend as one contract release. Do not intentionally run a new frontend against the old response or the old frontend against the new response for an extended period.
3. If application code must be rolled back, leaving `dashboard.view` and `BUSINESS_TIMEZONE` in place is harmless. The older code simply does not use them.
4. The additive data migration does not delete its permission in `down()`. This prevents a rollback from destroying later custom role assignments.
5. The Invoice module remains intact, so a code rollback can restore the old Dashboard implementation without restoring tables or regenerated data.
6. No Payment, Receipt, Fee Record, Calendar, or Invoice records are rewritten by this change.
7. Rate-limit state is transient cache data with a 60-second decay. Rolling back the limiter leaves no persistent account-lock state.
8. If the new Dashboard fails after deployment, the frontend shows `Unavailable`; it does not silently fall back to legacy invoice metrics. Operational rollback is preferable to presenting contradictory data.
9. Before rollback, capture failing response/log evidence and confirm whether the fault is migration order, permission assignment, configuration, or contract deployment. Do not clear operational finance data.

## 20. Self-review findings

The written specification was reviewed against the approved brief, the current code, the fresh Product Design evidence, and the gstack architecture/code-quality/test/performance lenses.

### Findings folded into the design

1. **Global timezone blast radius:** The first proposal would have changed Laravel from UTC to Malaysia time. That could affect Calendar and persisted timestamp behavior. The final design uses `config/business.php` only and includes a UTC-to-Malaysia year-boundary test.
2. **Existing-database authorization gap:** Updating only `DatabaseSeeder` would lock preserved demo databases out of the protected endpoint. The final design includes an idempotent additive data migration plus a fresh-database seeder update.
3. **Invoice scope ambiguity:** Removing Invoice-shaped Dashboard data could be misread as deleting Invoice functionality. The final design explicitly preserves every Invoice table/model/migration/endpoint and tests only that Invoice values do not influence the Dashboard.
4. **School-bound validation ambiguity:** Validating a malicious override before ignoring it would make irrelevant client input affect an assigned user's request. The final algorithm ignores `school_id` entirely for school-bound users and validates it only for global users.
5. **Action hierarchy:** A three-equal-panel row would not distinguish work queues from history. The final hierarchy places Pending Verification and Students With Outstanding first as paired action panels, with Recent Collections below.
6. **1024px width failure:** The shared metric breakpoint at 900px occurs too late for the fixed shell. The final design adds a Dashboard-scoped 1180px 2 x 2 rule and collapses dense panels to one column at tablet widths.
7. **Failure honesty:** The current `demo` state name and catch path discard error context. The final state model separates loading, live, error, and no-access and clears stale data.
8. **Login double-submit race:** React's disabled state alone is asynchronous. The final design requires a synchronous ref guard and a test that observes one request for two immediate submits.
9. **Limiter privacy and proxy handling:** The final design hashes the normalized username/IP combination and relies only on Laravel's resolved request IP.
10. **Performance scope:** Fee Record summary materializes active charged students. The final design calls it once and accepts this measured-later MVP constraint instead of adding a second balance implementation or cache.

### Review checks

- Placeholder scan: no unresolved marker, incomplete section, or omitted branch remains.
- Internal consistency: Dashboard total, count, and list share one Fee Record summary result; Invoice preservation and Dashboard decoupling do not conflict.
- Scope: one implementation cycle can deliver the cross-layer change; no unrelated module or broad refactor is included.
- Security: route permission, server-side school scope, generic credential errors, hashed limiter keys, and framework-resolved IP are explicit.
- Testability: every conditional route, scope, date, status, limiter, client state, and navigation branch has a named deterministic test.
- Accessibility/design: action order, error announcement, keyboard semantics, touch targets, wrapping, and responsive reflow are specified; screenshot evidence alone is not treated as WCAG certification.
- Data safety: no operational finance data is migrated, deleted, or recalculated.
- Unresolved decisions: none. The document is ready for the second Superpowers approval gate, but implementation remains blocked until approval is explicit.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | ---: | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | Not run | Product direction was already fixed by the approved brief |
| Codex Review | `/codex review` | Independent second opinion | 0 | Not run | No separate outside-voice review was requested for this design-only gate |
| Eng Review | `/plan-eng-review` | Architecture, code quality, tests, performance | 1 | CLEAR | 10 findings folded into the specification; 0 critical gaps |
| Design Review | Product Design audit | Hierarchy, states, responsive behavior | 1 | CLEAR | Current inconsistency and Login error state captured; responsive risks folded into sections 10-12 |
| DX Review | `/plan-devex-review` | Developer experience | 0 | Not run | Project helper runtime and exact verification commands are documented |

**VERDICT:** Engineering and Product Design review clear the written specification for the user's second approval gate. This is not implementation authorization.

NO UNRESOLVED DECISIONS
