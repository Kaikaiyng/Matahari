# Demo Readiness Hardening Implementation Plan

> Execute this plan in the existing workspace while preserving unrelated user files. Use red-green-refactor for behavior changes and verify each batch before moving on.

**Goal:** Deliver a clean, safe, responsive demo with realistic finance data and a repeatable local SQLite startup path.

**Architecture:** Keep the existing React single-page structure and Laravel API. Extract only small testable helpers/components where needed, add a Vitest/jsdom harness, extend the existing Laravel seeding layer with a dedicated scenario seeder, and wrap local demo initialization in explicit Windows scripts.

**Tech stack:** React 19, TypeScript, Vite 8, Vitest, Testing Library, Laravel, PHPUnit, SQLite.

---

## Task 1: Establish frontend regression tests

**Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.ts`, `frontend/src/test/setup.ts`, `frontend/src/api.test.ts`, `frontend/src/App.test.tsx`

1. Add Vitest, jsdom, and Testing Library dependencies plus a `test` script.
2. Add jsdom test configuration and jest-dom setup.
3. Write a failing API test proving 5xx response details are hidden.
4. Write failing component tests proving unfinished destinations are absent and selected students use a dedicated detail view.
5. Run each test and confirm it fails for the intended missing behavior.

## Task 2: Harden API and demo-facing shell

**Files:** `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/App.css`

1. Sanitize 5xx errors while preserving safe 4xx messages.
2. Limit navigation to implemented demo modules.
3. Remove disabled search, notification, role/debug, MVP, and future-phase copy.
4. Render a concise service warning only when the API is unavailable.
5. Run frontend tests until green.

## Task 3: Improve student detail and payment flow

**Files:** `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/App.test.tsx`

1. Add or refine the failing detail-transition test.
2. Render either the student list or the selected student workspace, never both.
3. Add a clear Back to students action and direct detail loading from Fee Record.
4. Fix the `loadStudents` hook dependency without creating request loops.
5. Ensure payment controls and forms stack cleanly on narrow screens.
6. Run focused tests, lint, and TypeScript checks.

## Task 4: Polish Fee Record

**Files:** `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/App.test.tsx`

1. Add a failing rendered-text/structure test for business-facing summaries.
2. Apply metric-card structure to summary items.
3. Replace mapper/read-only/internal abbreviations with plain operational labels.
4. Improve sticky identifying columns, nowrap behavior, and scroll affordance.
5. Run focused tests and lint.

## Task 5: Seed realistic demo scenarios

**Files:** `backend/database/seeders/DemoScenarioSeeder.php`, `backend/database/seeders/DatabaseSeeder.php`, `backend/tests/Feature/DemoScenarioSeederTest.php`

1. Write a failing feature test requiring clean named students with unpaid, paid/receipted, partial, and unconfigured states.
2. Add the dedicated seeder using existing billing services and models.
3. Call it from `DatabaseSeeder` after base records are created.
4. Run the focused feature test, then the complete backend suite.

## Task 6: Make demo reset and startup safe

**Files:** `tools/php/reset-demo-sqlite.cmd`, `tools/php/serve-demo-backend.cmd`, `README.md`, `docs/DEVELOPMENT_SETUP.md`

1. Add a reset script hard-pinned to `backend/database/database.sqlite` with SQLite, file sessions, and debug disabled.
2. Add a server wrapper using the same safe environment and bundled php.ini.
3. Update documentation to make the safe demo commands the primary Windows demo path and clearly state what is reset.
4. Run the reset command and verify the seeded API database.

## Task 7: Full verification and live QA

1. Run frontend tests, lint, TypeScript build, and production build.
2. Run the full backend test suite.
3. Reset the local demo database and start both services.
4. Browser-test sign-in, Dashboard, Students list/detail/back, payment form, Fee Record, and service-error presentation.
5. Repeat layout checks at desktop, iPad portrait, and 390px mobile widths.
6. Review the final diff for scope, debug artifacts, and accidental user-file changes.
