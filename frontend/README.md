# Matahari Admin Panel

The frontend is the Admin-only React and TypeScript administration/finance workspace for Matahari International School. School App functionality lives in the separate root `app/` workspace. At startup it fetches `/api/tenant-context`, requires an `admin` surface, and applies MIS labels, logo, colors and feature flags from the retained tenant configuration. Dedicated backend mode rejects every other tenant.

Do not use presentation changes to rename existing tenant data or historical receipt identifiers. Admin remains the desktop location for broad operational management, permission-sensitive finance actions, moderation, and audit review.

## Stack

- React 19
- TypeScript 6
- Vite 8
- Oxlint
- Lucide React
- CSS in `src/App.css` and `src/index.css`

TailwindCSS is not installed in the current frontend.

## Commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

Use `npm.cmd` on Windows when PowerShell blocks `npm.ps1`.

## API Configuration

`src/api.ts` defaults to:

```text
/api
```

Vite development and preview proxy that same-origin path to `http://127.0.0.1:8000` by default. To use another local backend target without changing the browser API origin, set `VITE_API_PROXY_TARGET` in the process environment before starting Vite. `vite.config.ts` reads `process.env`, so this setting is not loaded from `frontend/.env.local`:

```powershell
$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:8000'
npm.cmd run dev
```

Use `frontend/.env.local` only when intentionally setting `VITE_API_BASE_URL` to a direct or different API base:

```dotenv
VITE_API_BASE_URL=https://api.example.test/api
```

That topology may require explicit cross-origin and session-cookie configuration. Requests include credentials because authentication uses Laravel session cookies.

## Implemented Screens and Flows

- Login and session restoration
- Permission-aware application shell and navigation
- MAW-style grouped sidebar with aligned icons, animated group expansion, full desktop slide-away collapse, a persistent edge toggle, and a drawer below 1181px
- Dashboard collection metrics, Fee Record outstanding total, and explicit unavailable state
- Shared Calendar CRUD with responsive month/mobile layouts
- Attendance Hub with combined Overview/campus records, Class Register, device configuration, school settings, and per-student movement timelines
- Classes directory with active rosters and class-register deep links
- Schedule management and employee Position/User Abilities editing
- Student list, fee-period filtering, create, detail, and status workflow
- Fee Agreement create and supersede flows
- Billing configuration with Charge Type, Billing Pattern, and billing months
- Fee Record charge preview, activation, and warnings
- Manual Charge form
- Outstanding-charge payment picker and partial allocation
- Payment history, verification, and void controls
- Receipt history, receipt view, print, void, and regeneration
- Fee Record Summary
- Category Monthly Jan-Dec ledger
- Post Report management for School Updates
- Super Admin-only Audit Trail and sanitized Application Logs
- Shared MIS-styled date, time, and select controls instead of visible browser-native popups in supported Admin forms

Parents and Fees still expose limited foundation/display content rather than complete management workflows. Payments and Receipts remain implemented inside Student Detail, and removed placeholder navigation must not be treated as a hidden module. See [Implementation Status](../docs/IMPLEMENTATION_STATUS.md) before treating any visible navigation item as complete.

## Responsive Behavior

- `1181px+`: full 256px sidebar that slides completely away with a persisted collapse preference and edge-mounted restore control
- `1180px` and below: off-canvas drawer with backdrop, focus-safe close behavior, and no compact intermediate rail
- Below `681px`: compact utility header plus stacked forms, mobile records, and contained ledger scrolling

Touch-oriented controls use 44px targets on tablet/mobile. Wide finance ledgers keep readable column widths and scroll inside `.table-wrap` containers.

## Main Files

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Current application state, screens, forms, tables, and responsive navigation markup |
| `src/App.css` | Product styling, breakpoints, drawer, forms, finance records, receipt, and print rules |
| `src/index.css` | Root containment, typography, and focus-visible foundation |
| `src/api.ts` | API base URL, credentialed JSON requests, and error normalization |
| `src/components/CalendarPage.tsx` | Shared calendar loading, display, create/edit/delete, and time conversion |
| `src/components/ClassesPage.tsx` | Class directory, active rosters, and Student Detail handoff |
| `src/components/AdminShell.tsx` | Responsive application shell and navigation behavior |
| `src/components/AdminUi.tsx` | Shared admin page, panel, status, and data-display primitives |
| `src/components/SystemDateTimePicker.tsx` | Shared styled date/time picker used instead of browser-native popup UI |
| `src/features/attendance/AttendanceHubPage.tsx` | Campus and class Attendance workspace, devices, settings, and timelines |
| `src/features/logs/ApplicationLogsPage.tsx` | Sanitized, filtered, read-only Laravel application log viewer |

`App.tsx` remains large and still owns most finance workflows. Add focused pages under `src/components/` when they can own their data and behavior without duplicating the Student Detail finance state.

## Verification

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd audit --audit-level=moderate
```

Latest integrated feature-branch validation on 2026-08-25:

- Vitest passed 187 tests.
- Oxlint exited 0 with 9 existing `react(only-export-components)` Fast Refresh organization warnings in `CalendarViews.tsx`.
- TypeScript and the production build passed.
- Dependency audits were not rerun in the final School Updates correction; rerun both audit commands for release evidence because registry state changes over time.

The responsive acceptance details are in [the implemented responsive design](../docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md).
