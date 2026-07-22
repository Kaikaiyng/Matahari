# Documentation Index

This directory contains both current implementation references and historical planning records. Start here when maintaining Matahari so an old proposal is not mistaken for current runtime behavior.

## Current references

| Document | Use it for |
| --- | --- |
| [Maintenance Guide](MAINTENANCE_GUIDE.md) | Source-of-truth rules, change map, API ownership, verification, and release checklist |
| [Implementation Status](IMPLEMENTATION_STATUS.md) | Shipped modules, deferred scope, current verification evidence, and known limitations |
| [Development Setup](DEVELOPMENT_SETUP.md) | Local setup, SQLite/MariaDB options, test commands, and LAN testing |
| [System Architecture](SYSTEM_ARCHITECTURE.md) | Runtime boundaries, authentication/RBAC, API inventory, and domain flow |
| [Database Design](DATABASE_DESIGN.md) | Current tables, relationships, integrity rules, and migration caveat |
| [Project Workflow Catalog](PROJECT_WORKFLOW_CATALOG.md) | Detailed current workflows and implemented/deferred boundaries |
| [UAT Checklist](UAT_CHECKLIST.md) | Manual acceptance checks for the implemented product |
| [Demo Review Script](DEMO_REVIEW_SCRIPT.md) | Suggested stakeholder demonstration sequence |
| [Temporary Public Demo](PUBLIC_DEMO.md) | Safe start/stop instructions for a temporary Cloudflare Quick Tunnel |
| [Workflow Atlas](workflow-diagrams/README.md) | Historical Mermaid/FigJam snapshot, its verification date, and known drift |

Package-specific references:

- [Frontend README](../frontend/README.md)
- [Backend README](../backend/README.md)

## Business input requiring approval

- [Business Rules v0.1](business-rules/business-rules-v0.1.md) is a draft stakeholder source. Its `TBD` items are not permission to invent behavior.
- [Stakeholder Questions](STAKEHOLDER_QUESTIONS.md) is a historical discovery guide that remains useful for interviews.

## Historical planning records

These documents explain how the MVP was originally framed. They are not current completion checklists:

- [PRD](PRD.md)
- [Executive Summary](EXECUTIVE_SUMMARY.md)
- [Architecture Review Plan](ARCHITECTURE_REVIEW_PLAN.md)
- [Business Workflow Discovery](BUSINESS_WORKFLOWS.md)
- [MVP Assumptions](MVP_ASSUMPTIONS.md)
- [Implementation Backlog](IMPLEMENTATION_BACKLOG.md)
- [Decision Log](DECISIONS.md)
- [Roadmap](ROADMAP.md)

## Delivery designs and implementation plans

The files below preserve feature decisions and implementation history. Current code and the current references above take precedence if they differ.

| Delivery | Design | Plan |
| --- | --- | --- |
| iPad-first responsive demo | [Design](superpowers/specs/2026-07-11-ipad-first-responsive-demo-design.md) | [Plan](superpowers/plans/2026-07-11-ipad-first-responsive-demo.md) |
| Project documentation refresh | [Design](superpowers/specs/2026-07-12-project-documentation-refresh-design.md) | [Plan](superpowers/plans/2026-07-12-project-documentation-refresh.md) |
| SQLite to MariaDB | [Design](superpowers/specs/2026-07-12-sqlite-to-mariadb-design.md) | [Plan](superpowers/plans/2026-07-12-sqlite-to-mariadb.md) |
| Username authentication/user management | [Design](superpowers/specs/2026-07-12-username-auth-user-management-design.md) | [Plan](superpowers/plans/2026-07-12-username-auth-user-management.md) |
| Demo readiness hardening | [Design](superpowers/specs/2026-07-17-demo-readiness-hardening-design.md) | [Plan](superpowers/plans/2026-07-17-demo-readiness-hardening.md) |
| Reference admin UI refresh | [Design](superpowers/specs/2026-07-17-reference-admin-ui-refresh-design.md) | [Plan](superpowers/plans/2026-07-17-reference-admin-ui-refresh.md) |
| Shared calendar | [Design](superpowers/specs/2026-07-19-shared-calendar-design.md) | [Plan](superpowers/plans/2026-07-19-shared-calendar.md) |
| Temporary public demo | [Design](superpowers/specs/2026-07-20-temporary-public-demo-design.md) | [Plan](superpowers/plans/2026-07-20-temporary-public-demo.md) |
| Class directory | [Design](superpowers/specs/2026-07-21-class-directory-design.md) | [Plan](superpowers/plans/2026-07-21-class-directory.md) |
| Dashboard outstanding fees | [Design](superpowers/specs/2026-07-21-dashboard-outstanding-fees-design.md) | [Plan](superpowers/plans/2026-07-21-dashboard-outstanding-fees.md) |
| Student fee-period filter | [Design](superpowers/specs/2026-07-21-students-fee-period-filter-design.md) | [Plan](superpowers/plans/2026-07-21-students-fee-period-filter.md) |

## Documentation ownership

- Update current references in the same pull request as behavior changes.
- Preserve historical documents. Add a dated correction note instead of rewriting the original decision history.
- Generate route and test counts from commands; do not copy old totals forward.
- Never add credentials, real student information, local database files, tunnel state, or `.env` contents to documentation.
