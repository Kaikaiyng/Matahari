# System Architecture

Status: Current implementation reference

Last updated: 2026-08-12

This file primarily describes the implemented Admin Web runtime. The independent `app/` workspace now provides the mobile-first Parent/Student web client; it shares this Laravel API and authoritative database but has its own domain and build. Native store packaging is not implemented. See [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md).

## 1. Runtime Topology

```text
Admin domain                 Parent/Student App domain
frontend/ build              app/ build
          \                    /
           \ same-origin /api /
            v                v
                Laravel 13
                     |
                     | Eloquent / transactions
                     v
        SQLite repeatable demo / MariaDB production direction
```

The diagram above means the current Admin frontend is responsive. It does not claim that the Phase B Mobile Web client or a native app exists.

SQLite remains available for new-contributor setup, test isolation, and rollback. `backend/phpunit.xml` uses SQLite `:memory:` so automated tests do not modify the active demo database.

Deployment, Cloudflare, Docker, Nginx, domains, hosting, and TLS are not implemented in this repository.

## 2. Frontend Boundary

Stack:

- React 19
- TypeScript 6
- Vite 8
- Lucide React
- Project CSS

Main files:

- `frontend/src/App.tsx`: application shell, page state, screens, finance forms, and tables
- `frontend/src/App.css`: visual system, responsive breakpoints, receipt screen, and print styles
- `frontend/src/index.css`: root containment and focus foundation
- `frontend/src/api.ts`: credentialed JSON requests and normalized API errors
- `frontend/src/components/CalendarPage.tsx`: calendar data, forms, timezone conversion, and responsive presentation
- `frontend/src/components/ClassesPage.tsx`: class directory and active-student rosters
- `frontend/src/components/AdminShell.tsx`: responsive application shell and navigation
- `frontend/src/components/AdminUi.tsx`: shared admin display primitives

The frontend may calculate display previews and allocation totals, but Laravel remains authoritative for validation, permissions, statuses, receipt numbers, and persisted financial effects.

## 3. Responsive Layout Architecture

| Width | Shell behavior |
| --- | --- |
| 1181px+ | Full 280px sidebar and desktop table density |
| 1024-1180px | Compact 88px labelled navigation rail |
| 768-1023px | Fixed drawer navigation and single-column task flow |
| Below 768px | Drawer, stacked forms, mobile record rows, and contained ledgers |

Wide Fee Record tables are deliberate scroll regions. Responsive CSS must not widen the document or override `@media print` receipt rules.

## 4. Backend Boundary

Laravel responsibilities:

- Session authentication and current-user response
- Permission middleware and finance action authorization
- Student/class validation, lookup, and status changes
- School-scoped calendar event validation and CRUD
- Fee Agreement versioning
- Charge preview, activation, manual charges, and outstanding calculation
- Payment allocation, verification, and void reversal
- Receipt sequence, snapshots, print data, and void/regeneration behavior
- Fee Record Summary and Category Monthly aggregation

The current code follows Laravel controller/model/service patterns without a broad state-management or module-framework layer.

## 5. Authentication and Authorization

Authentication flow:

```text
POST /api/login
  -> normalized lowercase username + password
  -> encrypted cookie + database-backed Laravel session
  -> GET /api/me restores current user
  -> frontend renders permission-aware navigation/actions
```

Protected finance routes apply:

```text
EncryptCookies
AddQueuedCookiesToResponse
StartSession
auth
permission:<permission-slug>
```

Examples:

- `students.view`
- `fee_agreements.create`
- `fee_record.generate`
- `payments.verify`
- `receipts.void`
- `receipts.print`

Frontend permission checks are usability controls, not the security boundary. The backend must reject unauthorized requests.

The default session lifetime is 480 minutes (8 hours) of inactivity. `SESSION_EXPIRE_ON_CLOSE=false`, so closing the browser does not itself invalidate the server-side session.

### Legacy endpoint boundary

`GET /api/dashboard/school` and `POST /api/invoices/generate-monthly` are retained from the initial scaffold. They now run inside the session and `auth` middleware group, but they do not have a more specific permission slug. The Dashboard outstanding-total metric uses Fee Record charges; other invoice-oriented dashboard fields and monthly invoice generation remain legacy/backend-only behavior.

## 6. Finance Data Flow

```text
Student
  -> Fee Agreement (versioned configuration)
  -> Fee Agreement Items (amount and billing pattern)
  -> Fee Record Preview
  -> Activated Fee Record Charges
  -> Outstanding Charge Selection
  -> Payment Allocations
  -> Payment Verification / Void
  -> Receipt / Receipt Items
  -> Fee Record Summary and Category Monthly views
```

### Fee Agreement

- A student can have historical versions.
- One version is current for the selected academic year.
- Superseding creates a new version rather than overwriting history.
- Items store charge identity, amount, classification, frequency, months, and preview-confirmation behavior.

### Fee Record charges

