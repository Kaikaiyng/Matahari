# Returned Project Integration Design

## Goal

Integrate the useful attendance, gate, community, and UI work from `RYLAY_1708.zip` into the current repository without importing private or generated data and without weakening tenant, school-scope, audit, or historical-record guarantees.

## Boundaries

- Preserve the current CI workflows and repository configuration.
- Import only reviewed source, tests, and canonical documentation.
- Exclude `.env` files, databases, logs, tunnel state, uploaded media, `vendor`, `node_modules`, and build output.
- Keep `class_enrolments` as the attendance roster authority; `students.class_id` remains legacy-only.
- Treat `unmarked` as a display state, never a persisted attendance status.
- Restrict Admin attendance to `/api/v1/admin/attendance/*` with authenticated tenant and school context.
- Gate scans create an `in_progress` session, support entry only, and never overwrite an existing attendance decision.
- Community edits by non-moderators return published posts to review; post mutations and audit records are atomic.
- Community deletion is logical so posts, media, reports, and audit history remain available.
- Gate hardware signature authentication is outside this integration; the endpoint remains an authenticated Admin API.

## Verification

Run focused tests first, then backend PHPUnit, routes, Pint, Admin Vitest/Oxlint/build, App Vitest/Oxlint/build, deployment checks, migration checks where applicable, and a secret/generated-file review. MariaDB-only concurrency behavior is reported as not verified unless a disposable MariaDB instance is available.
