# Matahari Frontend

The frontend is a React and TypeScript admin application for the Matahari Finance MVP. It uses Vite, Lucide icons, and focused project CSS. The application is intentionally practical and data-dense rather than a consumer mobile app or marketing dashboard.

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
- Student list, create/edit, detail, and status workflow
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

`App.tsx` is intentionally still large. Broad routing or state-management refactors are outside the current MVP stabilization work.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
```

Last verified on 2026-07-12:

- Build passed
- Lint reported zero errors and one existing `react-hooks/exhaustive-deps` warning for `loadStudents`
- Browser QA covered 1440x900, 1180x820, 820x1180, and 390x844

The responsive acceptance details are in [the implemented responsive design](../docs/superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md).
