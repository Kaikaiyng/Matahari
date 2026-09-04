# Matahari UI Design System — Admin Panel and School App

**Current visual baseline:** approved reusable checkpoint reviewed 2026-08-30. This is not the final design specification.

## Shared Product Principles

- Admin Panel and School App share Matahari product identity, MIS tenant colours, clear information hierarchy, honest system states, accessible controls and restrained motion.
- They are separate runtime and visual surfaces. Reuse interaction principles and brand meaning, but do not apply desktop Admin density directly to the phone-first App or App editorial cards directly to operational Admin tables.
- MIS Crimson indicates active navigation and primary action. Deep Ink carries the visual centre; Muted Ink supports it. Semantic green, amber and red retain their operational meanings.
- UI visibility never replaces backend authorization, tenant/school scope or audited business rules.
- Never fabricate operational data, buttons, exports, health indicators or integrations merely to complete a visual reference.

## Admin Panel — MAW-Derived Personal Pattern

This is the owner's reusable desktop administration pattern, adapted from MAW structure and motion while retaining Matahari workflows, MIS branding and permission enforcement. Dashboard and `frontend/src/PersonalAdminPattern.css` are the current visual references.

### Shell and page layout

- Use the white MIS-branded sidebar, 80px brand area and 56px top utility bar. Desktop collapse slides the entire sidebar away; mobile uses the existing drawer.
- Sidebar groups use icon-led parent rows, indented text-only children, aligned icon columns and persisted expansion/collapse state.
- Main content is centred at a maximum width of 1600px with 32px horizontal and 24px vertical desktop padding. Responsive layouts reduce padding before content becomes cramped.
- Page headings are compact and unboxed: title first, then optional live status, update timestamp and a working refresh action. Do not restore decorative hero banners above operational pages.
- Parent layouts own the 16px gap between sibling cards and panels. Child components must not add a second outer margin.

### Admin typography and density

- Use Plus Jakarta Sans throughout navigation, pages, controls, tables and dialogs. JetBrains Mono is reserved for technical identifiers, logs and payloads.
- Standard scale: 24px page title, 18px section/dialog title, 15px card title, 14px body copy, 13px forms/tables/navigation, 12px supporting copy, 11px eyebrow/table heading and 24px primary metrics.
- Visual weight belongs to the page title, important value or current task—not simultaneously to every card heading and button.
- Tables and operational lists remain compact but readable; mobile/tablet adaptations may become labelled record cards when columns no longer scan safely.

### Admin surfaces and components

- Dashboard is the canonical card reference: white Paper, 12px primary radius, neutral one-pixel border, subtle shadow and at most a restrained one-pixel interactive lift.
- Statistic cards place copy and value on the left and a soft semantic icon tile on the right. Values come from the same source used by their linked detail view.
- Use shared statistic cards, data panels, filter toolbars, custom searchable selects, system date/time pickers and dialogs. Browser-default selects and date popovers are not part of the approved pattern.
- Search and filters belong in one toolbar surface. Tables belong in a separate data panel with quiet uppercase headings, aligned values and explicit status pills.
- Settings uses a left category rail and one right editing workspace. Live previews must show what the App will render, using either configured values or clearly non-persisted examples.
- Audit Trail and Application Logs follow the compact operational pattern: summaries, filters, dense inspectable rows and inline sanitized detail. Dark monospace panels are limited to technical payloads.

### Admin controls and motion

- Primary actions use MIS Crimson; destructive actions require explicit destructive treatment. Disabled and read-only states must explain why when the reason is permission-related.
- Use 200ms sidebar travel, 300ms navigation grouping, 240ms popovers, 260ms opening and 190ms closing for collapsible content, with the existing easing and reduced-motion fallbacks.
- Expansion animation must preserve icon and label alignment. One control action must not visually toggle an unrelated permission or field.
- Keep focus-visible treatment, keyboard access and at least 44px touch targets where Admin is used on tablet/mobile.

### Admin reuse boundary

- New Admin pages should compose the existing shell, Dashboard-style cards, toolbars, data panels and system controls before creating new primitives.
- MAW is a layout, typography, surface and motion reference—not a source of Matahari data, permissions, terminology or unsupported features.
- This Admin pattern is a checkpoint. Exact sizes may evolve after broader page and device review, but new work should remain internally consistent with it until superseded here.

### Admin implementation recipe

Use these repository sources instead of copying a screenshot or recreating similar CSS:

