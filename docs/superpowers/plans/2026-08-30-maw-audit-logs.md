# MAW-style Audit Trail and Application Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match RYLAY Audit Trail and Application Logs to the approved MAW operational-page design without weakening permissions, sanitization, or immutability.

**Architecture:** Extend the read-only Audit list response with search and global summary metadata, then rebuild both React pages around existing RYLAY APIs. Keep unsupported MAW operations absent and retain current pagination contracts.

**Tech Stack:** Laravel 13/PHPUnit; React 19/TypeScript/Vitest; existing AdminUi and Lucide components.

## Global Constraints

- Audit and Application Logs remain Super Admin-only and read-only.
- Render only server-sanitized data and real API capabilities.
- Do not modify `app/`, add packages, or add database migrations.

---

### Task 1: Audit read model

**Files:**
- Modify: `backend/app/Http/Requests/IndexAuditLogRequest.php`
- Modify: `backend/app/Http/Controllers/Api/AuditLogController.php`
- Test: `backend/tests/Feature/Audit/AuditLogApiTest.php`

- [ ] Add a validated `search` query and test action, actor, record and IP matching.
- [ ] Return global `total`, `today`, `active_actors_30_days`, and `security_admin` summary values in list metadata.
- [ ] Run `php artisan test tests/Feature/Audit/AuditLogApiTest.php`.

### Task 2: MAW-style Audit Trail

**Files:**
- Modify: `frontend/src/features/audit/AuditTrailPage.tsx`
- Modify: `frontend/src/features/audit/auditTypes.ts`
- Create: `frontend/src/features/audit/AuditTrailPage.css`
- Modify: `frontend/src/features/audit/AuditTrailPage.test.tsx`
- Modify: `frontend/src/App.css`

- [ ] Replace the modal presentation with the approved heading, summary, filters, dense table and inline inspector.
- [ ] Preserve cursor loading, error handling and unauthorized behaviour.
- [ ] Run the focused Audit Trail Vitest file.

### Task 3: MAW-style Application Logs

**Files:**
- Modify: `frontend/src/features/logs/ApplicationLogsPage.tsx`
- Modify: `frontend/src/features/logs/ApplicationLogsPage.css`
- Modify: `frontend/src/features/logs/ApplicationLogsPage.test.tsx`

- [ ] Apply the approved heading, level summary tabs, filter strip, dense table and dark inline context inspector.
- [ ] Keep existing search/date/level filters, refresh, pagination and sanitized response contract.
- [ ] Run the focused Application Logs Vitest file.

### Task 4: Documentation and proportional verification

**Files:**
- Modify: `docs/current-status.md`
- Modify: `docs/architecture.md`

- [ ] Record the new MAW-style operational workspace and unchanged security boundaries.
- [ ] Run focused backend and frontend tests, Admin lint, and Admin production build.
- [ ] Review the final diff and commit only intended files; leave `.idea/` untracked and do not push before owner confirmation.
