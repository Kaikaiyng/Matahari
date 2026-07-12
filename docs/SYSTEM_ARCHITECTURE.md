# System Architecture

Status: Current implementation reference

Last updated: 2026-07-12

## 1. Runtime Topology

```text
Desktop / iPad / Mobile Browser
              |
              | HTTP + Laravel session cookie
              v
React + TypeScript frontend (Vite)
              |
              | JSON API
              v
Laravel 13 application
              |
              | Eloquent / transactions
              v
MariaDB local demo database
```

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
- Student validation and status changes
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

### Current security limitation

The legacy `GET /api/dashboard/school` and `POST /api/invoices/generate-monthly` routes are registered outside the authenticated finance route group. They are retained from the initial scaffold and must not be treated as production-secure endpoints. Production hardening must either protect or remove them before deployment.

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
- Active receipt generation is idempotent for the same payment.
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

Current route count: 30.

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
| POST | `/api/payments/{payment}/receipts` | Generate/reuse receipt |
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

- Feature tests exercise auth, students, agreements, charge preview/activation, manual charges, allocations, payments, void guards, receipts, summary, and category monthly APIs.
- Unit tests cover amount-in-words behavior.
- PHPUnit uses SQLite `:memory:` for isolation.
- Last verified baseline: 92 tests and 597 assertions.

## 11. Deferred Architecture

- Statements and reminders
- General reports and export pipelines
- PDF generation
- Parent Portal
- Production dashboard finance logic
- Queue-driven communication workflows
- Production deployment and network architecture

These should be designed as separate phases after the current finance flow passes real-device and school UAT.
