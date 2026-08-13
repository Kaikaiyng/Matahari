# MIS Community App

This is the independent mobile-first web workspace for Matahari International School Parent, Student, Teacher, and authorized Staff users. It has its own login, build, tests, deployment surface, and domain boundary. It shares the Laravel API and authoritative database with the Admin Panel; it does not share the Admin frontend runtime.

## Current Experience

- Role-aware floating liquid-glass navigation with distinct Parent, Student, Teacher, and Staff destinations.
- Community-style Home feed presentation with explicit preview labels where publishing is not connected.
- Live scoped Parent/Student identity and Attendance reads.
- Live assignment-scoped Teacher daily Attendance marking with correction reasons.
- Live Teacher Classes cards derived from the same current teaching assignments and scoped rosters used by Attendance.
- Read-only Parent finance backed by the existing finance source of truth; there is no payment interface.
- Preview-only academic results, Schedule, formal Quiz, Practice Quiz, and publishing surfaces.

Sign out is available from each role's More/Profile page. Admin/Finance/CEO operations remain in `frontend/`; Teacher-only, Parent-only, and Student-only accounts do not enter the Admin Panel. Parent Finance derives its requested academic year from the child's current enrolment and never displays a hard-coded preview balance as live data. Native authentication, push delivery, and store packaging are not part of the current web workspace.

## Local Development

```powershell
cd app
npm.cmd ci
npm.cmd run dev
```

The development server is fixed to port `5174`. Open `http://127.0.0.1:5174`; open Admin separately at `http://localhost:5173`. Those distinct local hosts keep their host-only session cookies separate. The App proxies same-origin browser requests under `/api` to `http://127.0.0.1:8000`. Override the backend target only in an ignored `.env.local`:

```dotenv
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
VITE_APP_ENVIRONMENT=staging
```

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Last verified on 2026-08-13: 3 Vitest files and 19 tests passed, Oxlint exited cleanly, and the TypeScript/Vite production build completed with 75 modules transformed. Automated responsive QA covered 39 role/page combinations at 360x800, 390x844, and 430x932 without horizontal overflow or undersized visible interactive targets.

## Deployment Boundary

Deploy `app/dist` on the App domain and reverse-proxy that domain's `/api` path to the shared Laravel backend. Deploy `frontend/dist` separately on the Admin domain with the same `/api` reverse-proxy pattern. This preserves browser session/CSRF behavior without exposing Laravel directly as a cross-site API.

There is no Capacitor, Firebase, Sanctum, native authentication, or store packaging in this workspace yet. Those remain separately approved future work.