| Need | Reuse first | Canonical source |
| --- | --- | --- |
| Application shell, grouped sidebar and collapse | `AdminShell` | `frontend/src/components/AdminShell.tsx` and `AdminShell.css` |
| Page heading, metrics, filters, data panels and dialogs | `PageHeader`, `StatCard`, `FilterToolbar`, `DataPanel`, `ModalFrame` | `frontend/src/components/AdminUi.tsx` and `AdminUi.css` |
| Date and time controls | `DatePicker`, `TimePicker` | `frontend/src/components/SystemDateTimePicker.tsx` |
| Custom selection controls | Existing Admin custom-select components | `frontend/src/components/AdminUi.tsx` |
| Global MAW-derived page/card treatment | Existing scoped selectors and tokens | `frontend/src/PersonalAdminPattern.css` |
| Brand, surface, spacing and motion tokens | Existing `--admin-*` variables | `frontend/src/index.css` |

Admin motion tokens are implementation contracts for new shared interactions:

| Token or interaction | Value | Intended use |
| --- | --- | --- |
| `--admin-motion-fast` | `140ms` | Hover, focus, colour and small control feedback |
| `--admin-motion-standard` | `200ms` | Cards, buttons, dialogs and sidebar travel |
| `--admin-motion-popover` | `240ms` | Popovers and floating menus |
| `--admin-motion-expand` | `260ms` | Opening expandable content |
| `--admin-motion-collapse` | `190ms` | Closing expandable content |
| `--admin-motion-navigation` | `300ms` | Sidebar group/chevron navigation motion |
| `--admin-ease-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` | Decelerating entrance for dialogs and prominent surfaces |

Do not duplicate these values inside a new component when a token applies. Animate `transform` and `opacity` for moving surfaces; use colour/border transitions for state feedback. Avoid `transition: all`, layout-heavy animation, bounce effects and simultaneous animation of unrelated controls. Every new animation needs a `prefers-reduced-motion` fallback through the existing Admin rules.

## School App — Warm School Editorial Pattern

### Product Context

- **What this is:** A private school communication and self-service App sharing the MIS Laravel API and database with the Admin Panel.
- **Who it serves:** Parents, students, and teachers. Elevated employees remain in the Teacher persona through explicit User Abilities.
- **Product posture:** The Home screen should feel alive with real school moments. Academic, attendance, and finance records must feel precise and trustworthy.
- **Memorable quality:** Parents should feel that they can see school life and understand what needs attention without learning an ERP.

### Aesthetic Direction

- **Direction:** Warm School Editorial.
- **Decoration:** Intentional. Photography and school content provide personality; interface chrome stays restrained.
- **Layout:** School Updates-first hybrid. Update pages use a generous single column; records use compact structured rows and clear totals.
- **Avoid:** Generic blue-white ERP dashboards, decorative gradients, identical card grids, childish game styling, fake operational buttons, and public-social-network mechanics.

### Typography

- **Display and headings:** General Sans, 600–700.
- **Body and controls:** Source Sans 3, 400–700.
- **Amounts, scores, dates, and attendance totals:** Geist with tabular numerals.
- **Fallback:** A readable sans-serif fallback is allowed while web fonts load.
- **Scale:** 12, 14, 16, 18, 22, 28, and 36px. Mobile body copy remains at least 15px.

### Color

- **MIS Crimson:** `#C92A49` for primary actions, active navigation, and school identity.
- **Deep Ink:** `#172033` for titles and primary text.
- **Warm Canvas:** `#F6F3EE` for the application background.
- **Paper:** `#FFFFFF` for content surfaces.
- **Academic Blue:** `#2F6FED` for learning information.
- **Attendance Green:** `#20835A` for present, complete, and positive states.
- **Attention Amber:** `#C98618` for outstanding balance, late status, and reminders.
- **Error Red:** `#B42318` for absence, errors, and destructive actions.
- **Muted Ink:** `#677085`; **Border:** `#DDD9D1`.
- Color never carries meaning alone; every status also has a label or icon.

### Spacing and Shape

- **Base unit:** 4px.
- **Scale:** 4, 8, 12, 16, 20, 24, 32, and 48px.
- **Density:** Phone-first and calm. Major sections use 20â€“30px vertical separation; related rows may remain compact, but nested card-on-card layouts should be avoided.
- **Radius:** 12â€“18px controls and rows, 22â€“25px major mobile surfaces, and pills for statuses, filters, and the floating navigation capsule.
- **Shadow:** Soft and restrained. Use it to separate floating navigation and major paper surfaces from the warm canvas, not on every row.
- **Touch target:** At least 44 by 44px.

