# Change Log — 2026-08-13

**Product:** Matahari International School Administration, Finance, and Community System

**Merged baseline:** `master` at `ddd7e193179129be35f7a2b1c408eb809734f8d4`

**Status:** Development demo with implemented foundation and daily Attendance slices; not production-ready

## Delivered

- Separated the Admin Panel (`frontend/`) and multi-role Community App (`app/`) into independent builds and intended domains while retaining one Laravel API and authoritative database.
- Restored the Admin-only login experience and removed portal role surfaces from the Admin runtime.
- Added Parent, Student, Teacher, and authorized Staff Community App personas and role-aware navigation.
- Added a phone-first floating liquid-glass bottom navigation, compact header, calmer spacing, grouped record surfaces, and More/Profile sign out.
- Added the additive daily Attendance foundation, assignment-scoped Teacher marking, Parent/Student scoped reads, correction reasons, and transactional audit integration.
- Added separate deployment/release contracts for the Community App.
- Preserved Parent Finance as read-only with no payment interface.
- Preserved Community publishing/media, Assessments/results, Schedule, formal Quiz, and Practice Quiz generation as labelled previews or planned modules.
- Added 18 empty, additive storage-foundation tables for Community, Assessments/results, and formal/Practice Quiz without inferring or backfilling live records. Their services and APIs remain pending.
- Completed a cross-client role checkpoint: Admin is restricted to Super/School Admin, Finance, and CEO; Teacher/Parent/Student use the Community App; Teacher Classes uses live assignment-scoped APIs; Parent Finance uses the child's stored current academic year; preview-only controls no longer imply real mutations or fake balances.

## Validation

- Community App: 3 Vitest files and 16 tests passed; Oxlint and production build passed.
- Admin Panel: 15 Vitest files and 169 tests passed; Oxlint exited 0 with 9 known Fast Refresh organization warnings; production build passed.
- Backend: 255 tests discovered, 247 passed, 8 opt-in MariaDB tests skipped, and 1,314 assertions; Pint passed; 74 API routes loaded.
- Deployment contracts: 18 tests passed.
- Responsive Community App QA: 39 role/page combinations across 360x800, 390x844, and 430x932; no horizontal overflow or undersized visible interactive targets remained.
- Community App data-foundation qualification: local SQLite fresh/three-migration rollback/re-migrate preserved seeded base data and returned to 61 tables. GitHub run `31661265923` passed with backend 250 passed/10 SQLite skips/1,339 assertions, MariaDB 11.4 lifecycle plus 59 dedicated FK/index assertions, Admin 169 tests/build, App 16 tests/build, Pint, route loading, dependency audits, and deployment contracts.

The visual-refinement slice did not change schema. The later Community App data-foundation slice does change schema; its SQLite and MariaDB evidence is recorded in `docs/current-status.md` when validation completes.

## Still Gated

- No inferred production academic dates, enrolment history, account links, or guardian portal activation.
- No Community publishing/media pipeline, Assessment publication services, formal/Practice Quiz authoring/delivery/scoring APIs, payment reminders, or production Parent Finance. Storage foundations alone do not make these features live.
- No Sanctum, Firebase, Capacitor, native authentication, push delivery, Android/iOS package, or store publication.
- No verified production hosting, remote promotion, monitoring, backup scheduling, restore drill, or production MariaDB upgrade.
