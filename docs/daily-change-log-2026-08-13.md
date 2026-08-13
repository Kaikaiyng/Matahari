# Change Log — 2026-08-13

**Product:** Matahari International School Administration, Finance, and Community System  
**Merged baseline:** `master` at `816ea1dd17812b22852f413465f9f7c3ec64e8fb`  
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

## Validation

- Community App: 3 Vitest files and 16 tests passed; Oxlint and production build passed.
- Admin Panel: 15 Vitest files and 169 tests passed; Oxlint exited 0 with 9 known Fast Refresh organization warnings; production build passed.
- Backend: 255 tests discovered, 247 passed, 8 opt-in MariaDB tests skipped, and 1,314 assertions; Pint passed; 74 API routes loaded.
- Deployment contracts: 18 tests passed.
- Responsive Community App QA: 39 role/page combinations across 360x800, 390x844, and 430x932; no horizontal overflow or undersized visible interactive targets remained.

The visual-refinement work did not change schema, so no new MariaDB lifecycle was run for that final slice. Earlier Phase A MariaDB evidence remains documented separately and is not production-database proof.

## Still Gated

- No inferred production academic dates, enrolment history, account links, or guardian portal activation.
- No Community persistence/media pipeline, Assessment publication, formal/Practice Quiz backend, payment reminders, or production Parent Finance.
- No Sanctum, Firebase, Capacitor, native authentication, push delivery, Android/iOS package, or store publication.
- No verified production hosting, remote promotion, monitoring, backup scheduling, restore drill, or production MariaDB upgrade.