- Preview derives proposed charges from the agreement.
- Activation persists expected charges.
- Manual charges use the same expected/outstanding model with a manual origin.
- Summary and category-monthly views read charge and valid-allocation state.

### Payment allocation

- A payment belongs to a student and school.
- Allocation rows connect money to outstanding Fee Record charges.
- Partial allocation is supported.
- Selected allocation total must match the payment amount.
- Manual allocation is an exceptional path and does not pretend to clear unrelated charge balances.

### Receipts

- Receipt generation starts from an eligible payment.
- A payment may have only one issued receipt; a repeated generation attempt is rejected until that receipt is voided.
- Receipt numbers come from a backend sequence.
- Receipt items snapshot the issued descriptions and amounts.
- Voided numbers are never recycled.
- An active receipt protects its payment from unsafe voiding.

## 7. API Inventory

The authoritative command is:

```powershell
cd backend
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Current route count: 35.

### Auth and legacy dashboard

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/login` | Start session |
| POST | `/api/logout` | End session |
| GET | `/api/me` | Current authenticated user |
| GET | `/api/dashboard/school` | Legacy school dashboard data |
| POST | `/api/invoices/generate-monthly` | Legacy invoice-generation endpoint |

### Students

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/students` | List/search/filter students |
| POST | `/api/students` | Create student |
| GET | `/api/students/{student}` | Student detail |
| PATCH | `/api/students/{student}` | Update student |
| PATCH | `/api/students/{student}/status` | Change student status |
| GET | `/api/classes` | List the configured school class catalog |

### Calendar

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/calendar-events` | List events overlapping a visible date range |
| POST | `/api/calendar-events` | Create a school-scoped event |
| PATCH | `/api/calendar-events/{calendarEvent}` | Update an event in scope |
| DELETE | `/api/calendar-events/{calendarEvent}` | Delete an event in scope |

### Fee Agreements and items

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/fee-items` | List available fee items |
| GET | `/api/students/{student}/fee-agreements` | Agreement history/current version |
| POST | `/api/students/{student}/fee-agreements` | Create agreement |
| GET | `/api/fee-agreements/{feeAgreement}` | Agreement detail |
| POST | `/api/fee-agreements/{feeAgreement}/supersede` | Create replacement version |

### Fee Record

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/students/{student}/fee-record/preview` | Preview scheduled charges |
| POST | `/api/students/{student}/fee-record/activate` | Activate previewed charges |
| POST | `/api/students/{student}/fee-record/manual-charges` | Add manual charge |
| GET | `/api/students/{student}/fee-record/outstanding` | Outstanding charge picker data |
| GET | `/api/fee-record/summary` | Student Fee Record summary |
| GET | `/api/fee-record/category-monthly` | Category Jan-Dec ledger |

### Payments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/students/{student}/payments` | Payment history |
| POST | `/api/students/{student}/payments` | Create and allocate payment |
| POST | `/api/payments/{payment}/verify` | Verify pending payment |
| POST | `/api/payments/{payment}/void` | Void eligible payment |

### Receipts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/students/{student}/receipts` | Receipt history |
| POST | `/api/payments/{payment}/receipts` | Generate receipt; reject an active duplicate |
| GET | `/api/receipts/{receipt}` | Receipt detail |
| GET | `/api/receipts/{receipt}/print` | Printable receipt response |
| POST | `/api/receipts/{receipt}/void` | Void receipt |

## 8. Database Boundary

The active model contains 36 application and Laravel infrastructure tables. Every financial amount uses database decimal columns and application decimal/cents handling rather than floating-point business calculations.

Important integrity controls:

- School and student ownership foreign keys
- Current/version constraints for Fee Agreements
- Duplicate-charge prevention indexes
- Payment allocation foreign keys
- Unique receipt number and sequence rules
- Status and void metadata rather than hard deletion

See [Database Design](DATABASE_DESIGN.md) for table groups and relationships.

## 9. Error and State Handling

- API validation returns HTTP 422 with field messages.
- Unauthenticated and unauthorized requests return 401/403.
- Frontend errors remain within the affected form or section where practical.
- Buttons expose submitting/loading states.
- Empty lists and unavailable finance data have explicit messages.
- Financial warnings remain visible until the user resolves or acknowledges them.

## 10. Test Architecture

- Feature tests exercise auth/username migration, students/classes, calendar, agreements, charge preview/activation, manual charges, allocations, payments, void guards, receipts, dashboard, summary, and category monthly APIs.
- Unit tests cover amount-in-words behavior.
- PHPUnit uses SQLite `:memory:` for isolation.
- Use the dated baseline in [Implementation Status](IMPLEMENTATION_STATUS.md); regenerate it rather than copying an older count.

## 11. Deferred Architecture

- Statements and reminders
- General reports and export pipelines
- PDF generation
- Parent Portal
- Remaining production dashboard/invoice reporting beyond the implemented Fee Record outstanding total
- Queue-driven communication workflows
- Production deployment and network architecture

These should be designed as separate phases after the current finance flow passes real-device and school UAT.
