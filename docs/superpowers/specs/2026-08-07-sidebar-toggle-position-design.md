# Sidebar Toggle Position Design

**Date:** 2026-08-07

## Goal

Move the desktop sidebar expand/collapse control from the brand divider to the vertical midpoint of the sidebar edge and simplify its icon without changing sidebar behavior.

## Approved Design

- Position the control at `top: 50%` on the sidebar's right edge and offset it with `translateY(-50%)`.
- Use the existing icon library's `ChevronLeft` when expanded and `ChevronRight` when collapsed. These produce a consistent simple `‹ / ›` appearance without font-dependent text glyphs.
- Preserve the current 28-pixel circular control, hover/focus treatment, accessible labels, persisted collapse preference, desktop widths, and mobile drawer behavior.
- Keep the control hidden at the existing mobile breakpoint.
- Do not change navigation items, permissions, page selection, branding, or logout behavior.
- Keep this change local; do not push it to GitHub yet.

## Verification

- A focused component test will assert the correct chevron for expanded and collapsed states.
- Existing AdminShell tests, lint, and build will be run locally.
- The local authenticated page will be checked at desktop size for midpoint placement and toggle behavior.
