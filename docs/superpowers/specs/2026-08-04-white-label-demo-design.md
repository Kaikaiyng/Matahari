# White-Label Demo Design

**Status:** Approved for implementation

**Date:** 2026-08-04

**Repository baseline:** `fc1c531671f4eb26a8664daca689430d8dbe6f2e`

## Context

The application is being shown before any school has approved, adopted, or endorsed it. The current runtime presentation contains Matahari International School branding, a school logo, school-specific names, a red visual identity, and the `MIS` receipt prefix. Together these can imply authorization or an existing commercial relationship.

The demo must become a neutral, fictional school administration product while preserving its current workflows, security controls, permissions, audit behavior, and financial integrity.

## Goals

- Present the product as **School Admin System**.
- Use a fictional **Demo International School** tenant for seeded demonstrations.
- Remove Matahari names, the school logo, `MIS` identifiers, and Matahari-red branding from all runtime and demo-facing surfaces.
- Make printed receipts unmistakably non-valid demo artifacts.
- Keep later rebranding straightforward without scattering a new school name throughout the frontend.
- Preserve all application behavior other than demo identity and presentation.

## Non-Goals

- Renaming the Git repository or rewriting historical project documentation.
- Changing roles, permissions, school-scope behavior, financial workflows, audit semantics, database relationships, or receipt sequencing rules.
- Rewriting existing financial history with a migration.
- Building a production tenant-branding administration feature.
- Adding a new UI or icon package.

## Considered Visual Directions

1. **Slate + Blue — selected.** Neutral, professional, readable, and familiar for administration and finance software.
2. **Navy Enterprise.** More formal, but visually heavy for the current information-dense interface.
3. **Teal Education.** Friendly, but more likely to feel like a distinct education brand than a white-label system.

## Brand System

| Element | Value |
| --- | --- |
| Product name | `School Admin System` |
| Demo organization | `Demo International School` |
| Demo school code | `DEMO` |
| Demo receipt prefix | `DEMO` |
| Primary | `#2563EB` |
| Primary dark | `#1D4ED8` |
| Sidebar | `#172033` |
| Canvas | `#F4F7FB` |
| Main text | `#172033` |
| Muted text | `#64748B` |
| Logo treatment | Generic school-building line icon in a blue square |
| Receipt notice | `SAMPLE — NOT A VALID RECEIPT` |

Red may remain only where it carries established semantic meaning, such as destructive actions, validation errors, overdue states, or voided records. It must not remain as the navigation, focus, selection, button, link, or general accent color.

## Frontend Design

### Central Brand Configuration

Add a small frontend branding module containing the product name, demo organization label, generic logo label, and receipt disclaimer. Runtime components should consume these values instead of repeating school-specific strings.

This is a code-level presentation configuration, not a user-editable school-settings feature.

### Logo and Identity Surfaces

- Remove the `mis-logo.jpg` import and delete the unused branded asset.
- Replace image-logo rendering on login, session loading, sidebar, and receipt print surfaces with a reusable generic mark built from the existing Lucide school icon.
- Use accessible text such as `School Admin System logo`; no `MIS logo` alternative text may remain.
- Replace the browser title and current favicon with neutral School Admin System identity.
- Replace static Matahari family/contact placeholder text with clearly fictional demo wording.

### Color Tokens

- Rename `--brand-red` and `--brand-red-dark` to semantic `--brand-primary` and `--brand-primary-dark` tokens.
- Update all components to use the new tokens.
- Replace hard-coded Matahari-red interactive states with the selected blue palette.
- Keep error/destructive colors separate from brand tokens so future rebranding does not alter safety semantics.
- Preserve existing contrast, focus visibility, spacing, breakpoints, and responsive behavior.

### School Context

The application may continue to display the school name returned by the backend because it is tenant data. A freshly seeded demo must return `Demo International School`. Global users without a selected school must continue to see the existing scope-required behavior; the white-label work must not reintroduce an assumed school.

