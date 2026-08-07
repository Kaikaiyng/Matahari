# Dashboard Demo Presentation Polish

**Date:** 2026-08-07

**Status:** Approved in the request; the user selected the balanced management-and-operations direction and authorized implementation without further design checkpoints

## Goal

Turn the authenticated Dashboard into a polished demonstration landing page for both school management and Admin/Finance users, while preserving the existing API contract, permissions, navigation, and financial meaning.

The page should communicate a complete, credible product within a few seconds: management sees the school's headline position first, while operational users can immediately reach the records that need attention.

## Design Direction

The selected direction is a balanced dashboard:

- an executive-style overview at the top;
- four existing live metrics with stronger hierarchy and contextual labels;
- a financial snapshot that makes today's collection, monthly collection, and outstanding fees visually scannable without inventing historical comparisons;
- permission-aware quick actions for common Admin/Finance destinations;
- recent collections and outstanding-account lists presented as useful operational panels;
- refined loading, unavailable, populated, and empty states;
- responsive layouts for desktop, tablet, and mobile.

## Information Architecture

### Welcome and context

The page opens with a compact welcome section containing the Dashboard label, school-oriented overview copy, and the current local date. It establishes presentation quality without consuming excessive vertical space. The existing Students action is moved into the Dashboard's quick-action area so the header can focus on context.

### Headline metrics

The existing four API-backed values remain the only headline metrics:

- Today's Collection;
- Monthly Collection;
- Outstanding Fees;
- Active Students.

Each metric receives a distinct icon treatment, semantic accent, short supporting line, and improved numeric typography. Outstanding Fees remains clickable only when the user has `fee_record.view`. Loading, unavailable, and no-access values remain explicit and must never be replaced with fabricated numbers.

### Financial snapshot and quick actions

A larger financial snapshot groups the three existing money values into one coherent management panel. Decorative progress or trend graphics may be used only when derived truthfully from the values already returned by the API. No percentage change, target, forecast, or historical series is shown because the API does not provide those facts.

A companion quick-action panel exposes only destinations the current user can access. Initial actions are Students, Fee Record, and Calendar, using the existing page-selection callback and permission checks. The panel contains no disabled or misleading links for unavailable modules.

### Operational activity

Recent collections and outstanding accounts remain the lower-page operational sections. Rows gain clearer identity, date/method metadata, amount emphasis, status styling, and a compact destination action where permission allows. Empty states remain honest and visually complete.

The existing backend inconsistency between Fee Record outstanding totals and legacy outstanding-account rows is not corrected in this frontend-only change. The UI must avoid copy that claims the two datasets reconcile.

## Visual System

The Dashboard reuses the current blue brand and white application shell while increasing presentation quality through:

- a subtle tinted overview surface rather than a full-page decorative background;
- consistent 12- to 16-pixel radii within Dashboard-only components;
- light borders and restrained shadows;
- blue, emerald, amber, and violet metric accents;
- circular icon badges and compact status pills;
- larger tabular numeric values;
- clearer panel spacing and quieter secondary text;
- small, purposeful hover and focus states with reduced-motion support.

Styling stays scoped under `.dashboard-page` so existing shared cards and pages do not change unexpectedly.

## Functional Boundaries

This change does not alter:

- dashboard API requests or response fields;
- backend controllers, financial calculations, invoices, Fee Record summaries, or database data;
- authentication, permissions, school scope, navigation definitions, or route behavior;
- the existing meaning of loading, demo/unavailable, or access-denied states;
- staging, production, packaging, or deployment configuration.

No new frontend package is required. Existing Lucide icons and shared primitives are reused where practical.

## Accessibility and Responsive Behavior

- Every navigation action remains a native button with a visible focus state and descriptive accessible name.
- Color is not the only indicator of metric or list meaning.
- Metric and financial values retain readable text at narrow widths.
- Desktop uses a strong two-column management row and two-column activity row.
- Tablet collapses the management row before content becomes cramped.
- Mobile uses a single-column flow with horizontally safe rows and full-width actions.
- Reduced-motion preferences disable nonessential transitions.

## Verification

Implementation will update focused Dashboard component tests before the visual code. Tests cover the new semantic regions, permission-filtered quick actions, existing navigation callbacks, and current loading/unavailable behavior.

Because this is frontend-only demo presentation work, verification is intentionally concise:

- focused Dashboard Vitest cases;
- frontend lint;
- TypeScript and Vite production build;
- one local desktop and one narrow-screen browser smoke check.

No backend or database validation is required because API behavior and persisted data are unchanged. The work remains local and is not pushed.
