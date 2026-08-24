# RYLAY School App

This is the independent mobile-first web workspace for Parent, Student, and Teacher users of the active SaaS tenant. Higher employee access remains within the Teacher persona through explicit User Abilities. The App has its own login, build, tests, deployment surface, and domain boundary. It fetches `/api/tenant-context`, requires an `app` surface, and applies tenant branding/features. It shares the Laravel API and authoritative database with the Admin Panel but not its frontend runtime.

## Current Experience

- Role-aware floating liquid-glass navigation with distinct Parent, Student, and Teacher destinations.
- Live School Updates: visible users can read and Like posts; eligible readers who are neither the author nor a Post manager may report them. Teachers with `community.publish` can publish immediately to the whole school or multiple classes with images and optional audience notifications.
- Live scoped Parent/Student identity and Attendance reads.
- Live assignment-scoped Teacher daily Attendance marking with correction reasons.
- Live Teacher Classes cards derived from the same current teaching assignments and scoped rosters used by Attendance.
- Read-only Parent finance backed by the existing finance source of truth; there is no payment interface.
- Live Schedule, formal Quiz, Assessment publication/results, and School Updates surfaces; Practice Quiz generation remains planned.

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

See the root [Current Status](../docs/current-status.md) and [Testing and Release](../docs/testing-and-release.md) documents for current verification evidence and explicit limitations.

## Deployment Boundary

Deploy `app/dist` on the App domain and reverse-proxy that domain's `/api` path to the shared Laravel backend. Deploy `frontend/dist` separately on the Admin domain with the same `/api` reverse-proxy pattern. This preserves browser session/CSRF behavior without exposing Laravel directly as a cross-site API.

There is no Capacitor, Firebase, Sanctum, native authentication, or store packaging in this workspace yet. Those remain separately approved future work.
