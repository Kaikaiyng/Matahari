# Sidebar Reference Redesign

**Date:** 2026-08-07

**Status:** Approved in the request; the user authorized implementation decisions without additional confirmation

**Reference:** `C:\Users\chong\Downloads\AdminSystem_Update`

## Goal

Restyle Matahari's authenticated sidebar to follow the Mewah AutoWorks admin shell while preserving every existing navigation item, permission filter, page-selection callback, responsive drawer behavior, and page implementation.

## Reference Findings

The reference application uses a white fixed desktop sidebar with a subtle right border and shadow. It is 256 pixels wide when expanded and 80 pixels wide when collapsed. The collapsed preference is stored locally. Navigation uses compact Lucide icons, slate text, light-blue active backgrounds, and icon-only tooltips when collapsed. Mobile uses a white left drawer with a dimmed backdrop. Logout sits in the sidebar footer rather than the utility header.

## Considered Approaches

1. **Reference interaction and visual migration — selected.** Add the white sidebar, persistent desktop collapse, reference-like navigation states, and sidebar footer while retaining Matahari's shell contracts.
2. **CSS-only reskin.** Preserve the current fixed width and move no controls. This is smaller but does not reproduce the reference system's defining collapsed rail.
3. **Full shell replacement.** Copy both sidebar and header composition. This goes beyond the requested sidebar scope and risks disturbing useful school/page context.

## Component Design

`AdminShell` remains the only component responsible for the authenticated shell. It gains a desktop-only `isCollapsed` state initialized from `localStorage` under a Matahari-specific key. The existing `isOpen` state remains exclusively for the narrow-screen drawer.

Desktop behavior:

- expanded width: 256 pixels;
- collapsed width: 80 pixels;
- white background, slate border/text, and low-elevation right shadow;
- 96-pixel brand area using the existing `BrandMark` and product naming;
- compact menu rows with the existing icons and labels;
- pale blue active state using the existing brand colors;
- an edge-mounted collapse/expand control with an accessible label;
- product context and logout in a fixed footer;
- labels become visually hidden in collapsed mode while `title` and `aria-label` preserve discoverability.

Mobile behavior:

- no collapsed rail state is exposed;
- the existing menu button, backdrop, close button, Escape handling, focus restoration, body scroll lock, and close-on-navigation behavior remain;
- the drawer uses the expanded white-sidebar presentation and shows all allowed labels.

The utility header keeps school context, page title, API warning, and user identity. Its duplicate logout icon is removed because logout moves into the sidebar footer.

## Functional Boundaries

This change does not alter:

- `navGroups` definitions or labels;
- permission-based filtering in `App.tsx`;
- page keys or page-selection validation;
- API calls, authentication, logout behavior, backend routes, or school scope;
- page content, business workflows, financial behavior, or database state.

Navigation group names remain available to assistive technology even when the visual treatment follows the reference application's spacing-first grouping.

## Accessibility and Failure Handling

- The collapse control reports `aria-expanded` and a state-specific accessible name.
- Collapsed navigation and footer actions retain accessible names and native button behavior.
- A missing or inaccessible local-storage value falls back to the expanded sidebar.
- Mobile hidden navigation remains inert, and the workspace remains inert while the drawer is open.
- Reduced-motion preferences continue to disable sidebar transitions.

## Verification

Focused verification adds one behavior test covering collapse, persisted preference, and unchanged navigation/logout callbacks. Existing drawer, focus, service-warning, and page-selection tests remain.

Required frontend verification:

- focused `AdminShell` Vitest file;
- full Vitest suite;
- Oxlint;
- TypeScript and Vite production build.

Browser smoke validation checks expanded desktop, collapsed desktop, and narrow drawer presentation. No backend or database test is required because the change is isolated to frontend presentation and shell-local state.
