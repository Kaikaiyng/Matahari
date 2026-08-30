# Community Policy Overlay Design

**Status:** Approved direction

**Date:** 2026-08-20

## Goal

On first authenticated use, show the real Community App home screen behind a mandatory policy modal. Users cannot operate any App navigation or content until they accept the current Terms of Use and Community Standards.

## Interaction

- Render the normal role-specific App shell and home screen as the background.
- Place the policy gate in a fixed modal layer above the complete App.
- While the gate is active, make the background inert so mouse, touch, focus, and keyboard navigation cannot reach it.
- Keep the modal open until both required current policy versions are accepted successfully.
- If policy verification fails, keep the blocking modal visible and offer Retry.
- Policy detail remains an in-modal view and returns to the agreement list.
- After successful acceptance, remove the overlay and inert state without a page reload.

## Visual Direction

- Reuse the App's warm off-white surfaces, burgundy brand action, ink and muted text colors, border tokens, radii, and soft shadows.
- Use one compact card rather than an independent policy-check page.
- Present policies as restrained list rows with a checkbox, title, and small read-detail hint. Do not render policy titles as large burgundy pills.
- Use a compact compliance label, clear title, short explanatory copy, and one full-width primary action.
- On narrow screens, preserve 16px viewport margins and allow the modal body—not the page behind it—to scroll.

## Component Boundaries

- `App.tsx` owns accepted/unaccepted state, background inertness, and placement of the global gate.
- `CommunityPolicyGate.tsx` owns loading policies, policy detail, acceptance, retry, and modal content.
- `CommunitySafety.css` owns the overlay and design-system-aligned presentation.
- `CommunityFeed.tsx` remains unaware of policy state because App-level gating applies to every role and tab.

## Verification

- An unaccepted authenticated user sees the home shell behind the modal, but the shell is inert.
- An accepted user sees no modal and can use the App normally.
- Accepting both policies unlocks the already-rendered shell.
- A policy API failure remains blocking and Retry reloads policies.
- App tests, lint, TypeScript checking, and production build pass.
