# RYLAY Platform Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all active platform-owned Matahari identifiers to RYLAY while preserving Matahari International School as the first tenant.

**Architecture:** Keep one shared Admin build, Community App build, Laravel API, and RYLAY database schema. Tenant-visible identity continues to come only from host-resolved `branding` and `features`; repository contract tests separate platform identifiers from deliberate Matahari tenant fixtures.

**Tech Stack:** Laravel 13/PHP 8.3, React 19/TypeScript, Vitest, Node test runner, Docker Compose, GitHub Actions, PowerShell/Git.

## Global Constraints

- Matahari International School, MIS branding, tenant fixtures, tenant-facing pages, and financial history remain unchanged.
- Tenant differences are limited to authoritative runtime `branding` and `features` configuration.
- Do not add tenant-specific frontend copies, branches, or business behavior.
- Do not rename, delete, rebuild, or copy an existing database.
- New platform infrastructure identifiers use lowercase `rylay`, hyphenated `rylay-*`, or underscored `rylay_*` according to the existing identifier format.
- Historical records retain their original facts and receive superseding context rather than silent rewriting.
- Rename the GitHub repository and local top-level directory only after repository verification succeeds.

---

### Task 1: Lock the Platform/Tenant Naming Contract

**Files:**
- Create: `deploy/tests/platform-identity-contract.test.mjs`
- Modify: `frontend/src/App.test.tsx`
- Test: `deploy/tests/platform-identity-contract.test.mjs`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: repository files and browser `localStorage`.
- Produces: a repository-level active-platform naming guard and verified one-time remembered-username key migration.

- [ ] **Step 1: Add failing platform identity assertions**

Create a Node contract test that reads the package manifests, release workflow, deploy environment examples, Compose files, Dockerfile, and package script, then asserts RYLAY identifiers and rejects active platform-owned `matahari` identifiers. Add an Admin test that seeds `matahari.rememberedUsername`, renders login, and expects the value to move to `rylay.rememberedUsername` with the old key removed.

- [ ] **Step 2: Verify RED**

Run `node --test deploy/tests/platform-identity-contract.test.mjs` and `npm.cmd test -- --run src/App.test.tsx` from the repository root and `frontend/`. Expected: failures naming the current `matahari-*` deployment/package identifiers and missing storage-key migration.

- [ ] **Step 3: Commit only after the implementation tasks make the contract green**

The tests stay uncommitted through Tasks 2 and 3 so the first commit contains a working rename contract rather than a permanently red intermediate branch.