## Backend and Demo Data

Update only demo defaults and safe fallbacks:

- Seed school name: `Demo International School`.
- Seed school code and receipt prefix: `DEMO`.
- Seed address: an explicitly fictional demo value.
- Seed administrator display name: `Demo School Admin`.
- Receipt-generation fallback prefix: `DEMO`, used only if both the stored school receipt prefix and code are absent.

No migration will rename existing schools or receipt numbers. Historical receipt numbers are financial records and must not be rewritten for presentation. Existing disposable demo databases must be reset through the documented SQLite demo reset workflow to receive the neutral seed and prefix.

## Receipt Presentation

- Replace the static school logo/name in the printable receipt with the generic product mark and the central `Demo International School` presentation label. Do not add or change an API field merely for branding.
- Display `SAMPLE — NOT A VALID RECEIPT` prominently on both on-screen and print layouts.
- Keep receipt number, payment snapshot, items, issue/void state, and sequencing behavior unchanged.
- A fresh demo will produce `DEMO`-prefixed receipt numbers. Existing `MIS` numbers remain unchanged until the disposable demo database is intentionally reset.

## Documentation Scope

Update active demo-facing documentation and setup guidance where it would otherwise instruct a presenter to say or display Matahari branding. Preserve historical requirements, decision records, architecture reviews, and repository identity because they remain development evidence rather than runtime marketing material.

Canonical current-status documentation must record that the runtime demo is white-labelled while the repository retains its internal Matahari project history.

## Error Handling and Safety

- Branding changes must not alter API error handling or permission-denied behavior.
- Do not mask tenant identity in API data; neutral demo identity comes from safe seed data.
- Do not modify existing databases automatically.
- Do not delete or renumber historical receipts.
- Do not convert danger/error states to blue where red communicates a destructive or invalid operation.

## Testing and Acceptance

### Automated Tests

- Update frontend assertions for the neutral product name, generic logo labels, demo school, and receipt disclaimer.
- Update backend seed and receipt fallback tests for `DEMO` values.
- Add or extend a receipt presentation test confirming the sample disclaimer.
- Run the complete backend suite, Pint, route loading, frontend Vitest suite, Oxlint, TypeScript/Vite build, and npm audit.

### Brand Scan

Search runtime and demo-facing sources for:

- `Matahari`
- `MIS logo`
- `mis-logo`
- `'MIS'` receipt fallbacks or seed values
- `--brand-red` and `--brand-red-dark`
- the previous brand red values `#EE2F37`, `#D82730`, and `#B31923`

Matches in explicitly historical/internal documentation may remain. Matches in application runtime, seed data, generated assets, active demo scripts, or presenter-facing demo guidance must be removed or justified as semantic danger colors.

### Visual Acceptance

- Login, loading, sidebar, dashboard, Student Detail, Calendar, Audit Trail, modal focus states, and receipt print preview consistently use the blue/slate system.
- No school-owned logo or Matahari name appears in the runtime UI.
- No `MIS` prefix appears after a fresh demo reset.
- Destructive and validation states remain visibly distinct.
- Desktop, tablet, and mobile layouts retain their current behavior.

## Baseline Dependency Finding

On 2026-08-04, a clean `npm ci` reported a new high-severity advisory affecting the transitive `undici` dependency. This is not caused by white-labelling, but a branch must not be presented as release-ready while the audit fails. The implementation plan must identify the owning dependency, apply the smallest compatible lockfile/package update, and rerun the full frontend validation. It must not suppress or ignore the advisory.

## Completion Criteria

- All runtime and active demo-facing branding is neutral.
- Fresh demo seed data uses `Demo International School` and `DEMO`.
- Printed receipts are visibly marked as samples.
- No financial history migration or business behavior change is introduced.
- Full relevant tests, build, lint, formatting, brand scan, and dependency audit pass.
- Documentation explains how to reset the disposable demo database and how later approved school branding can be restored safely.
