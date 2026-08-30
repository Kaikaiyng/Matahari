# Design System — RYLAY School App (MIS tenant)

**Current visual baseline:** integrated feature delivery reviewed 2026-08-26

## Product Context

- **What this is:** A private school communication and self-service App sharing the MIS Laravel API and database with the Admin Panel.
- **Who it serves:** Parents, students, and teachers. Elevated employees remain in the Teacher persona through explicit User Abilities.
- **Product posture:** The Home screen should feel alive with real school moments. Academic, attendance, and finance records must feel precise and trustworthy.
- **Memorable quality:** Parents should feel that they can see school life and understand what needs attention without learning an ERP.

## Aesthetic Direction

- **Direction:** Warm School Editorial.
- **Decoration:** Intentional. Photography and school content provide personality; interface chrome stays restrained.
- **Layout:** School Updates-first hybrid. Update pages use a generous single column; records use compact structured rows and clear totals.
- **Avoid:** Generic blue-white ERP dashboards, decorative gradients, identical card grids, childish game styling, fake operational buttons, and public-social-network mechanics.

## Typography

- **Display and headings:** General Sans, 600–700.
- **Body and controls:** Source Sans 3, 400–700.
- **Amounts, scores, dates, and attendance totals:** Geist with tabular numerals.
- **Fallback:** A readable sans-serif fallback is allowed while web fonts load.
- **Scale:** 12, 14, 16, 18, 22, 28, and 36px. Mobile body copy remains at least 15px.

## Color

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

## Spacing and Shape

- **Base unit:** 4px.
- **Scale:** 4, 8, 12, 16, 20, 24, 32, and 48px.
- **Density:** Phone-first and calm. Major sections use 20â€“30px vertical separation; related rows may remain compact, but nested card-on-card layouts should be avoided.
- **Radius:** 12â€“18px controls and rows, 22â€“25px major mobile surfaces, and pills for statuses, filters, and the floating navigation capsule.
- **Shadow:** Soft and restrained. Use it to separate floating navigation and major paper surfaces from the warm canvas, not on every row.
- **Touch target:** At least 44 by 44px.

## Navigation

- Parent: Home, Children, Academics, Finance, More.
- Student: Home, Learn, Quiz, Schedule, More.
- Teacher: Home, Classes, Create, Attendance, More.
- The primary mobile navigation is a floating liquid-glass capsule above the device safe area. Its active destination shows icon and label; inactive destinations remain recognizable icons with accessible labels.
- The capsule uses a translucent white fallback everywhere and adds `backdrop-filter` blur/saturation only where supported. Content keeps sufficient bottom clearance so the navigation never hides the final action.
- Notifications open from the persistent top bar rather than consuming a bottom-navigation slot.
- Multi-role users may switch roles, but each role receives its own navigation and scoped content.
- Sign out belongs in each role's More/Profile page rather than the persistent header.

## Layered Subpages — Reusable Checkpoint

**Checkpoint status:** Approved for reuse as of 2026-08-30, but not the final App design specification. Refine this pattern through later real-device and user testing rather than treating current dimensions as permanently frozen.

### Information hierarchy

- The role destination or profile surface is level one.
- A feature hub such as Safety Centre opens as a full-height level-two surface above level one.
- Details selected from that hub open as level-three surfaces above level two. Policy, support and record-detail pages should not replace the level-two hub when users are expected to return to it.
- Direct public routes may still render standalone pages for store review, external links and unauthenticated access; authenticated in-App navigation should use the layered surface.

### Surface composition

- Every layered page reuses the centred title bar, 38px rounded back control, matching spacer, Warm Canvas background and safe bottom clearance.
- Use one clear introductory or identity card when context is useful, followed by section headings and grouped Paper surfaces.
- Major surfaces use 20–24px radius, restrained borders and soft shadows. Related rows share one outer card instead of becoming separate floating cards.
- Icons use a light MIS Crimson tint surface. Titles remain Deep Ink, descriptions remain Muted Ink, and blue browser-link styling must not appear inside App navigation cards.
- Empty states remain compact and informative: icon, direct status title and one short explanation. Do not allocate a large blank panel for zero records.

### Motion and back behavior

- Opening a deeper level slides only the new surface in from the right.
- During a rightward swipe-back, the active surface follows the finger while its immediate previous level remains mounted, fixed and visible underneath.
- Completing or cancelling a gesture must affect only the topmost surface. Nested surfaces stop touch propagation so one gesture never closes two levels.
- Back buttons use the same exit animation and callback as swipe-back. The removed surface is unmounted only after the exit transition completes.
- Horizontal scrollers, form controls and marked interactive regions keep the shared swipe exclusions, and reduced-motion preferences remain respected.

### State and implementation contract

- The parent surface owns the active child identifier and remains mounted while the child is open, preserving its fetched data, scroll position and UI state.
- Reuse the shared `useSwipeBack` behavior and `subpage-slide-overlay` shell. A tertiary surface receives an explicit `onBack` callback and renders at the next overlay layer.
- Keep API authorization and tenant/school scoping unchanged. Layering is a navigation and presentation pattern, not a new data-access path.
- Safety Centre and its policy/support details are the current reference implementation. Apply the pattern to other suitable record-detail flows only when their navigation hierarchy matches this model.

## Motion

- **Approach:** Minimal and functional.
- Use 120–220ms transitions for sheets, tab changes, media viewers, and reaction feedback.
- Secondary pages support left-edge swipe-back: the current page follows the gesture while the previous page remains fixed beneath it. Horizontal category/content scrolling must not trigger navigation.
- Respect `prefers-reduced-motion`.
- Do not use splash screens, forced tours, or scroll choreography.

## Content and Trust

- School Update visibility is private and relationship-scoped by Laravel.
- Employees with effective same-school `community.publish` may publish immediately to the whole school or multiple active classes. Parent and Student never publish from their persona.
- Authorized readers may Like or submit a Post Report when eligible. Current Updates have no comments, new direct-Student targeting, blocking, appeals, or routine approval.
- Likes show count and the current user's state, not a public list of minors.
- Finance is read-only: no `Pay now`, payment simulation, or gateway language.
- Draft assessments and unpublished Quiz results never appear to Parent/Student users.
- Preview-only content is explicitly labelled and never presented as authoritative data.

## Decisions Log

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