### Task 2: Rename Client-Owned Identifiers Without Changing Tenant Branding

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/components/LoginPage.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`

**Interfaces:**
- Consumes: legacy key `matahari.rememberedUsername`.
- Produces: packages `rylay-admin` and `rylay-community-app`; canonical key `rylay.rememberedUsername`.

- [ ] **Step 1: Implement the minimal key migration**

Define canonical and legacy constants. When the canonical key is absent and the legacy value exists, copy the value to the canonical key and delete the legacy key. All future writes and deletes use only the canonical key.

- [ ] **Step 2: Rename package metadata**

Set the Admin root package name in both manifest and lockfile to `rylay-admin`. Set the Community App root package name in both files to `rylay-community-app`. Do not change tenant titles in either `index.html` or tenant fallback configuration.

- [ ] **Step 3: Verify the focused client tests**

Run `npm.cmd test -- --run src/App.test.tsx` from `frontend/`. Expected: all App tests pass, including legacy-key migration and Matahari tenant branding assertions.

### Task 3: Rename Deployment, Database-Default, and Release Identifiers

**Files:**
- Modify: `.github/workflows/full-qualification.yml`
- Modify: `.github/workflows/release-candidate.yml`
- Modify: `deploy/compose/application.yml`
- Modify: `deploy/compose/database.yml`
- Modify: `deploy/database/apply-runtime-grants.sh`
- Modify: `deploy/database/init-databases.sh`
- Modify: `deploy/docker/nginx/app.conf`
- Modify: `deploy/docker/nginx/mobile-app.conf`
- Modify: `deploy/docker/php/Dockerfile`
- Modify: `deploy/docker/php/entrypoint.sh`
- Modify: `deploy/env/database.env.example`
- Modify: `deploy/env/production.env.example`
- Modify: `deploy/env/staging.env.example`
- Modify: `deploy/scripts/package-release.sh`
- Modify: `deploy/tests/compose-contract.test.mjs`
- Modify: `deploy/tests/create-release.test.mjs`
- Modify: `deploy/tests/runtime-contract.test.mjs`
- Modify: `tools/public-demo/tests/PublicDemo.Tests.ps1`
- Modify: `backend/tests/Support/MariaDbDestructiveTestGate.php`
- Modify: `backend/tests/Unit/Audit/MariaDbDestructiveTestGateTest.php`
- Modify: `backend/tests/Feature/Audit/AuditMariaDbSchemaTest.php`

**Interfaces:**
- Consumes: deployment environment variables with unchanged keys.
- Produces: `rylay_test`, `rylay_audit_test`, `rylay_staging`, `rylay_production`, `rylay-php:8.4.21-1`, `/srv/rylay`, `/var/www/rylay`, and `rylay-<commit>.zip` defaults.

- [ ] **Step 1: Apply the exact platform identifier mapping**

Replace platform-owned lowercase tokens as follows: `matahari_test` -> `rylay_test`, `matahari_audit_test` -> `rylay_audit_test`, `matahari_staging*` -> `rylay_staging*`, `matahari_production*` -> `rylay_production*`, `matahari_database` -> `rylay_database`, `matahari_mariadb_data` -> `rylay_mariadb_data`, `matahari-php` -> `rylay-php`, `/srv/matahari` -> `/srv/rylay`, `/var/www/matahari` -> `/var/www/rylay`, `matahari-entrypoint` -> `rylay-entrypoint`, `MATAHARI_STORAGE_PATH` -> `RYLAY_STORAGE_PATH`, and release/temp prefixes `matahari-` -> `rylay-`. Keep organization names and tenant fixture values untouched.

- [ ] **Step 2: Update the existing deployment contract assertions**

Make each assertion expect the exact RYLAY value produced above, including Docker user/group `rylay`, INI filenames `90-rylay.ini` and `91-rylay-opcache.ini`, binlog `rylay-bin`, and init mount `10-rylay.sh`.

- [ ] **Step 3: Verify GREEN**

Run `node --test deploy/tests/*.test.mjs`. Expected: every deployment test passes. Run the focused PHPUnit gate tests and expect all cases to pass with `rylay_audit_test` as the only destructive-test database.

- [ ] **Step 4: Commit client and deployment naming contracts**

Stage only Tasks 1-3 files and commit with `refactor: rename platform identifiers to RYLAY`.

### Task 4: Update Current Documentation and Preserve Historical Meaning

**Files:**
- Modify: `AGENTS.md`
- Modify: `backend/README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/current-status.md`
- Modify: `docs/deployment-foundation.md`
- Modify: `docs/testing-and-release.md`
- Modify: `docs/DECISIONS.md`
- Modify: historical Markdown files returned by the final `rg` audit only where the occurrence describes the platform/repository rather than the Matahari tenant or a past immutable command/result.

**Interfaces:**
- Consumes: the implemented identifier map from Tasks 2-3.
- Produces: current commands and explanations that consistently describe RYLAY and explicitly define Matahari as a tenant.

- [ ] **Step 1: Update canonical commands and architecture text**

Replace active database, Docker, path, artifact, repository-link, and project-title references with their RYLAY equivalents. Add the explicit rule that tenant differentiation is limited to `branding` and `features`, while shared code and backend behavior cannot fork per tenant.

- [ ] **Step 2: Mark historical naming without falsifying history**

Keep old pull-request URLs, old CI run URLs, historical database commands, and statements about the Matahari tenant when they are evidence of past work. Add a single documentation-index notice explaining that historical plans may use the former repository/platform identifier and are not current operational instructions.

- [ ] **Step 3: Audit every remaining occurrence**

Run `rg -n --hidden -S "Matahari|MATAHARI|matahari" -g '!**/node_modules/**' -g '!**/vendor/**' -g '!.git/**'`. Classify every result as tenant identity, preserved historical evidence, or a defect to fix. Run `rg -n -S "Kaikaiyng/Matahari" README.md AGENTS.md backend docs .github deploy` and allow only immutable historical links.

- [ ] **Step 4: Commit documentation**

Run `git diff --check`, stage intended documentation, and commit with `docs: complete RYLAY rename guidance`.

### Task 5: Full Repository Verification

**Files:**
- Verify only; do not add generated artifacts.

**Interfaces:**
- Consumes: all implementation commits.
- Produces: fresh release evidence and a final reviewed diff.

- [ ] **Step 1: Verify backend**

Run `..\tools\php\php-local.cmd vendor\bin\phpunit`, `..\tools\php\php-local.cmd vendor\bin\pint --test`, and `..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor` from `backend/`. Expected: exit 0, with MariaDB-only skips recorded rather than described as passed.

- [ ] **Step 2: Verify both clients**

From `frontend/` and then `app/`, run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`. Expected: exit 0; record any existing non-fatal warnings exactly.

- [ ] **Step 3: Verify deployment and repository hygiene**

Run `node --test deploy/tests/*.test.mjs`, Bash syntax checks documented in `docs/testing-and-release.md`, `git diff --check`, `git status --short`, and tracked filename/content secret scans. Expected: exit 0 and no unplanned generated files or secrets.

- [ ] **Step 4: Review commits and complete the branch**

Review `git diff origin/master...HEAD --stat` and the complete patch. Commit only any verified final corrections.

### Task 6: Rename GitHub Repository and Local Directory

**Files:**
- External state: GitHub repository settings for `Kaikaiyng/Matahari`.
- Local state: `C:\Users\chong\Documents\Matahari` -> `C:\Users\chong\Documents\RYLAY`.

**Interfaces:**
- Consumes: a verified `rename/rylay` branch and repository-administration permission.
- Produces: canonical remote `https://github.com/Kaikaiyng/RYLAY.git` and local root `C:\Users\chong\Documents\RYLAY`.

- [ ] **Step 1: Publish and integrate the verified branch**

Push `rename/rylay`, merge it through the repository's normal non-force workflow, and verify the remote default branch contains the exact tested commits.

- [ ] **Step 2: Rename the GitHub repository**

Use GitHub repository settings/API to rename `Matahari` to `RYLAY`. Do not change repository visibility, permissions, default branch, topics, or branch protection.

- [ ] **Step 3: Update and verify the remote URL**

Set `origin` to `https://github.com/Kaikaiyng/RYLAY.git`, then run `git remote -v` and `git ls-remote --symref origin HEAD`. Expected: fetch/push URLs use `/RYLAY.git` and HEAD resolves to the existing default branch.

- [ ] **Step 4: Rename the local root last**

From `C:\Users\chong\Documents`, verify the exact source resolves to the current repository and the destination does not exist, then rename only the single directory `Matahari` to `RYLAY`. Run `git -C C:\Users\chong\Documents\RYLAY status --short --branch` to confirm the repository remains accessible.
