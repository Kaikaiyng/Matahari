# Design System — MIS App

## Product Context

- **What this is:** A private school-community and self-service App sharing the MIS Laravel API and database with the Admin Panel.
- **Who it serves:** Parents, students, teachers, and authorized school staff.
- **Product posture:** The Home screen should feel alive with real school moments. Academic, attendance, and finance records must feel precise and trustworthy.
- **Memorable quality:** Parents should feel that they can see school life and understand what needs attention without learning an ERP.

## Aesthetic Direction

- **Direction:** Warm School Editorial.
- **Decoration:** Intentional. Photography and school content provide personality; interface chrome stays restrained.
- **Layout:** Feed-first hybrid. Story pages use a generous single column; records use compact structured rows and clear totals.
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
- **Density:** Comfortable in the Feed; compact in tables, attendance rosters, results, and finance records.
- **Radius:** 8px controls, 12px information panels, 18px major mobile surfaces, pill only for statuses and filters.
- **Shadow:** Rare and shallow. Prefer borders and surface contrast.
- **Touch target:** At least 44 by 44px.

## Navigation

- Parent: Home, Children, Academics, Finance, More.
- Student: Home, Learn, Quiz, Schedule, More.
- Teacher/Staff: Home, Classes, Create, Attendance, More.
- Notifications open from the persistent top bar rather than consuming a bottom-navigation slot.
- Multi-role users may switch roles, but each role receives its own navigation and scoped content.

## Motion

- **Approach:** Minimal and functional.
- Use 120–220ms transitions for sheets, tab changes, media viewers, and reaction feedback.
- Respect `prefers-reduced-motion`.
- Do not use splash screens, forced tours, or scroll choreography.

## Content and Trust

- Feed visibility is private and relationship-scoped by Laravel.
- Staff and assigned teachers may publish; Parent/Student users react and comment only where enabled.
- Likes show count and the current user's state, not a public list of minors.
- Finance is read-only: no `Pay now`, payment simulation, or gateway language.
- Draft assessments and unpublished Quiz results never appear to Parent/Student users.
- Preview-only content is explicitly labelled and never presented as authoritative data.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-12 | Community Feed is the Home experience | School moments create a reason to open the App; personal records remain one clear navigation step away. |
| 2026-08-12 | Controlled comments rather than an open forum | Provides participation while keeping school moderation and child privacy manageable. |
| 2026-08-12 | General attendance-session model | Supports daily, lesson, and event attendance without rewriting history; the first UI exposes daily attendance. |
| 2026-08-12 | Assigned Quiz and Practice Quiz are separate | Formal teacher assessments must not be mixed with student self-practice. |
| 2026-08-12 | Parent Finance is read-only | The App reuses authoritative finance records without adding a payment interface. |
