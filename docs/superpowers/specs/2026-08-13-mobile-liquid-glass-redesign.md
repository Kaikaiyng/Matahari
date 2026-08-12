# MIS App Mobile Liquid Glass Redesign

**Status:** Approved design

**Approved:** 2026-08-13

## Objective

Modernize the existing MIS Community App without changing its product model, authorization, or backend behavior. The result must read as a purpose-built phone application: calmer, less crowded, easier to scan with one hand, and visually distinct from the desktop Admin Panel.

The selected direction is a floating Liquid Glass navigation capsule. The active destination expands to show its icon and label; inactive destinations retain icon-only 44px touch targets.

## Experience Principles

1. **One primary idea per viewport.** The first phone viewport should contain the page identity, one contextual action or summary, and the beginning of the content—not several competing panels.
2. **Content over chrome.** School photographs, attendance state, results, and finance records carry the page. Borders and containers are used only when they clarify grouping.
3. **Native-mobile rhythm.** Use safe areas, generous horizontal gutters, thumb-sized controls, and a floating bottom navigation rather than desktop-style full-width bars.
4. **Trust remains explicit.** Preview-only community, assessment, Quiz, and schedule content keeps a visible but quiet preview marker. Finance remains read-only.
5. **Role scope stays visible.** Each role receives its own navigation and content; the UI never implies permissions that Laravel does not grant.

## App Shell

### Header

- Reduce the persistent header to approximately 56px plus the top safe area.
- Show a compact MIS mark and a contextual product label rather than the full school name on narrow screens.
- Keep Notifications and Profile as 44px controls.
- Remove the dedicated Logout icon from the header. Logout remains an explicit action in the More/Profile page.
- Multi-role switching remains available, but uses a compact role pill and does not compete with the page title.
- Use restrained translucent material so the header separates from scrolling content without appearing as a second navigation bar.

### Role-Specific Bottom Navigation

The logical destinations remain:

- Parent: Home, Children, Academics, Finance, More.
- Student: Home, Learn, Quiz, Schedule, More.
- Teacher: Home, Classes, Create, Attendance, More.
- Staff: Home, School, Create, Review, More.

Presentation rules:

- The navigation floats 12–16px from the viewport sides and bottom safe area.
- The container is one rounded capsule with translucent white material, a subtle white highlight, blur/saturation, and a soft dark shadow.
- The active item expands horizontally and displays icon plus label in a lightly tinted MIS-crimson capsule.
- Inactive items display only their icons but retain accessible names and a minimum 44px target.
- Layout must remain stable when the active destination changes; all five actions must fit at 360px width without overflow.
- Use `backdrop-filter` only as progressive enhancement. A sufficiently opaque fallback background must remain readable when blur is unavailable.

## Density and Layout

- Use 18–20px phone gutters and 24–32px between major sections.
- Increase bottom content padding so the floating navigation never obscures the final control.
- Replace repeated bordered cards with larger calm surfaces, grouped rows, or whitespace where the relationship is already obvious.
- Avoid putting a border, shadow, background, and radius on the same minor element.
- Page headings remain large but use less vertical scaffolding: short eyebrow, title, and one supporting sentence at most.
- Desktop preview may center the phone experience in a wider canvas, but must not turn the App into a tablet dashboard.

## Feed

- Keep the Feed as the home experience.
- Make post media the primary visual surface and simplify author/time/audience metadata into one compact header.
- Reduce the number of simultaneously visible labels, outlines, and actions.
- Treat finance attention or Teacher creation as a single compact contextual module above the feed—not a dashboard grid.
- Retain appreciations, controlled comments, audience labels, and preview status.
- Reactions use a brief tactile visual response without public lists of minors.

## Record Pages

- Attendance, academics, children, finance, Quiz, schedule, class, composer, and profile pages share the same spacing and surface language.
- Summary data may use one prominent tonal surface; supporting records use quiet rows with separators.
- Attendance status controls remain large enough for rapid Teacher entry and retain text/legend support so color is not the only signal.
- Parent Finance continues to contain no payment action.
- Logout appears in every role's More/Profile page as an explicit destructive-secondary action.

## Visual Material

- Preserve MIS crimson, deep ink, warm canvas, academic blue, attendance green, amber, and semantic error red.
- Introduce glass tokens for translucent surface, highlight border, blur, saturation, and elevation.
- Glass is reserved for persistent navigation/header overlays. Content cards remain primarily opaque for legibility and performance.
- Radius hierarchy: approximately 28–32px navigation capsule, 18–24px primary surfaces, 14–18px controls and rows, and full pills only for statuses/filters.
- Motion uses 160–240ms easing for active-nav expansion, press response, sheets, and lightweight page entry. Honor `prefers-reduced-motion`.

## Architecture and Scope

- Implement within the existing `app/` React workspace and shared CSS/components.
- Preserve the existing `AppRole`, `navByRole`, role gates, API calls, Attendance behavior, Parent Finance behavior, and backend authorization.
- Refactor oversized styling only where it directly improves this redesign's maintainability.
- Do not add a UI framework, animation package, authentication package, or native dependency.
- Admin `frontend/` behavior is outside this visual change except for regression verification.

## Error, Loading, and Accessibility

- Loading, empty, permission, and error states must use the same calmer spacing and remain visible above the floating navigation.
- Icon-only navigation controls require their visible-role label as `aria-label`/accessible text.
- Focus-visible treatment must remain obvious on translucent surfaces.
- Touch targets are at least 44px; text and interactive contrast must remain readable over glass fallback and live blur.
- Support 360×800, 390×844, and 430×932 phone viewports without horizontal scrolling or clipped navigation labels.

## Verification

- Update component tests to prove role-specific destinations and active-label behavior.
- Run App Vitest, Oxlint, TypeScript, and Vite production build.
- Run existing Admin tests/build for regression safety.
- Visually inspect at least Parent Home, Student Learn/Quiz, Teacher Attendance, and Staff Home/Review at representative phone widths.
- Verify safe-area spacing, the last-scroll-item clearance, active navigation transitions, long names, empty/loading/error states, and reduced-motion fallback.
- Review the final Git diff, commit the implementation, synchronize with the latest remote default branch, merge to `master`, and push only after the checks pass.

## Non-Goals

- No community persistence/media backend.
- No Assessment, Quiz, or Schedule backend implementation.
- No native packaging, Firebase, Capacitor, Sanctum, or native authentication.
- No payment interface or finance-domain changes.
- No redesign of the desktop Admin application.
