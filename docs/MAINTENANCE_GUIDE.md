# Maintenance Guide

Status: Current contributor reference

Last verified: 2026-08-13

This guide identifies where behavior lives, what must change together, and which checks provide evidence before a change is published.

## 1. Source-of-truth order

When documentation and implementation disagree, use this order:

1. Executable code, migrations, configuration, and generated framework output.
2. Automated tests that exercise the current code.
3. Current references listed in [Documentation Index](README.md).
4. Approved feature designs and implementation plans.
5. Historical PRD, roadmap, backlog, discovery, and assumptions.

Do not implement a `TBD` business rule without stakeholder approval. Record the decision in the business-rules document or a new approved design first.

## 2. Repository ownership map

| Area | Primary locations |
| --- | --- |
| React application shell and most finance screens | `frontend/src/App.tsx`, `frontend/src/App.css` |
| Focused frontend pages | `frontend/src/components/CalendarPage.tsx`, `ClassesPage.tsx`, `AdminShell.tsx`, `AdminUi.tsx` and matching CSS/tests |
| Frontend HTTP transport | `frontend/src/api.ts` |
| Community App shell and role views | `app/src/App.tsx`, `app/src/components/MobileShell.tsx`, `CommunityFeed.tsx`, and role portal views |
| Community App HTTP transport | `app/src/api.ts`, `app/src/api/portalApi.ts` |
| API route registry | `backend/routes/api.php` |
| API controllers | `backend/app/Http/Controllers/Api/` |
| Input validation | `backend/app/Http/Requests/` |
| Finance/domain operations | `backend/app/Services/` |
| Persistence and relationships | `backend/app/Models/`, `backend/database/migrations/` |
| Roles, permissions, classes, and demo scenarios | `backend/database/seeders/` |
| Backend regression tests | `backend/tests/Feature/`, `backend/tests/Unit/` |
| Public-demo launcher | `tools/public-demo/` |
| Local PHP/demo helpers | `tools/php/` |

## 3. API architecture

All current Laravel API route declarations are registered in `backend/routes/api.php`. `backend/bootstrap/app.php` loads that file as the API route file, so Laravel applies the `/api` prefix.

The route file is only the registry. Keep responsibilities separated:

```text
backend/routes/api.php
  -> controller action
  -> Form Request validation (when applicable)
  -> service transaction/domain logic
  -> Eloquent models and database
```

The frontend centralizes base URL, session credentials, JSON parsing, and normalized errors in `frontend/src/api.ts`. Endpoint-specific requests currently live in `frontend/src/App.tsx`, `CalendarPage.tsx`, and `ClassesPage.tsx`.

When adding or changing an endpoint:

1. Update `backend/routes/api.php` and use the existing authenticated/permission middleware groups.
2. Put validation in a Form Request instead of duplicating it in controllers.
3. Keep multi-record finance mutations in a service transaction with appropriate row locks.
4. Add or update a backend feature test for authentication, authorization, school scope, validation, success, and invalid state transitions.
5. Update the frontend caller and its loading, empty, 401/403, 422, and server-error behavior.
6. Regenerate the route inventory and update `SYSTEM_ARCHITECTURE.md` if the public API changed.

Authoritative route command:

```powershell
cd backend
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

## 4. Change map

| If you change... | Review/update together |
| --- | --- |
| Authentication or session payload | `AuthController`, `LoginRequest`, `User`, login/session frontend code, `AuthApiTest`, CORS/session docs |
| Permission slug or role assignment | `DatabaseSeeder`, route middleware, frontend `hasPermission` checks, role tests, UAT role matrix |
| Student/class fields | Migration/model, store/update requests, controller resource payload, forms/tables, student/class tests |
| Fee Agreement rules | Request concern, versioning service, agreement controllers, preview/generation services, agreement and charge tests |
| Fee Record calculations | Billing services, Dashboard if it consumes the summary, Student/Fee Record screens, summary/category tests |
| Payment or receipt states | Billing services, controllers/requests, Student Detail actions, void guards, receipt/payment tests, workflow docs |
| Calendar behavior | Calendar migration/model/controller/requests, seeder permissions, `CalendarPage`, API/frontend tests |
| Academic foundation or portal links | Additive migration, Phase A models/policies/access services, `/api/v1` permission, cross-school tests, and canonical schema/permission docs |
| Attendance behavior | Attendance migration/models/service/controller, teaching assignment and guardian/student scope, transactional audit, App role view, and backend/App tests |
| Community App navigation or visual system | `app/src/components/MobileShell*`, role views, `DESIGN.md`, App tests/build, and 360/390/430px viewport checks |
| Public-demo ports, proxy, tunnel, or binary | `PublicDemo.psm1`, thin start/stop scripts, launcher contract tests, `PUBLIC_DEMO.md` |
| Environment variable | `.env.example` where appropriate, Vite/Laravel config, setup docs; never commit a populated `.env` |

## 5. Local workflows

Repeatable SQLite demo from the repository root:

```powershell
tools\php\reset-demo-sqlite.cmd
tools\php\serve-demo-backend.cmd
```

Frontend in a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The reset command intentionally rebuilds `backend/database/database.sqlite`. Do not run it when preserving current demo changes matters. It does not reset a configured MariaDB database.

For temporary HTTPS access, follow [Temporary Public Demo](PUBLIC_DEMO.md). The public-demo launcher preserves SQLite data between runs and exposes only Vite Preview through the tunnel.

## 6. Verification before publishing

Run the relevant focused test while developing, then run the full baseline before publishing:

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build

cd ..\backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

For public-demo changes, also run the PowerShell tests when Pester is available:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Pester -Path 'tools\public-demo\tests'"
```

`ExecutionPolicy Bypass` applies only to that child process; do not weaken the machine-wide policy.

Use `git status -sb` and `git diff --check` before committing. Stage files explicitly so local database files, `.env`, `frontend/test-results/`, `.demo-public/`, or unrelated user work are not included.

## 7. Documentation maintenance

Update documentation in the same pull request as the behavior it describes:

- `README.md`: user-visible capabilities, quick start, top-level links, and verified baseline.
- `docs/IMPLEMENTATION_STATUS.md`: shipped/deferred scope and evidence.
- `docs/SYSTEM_ARCHITECTURE.md`: boundaries, security model, API inventory, and data flow.
- `docs/DATABASE_DESIGN.md`: schema or integrity changes.
- `docs/DEVELOPMENT_SETUP.md`: commands, prerequisites, environment variables, and troubleshooting.
- Package README: package-specific commands and ownership.
- `docs/UAT_CHECKLIST.md`: a manual acceptance step for user-visible behavior.

Keep counts tied to fresh command output and date the evidence. Do not rewrite historical plans to look current; link to the current reference or add a correction note.

## 8. Pull-request checklist

- [ ] Scope is clear and unrelated working-tree files are excluded.
- [ ] New behavior has focused tests and the full relevant baseline passes.
- [ ] Authentication, permission, and school-scope failure paths were checked.
- [ ] Financial mutations remain transactional and preserve history/audit fields.
- [ ] Frontend loading, empty, permission, validation, and service-error states are covered.
- [ ] Current docs and UAT were updated where public behavior changed.
- [ ] No secret, credential, real student data, database file, tunnel state, or generated test artifact is staged.
- [ ] `git diff --check` and the intended test/build commands pass from the final diff.
