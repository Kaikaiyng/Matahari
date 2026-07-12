# Project Documentation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the GitHub README and documentation set with the implemented Matahari Admin Finance MVP, then publish and merge the verified documentation pull request.

**Architecture:** Treat the root and package README files plus current-state reference documents as authoritative, while preserving early planning documents with historical notices. Cross-check every factual statement against repository code, generated route output, migrations, tests, and package manifests; publish only explicitly staged, secret-free documentation.

**Tech Stack:** Markdown, React 19, TypeScript 6, Vite 8, Laravel 13, PHP 8.4, MariaDB, SQLite, Git, GitHub CLI.

## Global Constraints

- Do not publish local MariaDB, root, phpMyAdmin, or application passwords.
- Do not stage `.gstack/`, `backend/database/on`, `docs/business-rules/`, or `frontend/test-results/`.
- Preserve early planning content; add status notices instead of rewriting its decision history.
- State Reports, Export, PDF, Parent Portal, production dashboard finance logic, deployment, hosting, domain, and Cloudflare work as deferred.
- Use explicit file staging and merge through a GitHub pull request targeting `master`.

---

### Task 1: Audit tracked documentation against implementation

**Files:**
- Read: every tracked `*.md` file returned by `git ls-files '*.md'`
- Read: `frontend/package.json`
- Read: `backend/composer.json`
- Read: `backend/routes/api.php`
- Read: `backend/database/migrations/*.php`
- Read: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: tracked documentation and implementation facts.
- Produces: a file-by-file Diataxis coverage map and a list of factual contradictions to correct.

- [ ] Read the complete tracked Markdown corpus without editing it.
- [ ] Record current framework versions, 30 API routes, implemented navigation/screens, 36 database tables, and the backend test baseline.
- [ ] Classify each document as current-state reference/how-to or historical planning.
- [ ] Identify secret-like values and ensure none are selected for publication.

### Task 2: Replace project entry-point documentation

**Files:**
- Modify: `README.md`
- Modify: `frontend/README.md`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes: the Task 1 implementation inventory.
- Produces: accurate entry points for product scope, frontend development, and backend development.

- [ ] Rewrite `README.md` with current modules, supported viewports, stack, quick start, verification, documentation map, deferred scope, and known limitations.
- [ ] Replace the Vite template `frontend/README.md` with project structure, commands, API environment, implemented screens, responsive behavior, and testing guidance.
- [ ] Replace the Laravel template `backend/README.md` with local configuration, authentication/RBAC, module/API overview, database options, test commands, and operational constraints.
- [ ] Verify every relative link and command named by the three README files exists in the repository.

### Task 3: Refresh current-state operational documentation

**Files:**
- Modify: `docs/DEVELOPMENT_SETUP.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/DEMO_REVIEW_SCRIPT.md`
- Modify: `docs/UAT_CHECKLIST.md`

**Interfaces:**
- Consumes: the current modules and commands documented in Task 2.
- Produces: executable setup, status, demo, and acceptance guidance.

- [ ] Rewrite setup instructions for project-local PHP, frontend commands, MariaDB/SQLite configuration, localhost/LAN startup, and verification.
- [ ] Rewrite implementation status with completed modules, exact verification baseline, responsive QA state, deferred scope, and known limitations.
- [ ] Rewrite the demo script around the implemented login-to-ledger workflow on desktop, iPad, and mobile.
- [ ] Rewrite UAT around implemented behaviors and move unimplemented reports/export/PDF expectations into an explicit deferred section.

### Task 4: Refresh architecture and database references

**Files:**
- Modify: `docs/SYSTEM_ARCHITECTURE.md`
- Modify: `docs/DATABASE_DESIGN.md`

**Interfaces:**
- Consumes: Laravel routes, migration schemas, frontend navigation, and the current finance flow.
- Produces: implementation-aligned architecture and database reference documents.

- [ ] Document frontend/backend boundaries, session authentication, RBAC, API groups, responsive layout behavior, and local runtime topology.
- [ ] Document the fee agreement → fee-record charge → payment allocation → receipt lifecycle and failure safeguards.
- [ ] Document all 36 tables by domain, the critical relationship chain, financial integrity rules, and MariaDB/SQLite roles.
- [ ] Record the fresh-MariaDB migration foreign-key ordering caveat without including credentials.

### Task 5: Mark planning documents as historical

**Files:**
- Modify: `docs/EXECUTIVE_SUMMARY.md`
- Modify: `docs/PRD.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/ARCHITECTURE_REVIEW_PLAN.md`
- Modify: `docs/BUSINESS_WORKFLOWS.md`
- Modify: `docs/MVP_ASSUMPTIONS.md`
- Modify: `docs/IMPLEMENTATION_BACKLOG.md`
- Modify: `docs/STAKEHOLDER_QUESTIONS.md`

**Interfaces:**
- Consumes: authoritative document links produced by Tasks 2–4.
- Produces: preserved historical documents that clearly direct readers to current truth.

- [ ] Add a consistent status notice immediately below each document title.
- [ ] Link each notice to `README.md`, `IMPLEMENTATION_STATUS.md`, and the most relevant current reference.
- [ ] Confirm no original planning sections were deleted or rewritten.

### Task 6: Validate documentation and application baselines

**Files:**
- Test: all modified Markdown files
- Test: `frontend/`
- Test: `backend/`

**Interfaces:**
- Consumes: all documentation edits.
- Produces: link, secret, whitespace, frontend, and backend verification evidence.

- [ ] Verify local Markdown links and repository paths with a deterministic link-check script.
- [ ] Scan the exact changed/staged content for the known local credentials and common secret patterns; require zero findings.
- [ ] Run `npm.cmd run lint` and require exit code 0.
- [ ] Run `npm.cmd run build` and require exit code 0.
- [ ] Run `php -c ../tools/php/php.ini vendor/bin/phpunit` from `backend` and require all tests to pass.
- [ ] Run `git diff --check` for every changed file and review the complete diff against the approved specification.

### Task 7: Publish and merge through GitHub

**Files:**
- Stage explicitly: the plan, specification, README files, and approved tracked documentation files only.

**Interfaces:**
- Consumes: the verified documentation diff on `codex/update-project-documentation`.
- Produces: a merged GitHub pull request and synchronized local `master`.

- [ ] Commit the documentation refresh with a concise documentation commit message.
- [ ] Push `codex/update-project-documentation` to `origin` with tracking.
- [ ] Create a ready-for-review PR targeting `master` with scope, verification evidence, and documentation debt notes.
- [ ] Inspect the remote PR diff and checks, then merge it without deployment actions.
- [ ] Switch the local checkout to `master`, fast-forward from `origin/master`, and verify user-owned untracked files remain untouched.
