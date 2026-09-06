# Documentation Index

Start with the canonical documents below. The active project is Matahari, focused on first-school delivery; RYLAY SaaS is deferred. The documents separate implemented behavior from planned deployment and store-release work.

Historical records may retain RYLAY names, domains, commands and release identifiers. They are not instructions to rename existing databases, rewrite financial history, or provision a domain. The 2026-09-04 rename changes project/product naming while retaining tenant and permission structures.

## Canonical Project Knowledge

| Document | Purpose |
| --- | --- |
| [Project Overview](project-overview.md) | Business purpose, users, scale, scope, boundaries, and operational assumptions |
| [Business Rules](business-rules.md) | Student, agreement, discount, payment, receipt, retention, and financial-integrity rules |
| [Architecture](architecture.md) | Backend/frontend boundaries, authentication, authorization, data flow, audit, and deployment assumptions |
| [Database](database.md) | Engines, tables, relationships, constraints, money, statuses, migrations, rollback, and PostgreSQL considerations |
| [Permissions](permissions.md) | Seeded role matrix, enforcement locations, and frontend/backend gaps |
| [Current Status](current-status.md) | Commit snapshot, implemented/partial work, risks, test status, deployment state, and priorities |
| [First-school Delivery Research](first-school-delivery.md) | Verified dependencies, gradual delivery order, the next parent-directory slice, and school information needed by stage |
| [Tenancy Foundation and Future RYLAY SaaS](saas-multitenancy.md) | Matahari dedicated enforcement, domain resolution, memberships, branding, future SaaS mode, migration safety, and rollout gates |
| [Testing and Release](testing-and-release.md) | Exact validation commands, database checks, security review, smoke tests, release, and rollback |
| [Student CSV Import](student-csv-import.md) | Excel export format, dry-run/commit commands, actor scope, all-or-nothing writes and onboarding limits |
| [PostgreSQL Backup and Restore Rehearsal](postgresql-recovery.md) | Private backups, guarded disposable restores, sequence checks and recovery limits |
| [Phase A Academic Foundation Delivery](phase-a-academic-foundation.md) | Delivered Phase A scope, APIs, authorization, audit, migration safety, validation evidence, and live-data gates |
| [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md) | Approved one-backend mobile direction, Phase B–F boundaries, security rules, and future validation gates |
| [AI-Assisted Quiz Generator Technical Plan](ai-quiz-generator-technical-plan.md) | Approved but deferred Quiz AI architecture, V1 boundaries, authorization, validation, persistence, audit, testing, and implementation gate |
| [Staging and Production Deployment Design](superpowers/specs/2026-08-06-staging-production-deployment-design.md) | Approved VPS-first staging/production topology, exact-artifact promotion, database separation, backup, monitoring, and deferred infrastructure choices |

The root [README](../README.md) is the human entry point. Future coding agents must also follow [AGENTS.md](../AGENTS.md).

## Supporting Current References

- [Matahari Admin and App UI Design System](../DESIGN.md)
- [Maintenance Guide](MAINTENANCE_GUIDE.md)
- [Deployment Foundation](deployment-foundation.md)
- [Implementation Status](IMPLEMENTATION_STATUS.md)
- [Development Setup](DEVELOPMENT_SETUP.md)
- [UAT Checklist](UAT_CHECKLIST.md)
- [Demo Review Script](DEMO_REVIEW_SCRIPT.md)
- [Temporary Public Demo](PUBLIC_DEMO.md)
- [Audit Log Operations](AUDIT_LOG_OPERATIONS.md)

Supporting references describe the current contributor, operator, demo, and acceptance workflows. Verification counts remain dated evidence; when counts differ, use the newest dated evidence in [Current Status](current-status.md), and treat current code/tests as authoritative.

## Business Input Requiring Approval

- [Business Rules v0.1](business-rules/business-rules-v0.1.md) is a stakeholder draft. Its `TBD` items are not permission to invent formulas or behavior.
- [Stakeholder Questions](STAKEHOLDER_QUESTIONS.md) is a discovery guide, not an approved rule set.

## Historical Product and Planning Records

- [PRD](PRD.md)
- [Executive Summary](EXECUTIVE_SUMMARY.md)
- [Architecture Review Plan](ARCHITECTURE_REVIEW_PLAN.md)
- [Business Workflow Discovery](BUSINESS_WORKFLOWS.md)
- [MVP Assumptions](MVP_ASSUMPTIONS.md)
- [Implementation Backlog](IMPLEMENTATION_BACKLOG.md)
- [Decision Log](DECISIONS.md)
- [Roadmap](ROADMAP.md)
- [2026-08-13 Change Log](daily-change-log-2026-08-13.md)
- [Historical MIS App Product Specification](mobile-app-product-spec.md)
- [Historical Detailed System Architecture](SYSTEM_ARCHITECTURE.md)
- [Historical Detailed Database Design](DATABASE_DESIGN.md)
- [Historical Project Workflow Catalog](PROJECT_WORKFLOW_CATALOG.md)
- [Historical Workflow Atlas](workflow-diagrams/README.md)

Files under `superpowers/specs/` and `superpowers/plans/`, dated change logs, `design-qa.md`, and the workflow atlas preserve delivery decisions and execution history. They are intentionally not rewritten as current completion claims. The documentation-foundation execution plan is [here](superpowers/plans/2026-08-03-project-knowledge-foundation.md).

## Documentation Ownership

- Update canonical documentation in the same pull request as behavior, permission, schema, command, or status changes.
- Keep counts tied to a dated command result.
- Do not infer backend rules from navigation labels or frontend visibility.
- Use **Needs confirmation**, **Not verified**, or **Planned, not implemented** when evidence is incomplete.
- Never add credentials, real personal data, `.env` content, database files, tunnel state, or generated artifacts.
