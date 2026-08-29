# Admin Card System Design

**Date:** 2026-08-29
**Status:** Approved

## Goal

Unify the RYLAY Admin Panel card language using the visual density and hierarchy of the MAW reference while retaining MIS/RYLAY branding. This is a presentation-only change: the School App, backend behavior, permissions, data flow, and business rules remain unchanged.

## Scope

The change covers shared Admin surfaces and the main cards used by Dashboard, Students, Classes, Finance, Attendance, Calendar, Audit Trail, Application Logs, Settings, and dialogs. Inputs and tables remain controls/content rather than being restyled as cards.

## Visual System

- Use the existing pale blue-grey Admin canvas and white card surfaces.
- Standard cards use a 12–14px radius, subtle neutral border, and very light shadow.
- The parent layout owns a consistent 16px gap between sibling cards and panels.
- Standard panel padding is 18–20px, with a distinct but quiet header/content boundary.
- Statistic cards use compact uppercase or small labels, prominent values, supporting copy, and a soft icon tile aligned to the right or leading edge as appropriate to the existing structure.
- Burgundy remains the primary brand accent. Green, amber, blue, and red are reserved for semantic states and use soft backgrounds rather than saturated card fills.
- Interactive cards may lift by one pixel, strengthen their border, and deepen their shadow slightly. Motion remains short and is disabled for reduced-motion users.
- Empty states and secondary nested cards use a tinted inset surface so they remain visually subordinate to their parent panel.

## Implementation Approach

Use shared CSS tokens and existing shared primitives (`StatCard`, `DataPanel`, toolbars) as the primary integration point. Add a targeted compatibility layer for established domain card classes whose markup should not be rewritten. Avoid a wholesale component migration and avoid unrelated layout refactors.

Dashboard receives the clearest MAW-style hierarchy: compact statistic cards, clean operational panels, soft status blocks, and consistent panel framing. Other Admin pages inherit the same surface, border, radius, shadow, spacing, icon-tile, and interaction rules without changing their information architecture.

## Responsive and Accessibility Rules

- Existing responsive grid breakpoints and table behavior remain authoritative.
- Cards must not introduce horizontal overflow or fixed widths.
- Existing focus-visible behavior and semantic button/card roles remain intact.
- Text contrast must remain readable on all soft semantic backgrounds.
- Hover effects must not be the only indication that a card is actionable.

## Verification

Run focused Admin integration/component tests that cover shared cards and the main Dashboard, followed by Oxlint and the Admin TypeScript/Vite production build. Browser-wide visual QA, backend tests, App tests, and database checks are outside this presentation-only change.

## Explicit Non-Goals

- No School App visual changes.
- No backend, API, schema, permission, or business-rule changes.
- No new package or design framework.
- No complete rewrite of every domain card into a new React component.
- No changes to the content or behavior of tables, forms, dialogs, or navigation.
