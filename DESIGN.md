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
| 2026-08-30 | Safety Centre uses a grouped private hub | Report status, safety standards, legal/account policies, and configured school support remain distinct while sharing the App's Warm School Editorial surfaces and swipe-back behavior. |
