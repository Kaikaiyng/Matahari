# Project Documentation Refresh Design

## Goal

Bring the public GitHub README files and current-state project documentation in sync with the implemented Matahari Admin Finance MVP, then publish the documentation through a reviewed GitHub pull request and merge it into `master`.

## Audience

- Developers setting up or maintaining the local application
- School stakeholders reviewing the current demo scope
- Future contributors who need to distinguish implemented behavior from historical planning

## Documentation Strategy

Use a targeted current-state refresh rather than rewriting the full planning archive. Entry-point and operational documents will describe the application as it exists now. Early product-planning documents will remain intact as historical records and receive a short status notice where necessary.

This preserves decision history while preventing new readers from mistaking June 2026 scaffold notes for the current implementation.

## Files to Rewrite

### Entry Points

- `README.md`: current product scope, implemented modules, responsive device support, technology stack, setup summary, verification commands, documentation map, deferred scope, and known limitations.
- `frontend/README.md`: replace the Vite template text with Matahari-specific frontend architecture, commands, API configuration, responsive behavior, and implemented screens.
- `backend/README.md`: replace the Laravel template text with backend setup, authentication and RBAC, API/module overview, database configuration, testing, and local operational notes.

### Current-State Reference and How-To Documents

- `docs/DEVELOPMENT_SETUP.md`: current PHP/Node tooling, MariaDB/SQLite options, safe environment configuration, startup commands, LAN demo access, and verification.
- `docs/IMPLEMENTATION_STATUS.md`: current completed modules, 30 API routes, 92 backend tests, responsive QA status, deferred modules, and known limitations.
- `docs/SYSTEM_ARCHITECTURE.md`: align module boundaries, authentication, API inventory, fee-record charge flow, payment allocation, receipt lifecycle, and local database architecture with the code.
- `docs/DATABASE_DESIGN.md`: describe the active 36-table schema, fee-agreement and fee-record charge model, payment allocation and receipt relationships, data integrity rules, and the MariaDB migration-order caveat.
- `docs/UAT_CHECKLIST.md`: replace speculative invoice/report/PDF acceptance criteria with executable tests for the implemented demo flows and explicitly mark deferred scope.
- `docs/DEMO_REVIEW_SCRIPT.md`: update the demonstration sequence for login, navigation, student management, fee agreements, charge preview/activation, manual charges, payments, receipts, summaries, category monthly ledger, and responsive devices.

## Historical Documents

The following documents retain their original planning content and receive a concise notice that current implementation truth lives in the README, implementation status, setup, architecture, database, UAT, and demo documents:

- `docs/EXECUTIVE_SUMMARY.md`
- `docs/PRD.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE_REVIEW_PLAN.md`
- `docs/BUSINESS_WORKFLOWS.md`
- `docs/MVP_ASSUMPTIONS.md`
- `docs/IMPLEMENTATION_BACKLOG.md`
- `docs/STAKEHOLDER_QUESTIONS.md`

The untracked `docs/business-rules/business-rules-v0.1.md` remains outside the pull request because it is pre-existing user-owned work and was not explicitly approved for publication.

## Current Implementation Facts to Document

- React 19, TypeScript 6, Vite 8, and Oxlint frontend
- Laravel 13 and PHP 8.4 backend
- MariaDB local development database with SQLite retained for isolated tests and rollback
- Session authentication, role-based permissions, and permission-gated finance actions
- Student management and status workflow
- Versioned fee agreements with billing configuration
- Fee-record charge preview and activation
- Manual and one-time charges
- Outstanding-charge payment allocation, including partial allocation
- Payment verification and void safeguards
- Receipt generation, viewing, printing, voiding, and regeneration
- Fee-record summary and category-monthly ledger
- Desktop, iPad landscape, iPad portrait, and mobile responsive behavior
- 30 application API routes and 92 backend tests with 597 assertions at the last verified baseline

## Deferred Scope to State Explicitly

- Statement and reminder modules
- Reports and export features
- PDF generation
- Parent Portal
- Production dashboard finance logic
- Deployment, hosting, domain, and Cloudflare configuration

## Security and Privacy

- Do not publish local MariaDB, root, phpMyAdmin, or application passwords.
- Do not publish private environment values or local session data.
- Use placeholders in setup examples.
- Run a secret-pattern scan on the exact staged documentation before push.
- Preserve unrelated untracked files and never stage the whole worktree.

## Validation

- Read every tracked Markdown document before editing it.
- Cross-check commands against `package.json`, `composer.json`, Laravel route output, migrations, tests, and the implemented frontend navigation.
- Verify internal Markdown links and referenced repository paths.
- Run `npm.cmd run lint` and `npm.cmd run build` in `frontend`.
- Run the complete backend PHPUnit suite with the project PHP configuration.
- Run `git diff --check` on all changed documentation and configuration files.
- Confirm the staged diff contains no credentials and no unrelated untracked content.

## GitHub Delivery

- Work on `codex/update-project-documentation` from the current local `master` state.
- Include the three existing safe local commits for the MariaDB migration design, migration plan, and PHP `intl` configuration.
- Commit documentation changes with explicit file staging.
- Push the branch to `origin`, create a ready-for-review pull request targeting `master`, verify its checks and diff, then merge it.
- Update local `master` to the merged remote commit without discarding user-owned untracked files.

## Success Criteria

A new developer can open the root README, understand what is implemented and deferred, start both applications, configure a non-secret local database connection, run verification, and find detailed architecture, database, UAT, and demo guidance without encountering contradictory scaffold-era instructions.
