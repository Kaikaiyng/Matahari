# Matahari Admin Finance MVP

Matahari is an internal school administration finance system for Matahari International School. The current MVP replaces the most error-prone parts of spreadsheet-based fee administration with controlled student, charge, payment, and receipt workflows.

The application is demo-ready on desktop and responsive for iPad landscape, iPad portrait, and mobile portrait. It is not yet a complete school ERP or production deployment package.

## Implemented Modules

- Login, session authentication, role assignments, and permission-gated actions
- Student list, search, filters, create/edit, detail, and status updates
- Versioned Fee Agreements with Charge Type, Billing Pattern, and Jan-Dec billing configuration
- Fee Record charge preview and activation
- Manual and one-time charges
- Outstanding-charge payment allocation with partial amounts
- Payment history, verification, void safeguards, and allocation detail
- Receipt generation, viewing, browser printing, voiding, and regeneration
- Student Fee Record totals
- Fee Record Summary
- Category Monthly Fee Record with a horizontally scrollable Jan-Dec ledger

## Responsive Demo Support

| Viewport | Navigation and content behavior |
| --- | --- |
| Desktop, 1181px+ | Full sidebar and dense finance tables |
| iPad landscape, 1024-1180px | Compact labelled navigation rail |
| iPad portrait, 768-1023px | Drawer navigation and single-column task flow |
| Mobile, below 768px | Drawer navigation, stacked forms, mobile record rows, and contained ledgers |

Wide financial ledgers intentionally scroll inside their own containers. The page itself should not scroll horizontally.

## Technology

- Frontend: React 19, TypeScript 6, Vite 8, Lucide React, and project CSS
- Backend: Laravel 13 on PHP 8.4
- Database: SQLite for the repeatable local demo and automated tests; MariaDB remains supported for development environments
- Authentication: Laravel session cookies
- Authorization: roles, permissions, and middleware-enforced permission slugs

TailwindCSS, Docker, Nginx, Cloudflare, hosting, and deployment are planning directions, not current repository dependencies.

## Repository Layout

```text
frontend/   React admin application
backend/    Laravel JSON API and finance domain
docs/       Product, architecture, database, setup, UAT, and demo documentation
tools/php/  Project PHP configuration and Windows launch helpers
```

## Quick Start on Windows

Prerequisites:

- Node.js and `npm.cmd`
- PHP 8.4
- Backend dependencies already installed with Composer, or Composer available to install them
- SQLite for the simplest setup, or a local MariaDB database

Prepare a clean demo database from the repository root. This command resets only the ignored `backend/database/database.sqlite` file; it does not read, modify, or reset a configured MariaDB database:

```powershell
tools\php\reset-demo-sqlite.cmd
```

Start the backend:

```powershell
tools\php\serve-demo-backend.cmd
```

Start the frontend in another terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The frontend defaults to `http://127.0.0.1:8000/api`.

For a different API address, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

For iPad testing on the same LAN, bind both servers to `0.0.0.0` and set `VITE_API_BASE_URL` to the computer's LAN IP. Do not expose phpMyAdmin or database ports to the LAN.

See [Development Setup](docs/DEVELOPMENT_SETUP.md) for database options, seed data, LAN commands, and troubleshooting.

## Verification

Frontend:

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Backend:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
```

Last verified baseline on 2026-07-21:

- Frontend build: passed
- Frontend lint: zero errors and zero warnings
- Frontend tests: 59 tests passed
- Backend: 112 tests, 696 assertions
- Laravel API: 30 application routes
- Active local schema: 36 tables

## Documentation

| Document | Purpose |
| --- | --- |
| [Implementation Status](docs/IMPLEMENTATION_STATUS.md) | Implemented and deferred scope, verification, and known limitations |
| [Development Setup](docs/DEVELOPMENT_SETUP.md) | Local frontend, backend, database, and LAN demo setup |
| [System Architecture](docs/SYSTEM_ARCHITECTURE.md) | Runtime boundaries, authentication, RBAC, API inventory, and finance flow |
| [Database Design](docs/DATABASE_DESIGN.md) | Active table groups, relationships, constraints, and migration caveat |
| [UAT Checklist](docs/UAT_CHECKLIST.md) | Acceptance checks for implemented demo workflows |
| [Demo Review Script](docs/DEMO_REVIEW_SCRIPT.md) | Desktop/iPad/mobile demonstration sequence |
| [PRD](docs/PRD.md) | Historical product planning baseline |
| [Decision Log](docs/DECISIONS.md) | Historical product and technical decisions |
| [Roadmap](docs/ROADMAP.md) | Historical delivery plan and future direction |

Additional project documentation:

- Package guides: [Frontend README](frontend/README.md), [Backend README](backend/README.md)
- Historical planning: [Executive Summary](docs/EXECUTIVE_SUMMARY.md), [Architecture Review Plan](docs/ARCHITECTURE_REVIEW_PLAN.md), [Business Workflows](docs/BUSINESS_WORKFLOWS.md), [MVP Assumptions](docs/MVP_ASSUMPTIONS.md), [Implementation Backlog](docs/IMPLEMENTATION_BACKLOG.md), and [Stakeholder Questions](docs/STAKEHOLDER_QUESTIONS.md)
- Responsive delivery: [design](docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md) and [implementation plan](docs/superpowers/plans/2026-07-11-ipad-first-responsive-demo.md)
- MariaDB migration: [design](docs/superpowers/specs/2026-07-12-sqlite-to-mariadb-design.md) and [implementation plan](docs/superpowers/plans/2026-07-12-sqlite-to-mariadb.md)
- Documentation refresh: [design](docs/superpowers/specs/2026-07-12-project-documentation-refresh-design.md) and [implementation plan](docs/superpowers/plans/2026-07-12-project-documentation-refresh.md)

## Deferred Scope

The following are intentionally not implemented in this MVP:

- Statements and reminders
- General reports and exports
- PDF generation
- Parent Portal
- Production dashboard finance logic
- Hosting, deployment, domain, Docker, Nginx, and Cloudflare configuration
- New major school ERP modules

The existing receipt screen supports browser printing; that is separate from PDF generation.

## Known Limitations

- Real-device iPad Safari testing is still recommended even though the four target viewport sizes passed browser QA.
- Receipt print CSS was preserved, but native browser print-preview automation was unavailable during responsive QA.
- Fresh MariaDB setup needs special handling for one historical migration that creates `payment_allocations.fee_agreement_item_id` before `fee_agreement_items` exists. See [Database Design](docs/DATABASE_DESIGN.md).
- MariaDB and phpMyAdmin, when used for development, are local operator tools and are not part of a production deployment.

## Security

Never commit `.env` files, database passwords, phpMyAdmin credentials, real student data, or local backup files. The seeded accounts and sample data are for local development only.
