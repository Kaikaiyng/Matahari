# Matahari Project Knowledge Foundation Plan

> **Status:** Documentation execution plan for the repository baseline inspected at `14adce9508992c03c4249d49308a3841c198f4bd`.

**Goal:** Establish concise, evidence-based project documentation and root agent guidance without changing application behavior.

**Scope:** Inspect the Laravel backend, React frontend, schema, tests, tooling, existing documents, and Git history; create the required knowledge files; independently compare the draft with code; validate all available commands; then commit and open a pull request. Production code is out of scope.

## Tasks

1. Record the Git baseline, protect unrelated user files, and work on `codex/project-documentation-foundation` in an isolated worktree.
2. Inventory runtime versions, routes, controllers, requests, services, models, migrations, seeders, tests, frontend pages, permission checks, environment examples, CI, and deployment helpers.
3. Classify implementation as implemented, partial, planned, or unverified; record contradictions instead of resolving them by assumption.
4. Create `AGENTS.md`, improve `README.md`, and add the seven requested canonical documents under `docs/`.
5. Update `docs/README.md` so every canonical document is discoverable from the repository entry points.
6. Run an independent code-to-document review and correct every supported discrepancy.
7. Run backend, frontend, database, Markdown, link, diff, and secret validations; record commands that cannot run and why.
8. Stage only intended documentation, review the final diff, commit, push, and open a pull request. Merge only if every user-defined safety gate is satisfied.

## Evidence Rules

- Repository code and manifests are authoritative for implementation details.
- Confirmed user business context is authoritative for intended policy, but is not described as implemented without code evidence.
- Use **Needs confirmation**, **Not verified**, and **Planned, not implemented** for uncertainty.
- Historical plans remain historical; do not silently rewrite them as current behavior.
- Never include credentials, real student data, tokens, connection strings, or local runtime artifacts.
