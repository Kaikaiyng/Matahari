# Matahari Agent Instructions

## Project Summary

Matahari is a school administration and finance MVP for Matahari International School. The repository currently contains a Laravel 13 JSON API and a React 19/TypeScript frontend. It is not a complete academic ERP and is not verified as production-ready.

## Read Before Editing

1. Read this file and the root [README](README.md).
2. Read [Project Overview](docs/project-overview.md) and [Current Status](docs/current-status.md).
3. For domain changes, read [Business Rules](docs/business-rules.md) and [Permissions](docs/permissions.md).
4. For implementation changes, read [Architecture](docs/architecture.md), [Database](docs/database.md), and [Testing and Release](docs/testing-and-release.md).
5. Inspect the relevant tests, routes, requests, controllers, services, models, and migrations before changing behavior. UI code alone is not a business-rule source.

## Repository Map

- `backend/`: Laravel application, API routes, domain services, migrations, seeders, and PHPUnit tests.
- `frontend/`: React application, shared components, feature editors, Vitest tests, and Vite configuration.
- `docs/`: canonical current documentation plus historical plans and decision records.
- `tools/php/`: Windows PHP launchers and local SQLite demo helpers.
- `tools/public-demo/`: temporary demo tunnel tooling; it is not production deployment infrastructure.

## Non-Negotiable Domain Rules

- Do not physically delete students in normal workflows. Preserve their administrative and financial history and use the verified lifecycle values `active`, `withdraw`, `graduate`, and `inactive`.
- Fee Agreements are versioned. Replace an agreement through superseding; never silently rewrite historical versions.
- Payments, allocations, receipts, verification, and void actions are financial records. Preserve actor, timestamp, reason, numbering, and snapshots where the schema supports them.
- Never reuse a voided receipt number or silently rewrite a verified payment.
- Do not invent discount formulas or automated eligibility behavior. The current discount-to-charge calculation is incomplete.
- Preserve historical records. Do not remove data merely to simplify a workflow.

## Authorization and Security

- Backend enforcement is mandatory. Frontend visibility is only a usability control.
- Apply `auth`, the correct `permission:<slug>`, and school-scope enforcement to protected operations. Test both unauthorized and cross-school cases.
- Do not weaken authentication, authorization, validation, school scoping, or audit behavior to make a test pass.
- Never add secrets, credentials, real student data, private connection strings, database files, or tunnel state to Git or documentation.
- Preserve native CSRF middleware, login throttling, active-session checks, and same-origin session behavior on authenticated APIs.
- Material student and finance mutations must write their audit event inside the same transaction and roll back if audit persistence fails. Authentication audit is best-effort with the redacted security-log fallback.
- Audit access is read-only and restricted by backend `audit.view`; never add update/delete audit routes or expose secret-bearing payloads.

## Database and Migration Rules

- Production direction is MariaDB/MySQL-compatible. SQLite-only success is not proof of MariaDB compatibility.
- Use decimal-safe storage and application handling for money; do not introduce binary floating-point calculations into financial decisions.
- Preserve the database uniqueness guards for one current agreement per student/year and one scheduled charge per agreement item/month. Do not bypass migration duplicate-data preflights.
- Do not casually edit migrations that may have run elsewhere. Add a corrective migration unless the repository is demonstrably unreleased and the change is explicitly approved.
- Preserve foreign-key creation and rollback order. Every new migration needs a tested `down()` path unless an exception is documented.
- Never run `migrate:fresh`, destructive schema probes, or seeders against a database that may contain valuable data.
- Preserve existing data and document any data migration, recovery, or rollback limitation.

## Development Constraints

- Make the smallest complete change and avoid unrelated refactoring.
- Follow existing controller/request/service/model boundaries. Financial mutations belong in transactions and should use row locks where concurrent updates matter.
- Do not add a package without a concrete justification and lockfile update.
- Keep the separate `frontend/` React application distinct from the Laravel scaffold assets in `backend/`.
- Update relevant canonical documentation in the same change when behavior, permissions, schema, commands, or status changes.

## Testing Requirements

- Add or update focused tests before changing behavior, then run the full relevant suite.
- Backend minimum: PHPUnit, route loading, Pint check, and database migration/rollback checks appropriate to the change.
- Frontend minimum: Vitest, Oxlint, and `npm.cmd run build` (which includes TypeScript checking).
- Database-sensitive work requires a disposable MariaDB run in addition to SQLite. Record any unavailable external dependency as a limitation; never claim an unexecuted check passed.
- Follow [Testing and Release](docs/testing-and-release.md) for exact commands and release evidence.

## Git, Worktrees, and Parallel Agents

- Do not work directly on the default branch. Fetch first and branch from the latest remote default branch.
- Preserve unrelated user changes. If the main worktree is dirty, use a separate Git worktree.
- Use separate branches/worktrees for parallel tasks. Do not let agents edit overlapping areas without explicit ownership and coordination.
- Never force-push, bypass hooks, discard user work, or rewrite shared history.
- Review the complete final diff and stage only intended files.

## Completion Checklist

- [ ] Behavior matches verified business rules and backend permissions.
- [ ] Relevant focused and full tests completed with recorded results.
- [ ] MariaDB-sensitive behavior was tested on MariaDB or marked **Not verified**.
- [ ] Migrations and rollback were tested where applicable.
- [ ] Formatting, lint, type checking, build, routes, links, and secret checks completed.
- [ ] No unrelated files, generated artifacts, credentials, or real data are included.
- [ ] Canonical documentation reflects the final behavior.
- [ ] Final report lists changed files, commands/results, assumptions, unresolved risks, and items needing confirmation.

## Handling Uncertainty

Do not convert an inference into a fact. Search the repository and tests first. If evidence remains incomplete, label the statement **Needs confirmation**, **Not verified**, or **Planned, not implemented**, explain what evidence is missing, and keep the implementation conservative.