### Navigation

- Parent: Home, Children, Academics, Finance, More.
- Student: Home, Learn, Quiz, Schedule, More.
- Teacher: Home, Classes, Create, Attendance, More.
- The primary mobile navigation is a floating liquid-glass capsule above the device safe area. Its active destination shows icon and label; inactive destinations remain recognizable icons with accessible labels.
- The capsule uses a translucent white fallback everywhere and adds `backdrop-filter` blur/saturation only where supported. Content keeps sufficient bottom clearance so the navigation never hides the final action.
- Notifications open from the persistent top bar rather than consuming a bottom-navigation slot.
- Multi-role users may switch roles, but each role receives its own navigation and scoped content.
- Sign out belongs in each role's More/Profile page rather than the persistent header.

### Layered Subpages — Reusable Checkpoint

**Checkpoint status:** Approved for reuse as of 2026-08-30, but not the final App design specification. Refine this pattern through later real-device and user testing rather than treating current dimensions as permanently frozen.

#### Information hierarchy

- The role destination or profile surface is level one.
- A feature hub such as Safety Centre opens as a full-height level-two surface above level one.
- Details selected from that hub open as level-three surfaces above level two. Policy, support and record-detail pages should not replace the level-two hub when users are expected to return to it.
- Direct public routes may still render standalone pages for store review, external links and unauthenticated access; authenticated in-App navigation should use the layered surface.

#### Surface composition

- Every layered page reuses the centred title bar, 38px rounded back control, matching spacer, Warm Canvas background and safe bottom clearance.
- Use one clear introductory or identity card when context is useful, followed by section headings and grouped Paper surfaces.
- Major surfaces use 20–24px radius, restrained borders and soft shadows. Related rows share one outer card instead of becoming separate floating cards.
- Icons use a light MIS Crimson tint surface. Titles remain Deep Ink, descriptions remain Muted Ink, and blue browser-link styling must not appear inside App navigation cards.
- Empty states remain compact and informative: icon, direct status title and one short explanation. Do not allocate a large blank panel for zero records.

#### Motion and back behavior

- Opening a deeper level slides only the new surface in from the right.
- During a rightward swipe-back, the active surface follows the finger while its immediate previous level remains mounted, fixed and visible underneath.
- Completing or cancelling a gesture must affect only the topmost surface. Nested surfaces stop touch propagation so one gesture never closes two levels.
- Back buttons use the same exit animation and callback as swipe-back. The removed surface is unmounted only after the exit transition completes.
- Horizontal scrollers, form controls and marked interactive regions keep the shared swipe exclusions, and reduced-motion preferences remain respected.

#### State and implementation contract

- The parent surface owns the active child identifier and remains mounted while the child is open, preserving its fetched data, scroll position and UI state.
- Reuse the shared `useSwipeBack` behavior and `subpage-slide-overlay` shell. A tertiary surface receives an explicit `onBack` callback and renders at the next overlay layer.
- Keep API authorization and tenant/school scoping unchanged. Layering is a navigation and presentation pattern, not a new data-access path.
- Safety Centre and its policy/support details are the current reference implementation. Apply the pattern to other suitable record-detail flows only when their navigation hierarchy matches this model.

#### Layered-page implementation recipe

1. Keep the level-one page mounted and let it own whether the level-two component exists.
2. The level-two component owns its selected detail identifier and keeps itself mounted while rendering level three.
3. Each moving surface calls `useSwipeBack(onBack)` and applies both `gestureHandlers` and `surfaceStyle` to its outermost full-height overlay.
4. Use `subpage-slide-overlay`, `subpage-container`, `subpage-header`, `subpage-back-btn`, `subpage-nav-title` and the matching 38px spacer rather than rebuilding the shell.
5. Render the deeper surface above its parent, but do not remove, translate or refetch the parent merely because the child opened.
6. Close through the hook's `requestBack`; do not clear parent state until its 220ms exit callback fires.
7. Mark horizontal scrollers with `data-horizontal-scroll="true"` and exceptional interactive regions with `data-prevent-swipe="true"`.
8. Test that the top surface opens, the immediate parent remains mounted, a left swipe does nothing and one right swipe closes exactly one level.

Reference implementation:

| Need | Canonical source |
| --- | --- |
| Gesture thresholds, direction lock, follow-finger transform and exit timing | `app/src/components/useSwipeBack.ts` |
| Gesture regression tests | `app/src/components/useSwipeBack.test.tsx` |
| Level-two owner and level-three selection state | `app/src/features/community-safety/CommunitySafetyCentre.tsx` |
| Level-three policy/support surface | `app/src/features/community-safety/SafetyPolicySubpage.tsx` |
| Layered shell, cards, entrance/exit and reduced-motion styling | `app/src/features/community-safety/CommunitySafety.css` |

### Motion

- **Approach:** Minimal and functional.
- Use 120–220ms transitions for sheets, tab changes, media viewers, and reaction feedback.
- Secondary pages support left-edge swipe-back: the current page follows the gesture while the previous page remains fixed beneath it. Horizontal category/content scrolling must not trigger navigation.
- Respect `prefers-reduced-motion`.
- Do not use splash screens, forced tours, or scroll choreography.

App motion checkpoint:

| Interaction | Timing and easing | Required behavior |
| --- | --- | --- |
| Full subpage entrance | `260ms cubic-bezier(0.25, 1, 0.5, 1)` | Slide from `translateX(100%)` to rest above a fixed parent |
| Full subpage exit/rebound | `220ms cubic-bezier(0.25, 1, 0.5, 1)` | Follow the gesture or button action; unmount only after completion |
| Swipe completion | More than 30% width, or a rightward flick over 45px within 250ms | Close exactly one active level |
| Swipe direction lock | Right delta over 8px and greater than vertical movement × 1.1 | Prevent vertical scroll and left swipe from becoming Back |
| Bottom capsule selection | Grow `200ms cubic-bezier(0.2, 0.8, 0.2, 1)`; colour/background `180ms ease` | Preserve the Matahari liquid-capsule identity |
| Select/popover entrance | `180ms cubic-bezier(0.16, 1, 0.3, 1)` | Short fade and upward offset only |
| Press feedback | `150–160ms ease` | Small scale or one-pixel lift; never a large bounce |
| Skeleton shimmer | `1.2–1.5s ease-in-out/linear` | Loading indication only; disable for reduced motion |

The exact swipe mathematics live only in `useSwipeBack`; new screens consume the hook rather than cloning it. If motion values change after device testing, update the shared implementation and this checkpoint together.

### Content and Trust

- School Update visibility is private and relationship-scoped by Laravel.
- Employees with effective same-school `community.publish` may publish immediately to the whole school or multiple active classes. Parent and Student never publish from their persona.
- Authorized readers may Like or submit a Post Report when eligible. Current Updates have no comments, new direct-Student targeting, blocking, appeals, or routine approval.
- Likes show count and the current user's state, not a public list of minors.
- Finance is read-only: no `Pay now`, payment simulation, or gateway language.
- Draft assessments and unpublished Quiz results never appear to Parent/Student users.
- Preview-only content is explicitly labelled and never presented as authoritative data.

### Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-12 | Community Feed was selected as the original Home direction | Historical decision superseded by official School Updates while retaining school moments on Home. |
| 2026-08-12 | Controlled comments rather than an open forum | Historical decision superseded on 2026-08-24; active School Updates have Likes and Post Reports but no comments. |
| 2026-08-12 | General attendance-session model | Supports daily, lesson, and event attendance without rewriting history; the first UI exposes daily attendance. |
| 2026-08-12 | Assigned Quiz and Practice Quiz are separate | Formal teacher assessments must not be mixed with student self-practice. |
| 2026-08-12 | Parent Finance is read-only | The App reuses authoritative finance records without adding a payment interface. |
| 2026-08-13 | Role-aware liquid-glass mobile navigation | A floating capsule preserves thumb reach and role clarity while reducing the visual weight of five persistent labels. |
| 2026-08-13 | Calm phone-first record surfaces | More spacing, fewer nested borders, and grouped rows make academic, attendance, finance, Quiz, and profile pages easier to scan on 360â€“430px screens. |
| 2026-08-21 | Fixed-underlay swipe-back | Revealing a stationary previous page beneath the moving secondary page makes back navigation feel continuous without disturbing horizontal content controls. |
| 2026-08-24 | Official School Updates replace social posting | Authorized employees publish immediately to whole-school or selected-class audiences; Likes and Post Reports remain, while comments and open social mechanics are removed. |
| 2026-08-30 | Safety Centre uses a grouped private hub | Report status, safety standards, legal/account policies, and configured school support remain distinct while sharing the App's Warm School Editorial surfaces. Its entries open third-level surfaces whose swipe-back reveals the fixed Safety Centre beneath them. |
