# Documentation Index

Start with the canonical documents below. They describe merged `master` at `816ea1d` on 2026-08-13 and explicitly separate current behavior from approved future direction and unverified policy.

## Canonical Project Knowledge

| Document | Purpose |
| --- | --- |
| [Project Overview](project-overview.md) | Business purpose, users, scale, scope, boundaries, and operational assumptions |
| [Business Rules](business-rules.md) | Student, agreement, discount, payment, receipt, retention, and financial-integrity rules |
| [Architecture](architecture.md) | Backend/frontend boundaries, authentication, authorization, data flow, audit, and deployment assumptions |
| [Database](database.md) | Engines, tables, relationships, constraints, money, statuses, migrations, rollback, and MariaDB considerations |
| [Permissions](permissions.md) | Seeded role matrix, enforcement locations, and frontend/backend gaps |
| [Current Status](current-status.md) | Commit snapshot, implemented/partial work, risks, test status, deployment state, and priorities |
| [Testing and Release](testing-and-release.md) | Exact validation commands, database checks, security review, smoke tests, release, and rollback |
| [Phase A Academic Foundation Delivery](phase-a-academic-foundation.md) | Delivered Phase A scope, APIs, authorization, audit, migration safety, validation evidence, and live-data gates |
| [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md) | Approved one-backend mobile direction, Phase B–F boundaries, security rules, and future validation gates |
| [AI-Assisted Quiz Generator Technical Plan](ai-quiz-generator-technical-plan.md) | Approved but deferred Quiz AI architecture, V1 boundaries, authorization, validation, persistence, audit, testing, and implementation gate |
| [Staging and Production Deployment Design](superpowers/specs/2026-08-06-staging-production-deployment-design.md) | Approved VPS-first staging/production topology, exact-artifact promotion, database separation, backup, monitoring, and deferred infrastructure choices |

The root [README](../README.md) is the human entry point. Future coding agents must also follow [AGENTS.md](../AGENTS.md).

## Supporting Current References

- [2026-08-13 Change Log](daily-change-log-2026-08-13.md)
- [MIS App Product Specification](mobile-app-product-spec.md)
- [MIS App Design System](../DESIGN.md)
- [Maintenance Guide](MAINTENANCE_GUIDE.md)
- [Deployment Foundation](deployment-foundation.md)
- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [Database Design](DATABASE_DESIGN.md)
- [Implementation Status](IMPLEMENTATION_STATUS.md)
- [Development Setup](DEVELOPMENT_SETUP.md)
- [Project Workflow Catalog](PROJECT_WORKFLOW_CATALOG.md)
- [UAT Checklist](UAT_CHECKLIST.md)
- [Demo Review Script](DEMO_REVIEW_SCRIPT.md)
- [Temporary Public Demo](PUBLIC_DEMO.md)
- [Audit Log Operations](AUDIT_LOG_OPERATIONS.md)
- [Workflow Atlas](workflow-diagrams/README.md)

Supporting references are synchronized at a summary level, but some retain dated validation evidence. When counts differ, use the newest dated evidence in [Current Status](current-status.md); current code/tests remain authoritative.

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

Files under `superpowers/specs/` and `superpowers/plans/`, dated change logs, `design-qa.md`, and the workflow atlas preserve delivery decisions and execution history. They are intentionally not rewritten as current completion claims. The documentation-foundation execution plan is [here](superpowers/plans/2026-08-03-project-knowledge-foundation.md).

## Documentation Ownership

- Update canonical documentation in the same pull request as behavior, permission, schema, command, or status changes.
- Keep counts tied to a dated command result.
- Do not infer backend rules from navigation labels or frontend visibility.
- Use **Needs confirmation**, **Not verified**, or **Planned, not implemented** when evidence is incomplete.
- Never add credentials, real personal data, `.env` content, database files, tunnel state, or generated artifacts.
