# School Admin System Frontend

The frontend is a React and TypeScript neutral administration/finance demo. It uses Vite, Lucide icons, and focused project CSS. The application is intentionally practical and data-dense rather than a consumer mobile app or marketing dashboard. Runtime product copy is centralized in `src/branding.ts`; a fresh disposable backend demo seed supplies the fictional `Demo International School` tenant.

The repository retains earlier internal project history as development evidence, but that history is not part of the neutral runtime identity or a claim of school affiliation. Do not use presentation changes to rename existing tenant data or historical receipt identifiers.

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
http://127.0.0.1:8000/api
```

Override it with `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Requests include credentials because authentication uses Laravel session cookies. The backend must allow the exact frontend origin when testing from another host or LAN address.

## Implemented Screens and Flows

- Login and session restoration
- Permission-aware application shell and navigation
- Dashboard collection metrics, Fee Record outstanding total, and explicit unavailable state
- Shared Calendar CRUD with responsive month/mobile layouts
- Read-only Classes directory and active-student rosters
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

Navigation entries for Dashboard, Parents, Fees, Invoices, Reports, and Settings include demo or future-phase content where their full backend modules are not implemented. See the root [Implementation Status](../docs/IMPLEMENTATION_STATUS.md) before treating a visible navigation item as complete.

## Responsive Behavior

- `1181px+`: full desktop sidebar
- `1024-1180px`: compact labelled rail for iPad landscape
- `768-1023px`: drawer navigation for iPad portrait
- Below `768px`: drawer navigation, stacked forms, mobile finance records, and contained ledger scrolling

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

`App.tsx` remains large and still owns most finance workflows. Add focused pages under `src/components/` when they can own their data and behavior without duplicating the Student Detail finance state.

## Verification

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd audit --audit-level=moderate
```

Last verified on 2026-08-04:

- Vitest passed 148 tests across 14 files.
- Oxlint completed with no reported diagnostics.
- TypeScript and the production build passed with 73 modules transformed.
- Production-only and complete-tree npm audits both reported 0 vulnerabilities.
- Local in-app browser QA covered 1440x900, 1180x820, 820x1180, and 390x844; real-device iPad Safari remains recommended.

The responsive acceptance details are in [the implemented responsive design](../docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md).
