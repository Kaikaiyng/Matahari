# Personal Admin UI Pattern Design

**Implementation status:** Implemented locally on 2026-08-30. The owner must visually confirm the Admin workspace before the branch is pushed.

**Status:** Owner-approved design for the RYLAY Admin Panel

**Reference snapshot:** Latest local `MewahAutoWork/MAW_AdminPanel` source reviewed on 2026-08-30. Its `guidelines/Guidelines.md` contains only the original empty template, so the implemented component and stylesheet source is the authoritative reference.

## Goal

Make the latest MAW Admin design language the owner's default personal Admin UI Pattern. Apply it consistently across the complete RYLAY Admin Panel while preserving Matahari branding, school-domain behaviour, backend-authoritative permissions, real API data and the independent School App.

## Source of truth

The reference order is:

1. Latest MAW shared styles in `src/styles/theme.css` and `src/styles/fonts.css`.
2. Latest MAW shell and navigation in `dashboard-layout.tsx`.
3. Latest MAW shared Admin controls, especially `admin-metric-card`, `admin-form-dialog`, `admin-select`, `admin-searchable-select`, `admin-combobox`, and desktop date/time pickers.
4. Latest implemented MAW pages such as Dashboard, Settings, Audit Trail and Application Logs.
5. Historical screenshots only when they do not conflict with current source.

Future RYLAY Admin UI work uses this pattern by default. MAW business nouns, data structures, permissions and endpoints are never a design source.

## Brand adaptation

- Keep the MIS logo and resolved tenant/school identity.
- Replace MAW blue primary actions, selected navigation and focus accents with the resolved Matahari/RYLAY burgundy brand tokens.
- Preserve semantic colours: green for success, amber for warning, red for destructive/error, blue or violet for neutral informational distinctions.
- Never recolour every surface burgundy. Brand colour establishes focus and selection; neutral slate surfaces preserve hierarchy and readability.

## Layout and typography

- Plus Jakarta Sans is the Admin font; JetBrains Mono is limited to technical identifiers and payloads.
- Type scale: 24px page title, 18px section/dialog title, 15px card title, 14px body, 13px navigation/form/table values, 12px supporting copy and 11px eyebrows/table headings/badges.
- Desktop utility bar is 56px, sidebar brand area is 80px, and content is centred with a 1600px maximum.
- Desktop content padding is 32px horizontal by 24px vertical; tablet uses 24px by 20px; narrow phone Admin uses 16px by 20px.
- Parent layouts own 16px sibling card/panel gaps. Major page groups may use 20px vertical rhythm.
- Admin remains desktop-efficiency-first while preserving existing tablet and phone reachability.

## Surface language

- Page background is a very light neutral slate with a restrained brand-tinted radial wash.
- Primary cards use white surfaces, neutral one-pixel borders, 12–14px radii and subtle two-layer shadows.
- Hoverable cards move no more than two pixels, slightly strengthen their border and shadow, and never use exaggerated glow.
- Metric cards use label/value/detail on the left and a soft semantic icon tile on the right; a chevron appears only when the card navigates.
- Tables use compact 11px uppercase headers, 13px body cells, slate header surfaces, quiet row separators and a restrained hover background.
- Status chips use soft semantic fills and borders. Empty states sit inside quiet inset surfaces rather than oversized blank cards.

## Shared component architecture

Translate the MAW pattern into the existing RYLAY React/CSS architecture without importing MAW's Tailwind, MUI or automotive business implementation.

The shared Admin layer owns:

- Page heading and action row.
- Metric card and summary grid.
- Filter/search bar and segmented filters.
- Data panel, compact table, pagination and inline expansion.
- Primary, secondary, tertiary, icon and destructive actions.
- Status badge, notice, empty, loading and error states.
- Searchable Select, Combobox, date picker and time picker.
- Form field, checkbox, switch and validation presentation.
- Form dialog with fixed header, scrollable sectioned body and fixed footer.
- Confirmation dialog and toast/inline feedback presentation.

Existing components are consolidated instead of adding page-specific duplicates. No new frontend package is required.

## Shell and navigation

- Reproduce the latest MAW desktop sidebar proportions, active treatment, icon alignment, collapsible grouping and compact sub-navigation using RYLAY routes and permission visibility.
- Desktop sidebar hide/show uses a 200ms transform and matching main-content padding transition.
- Sidebar labels fade/translate in 100ms, with a short delayed entrance when expanding.
- Group chevrons rotate over 300ms and child lists expand through animated grid rows and opacity over 300ms.
- Preserve the responsive drawer, top breadcrumb, notification panel, account identity and logout controls.
- Notification categories remain horizontally usable without clipping and do not weaken existing read-state behaviour.

## Motion pattern

Motion follows latest MAW source exactly where the same interaction exists:

- Popover/dropdown entrance: 240ms using `cubic-bezier(0.22, 1, 0.36, 1)` with a small upward offset and slight vertical scale.
- Accordion/collapsible open: 260ms using the same easing; close: 190ms ease-in.
- Notification dropdown: 150ms fade and small slide from the top.
- Sidebar and content shift: 200ms ease-out.
- Group chevron and nested navigation: 300ms ease-in-out.
- Form dialog: short fade plus approximately 95% to 100% scale entrance.
- Standard hover/focus transitions remain 140–200ms.
- Continuous attention animation is reserved for live/urgent operational state, never decoration.
- `prefers-reduced-motion: reduce` removes or reduces all non-essential motion to approximately 1ms/0ms.

## Page migration scope

The full Admin Panel is included:

- Dashboard and shared shell.
- Calendar and Attendance.
- People: Students, Classes, Schedule, Parents and Employees.
- Finance and student-centred financial workflows.
- Administration and community/safety operations.
- System: Audit Trail, Application Logs and Settings.
- Every related form, modal, selector, table, empty state, pagination control and feedback surface.

Pages already close to the reference are refactored onto shared components and duplicate CSS is removed. Existing data flows, page routes and terminology remain unchanged.

## Behaviour and security boundaries

- Backend permission, tenant and school scope remain authoritative.
- UI visibility is usability only and never replaces backend enforcement.
- No automotive fields, fake records, unsupported reports, exports or inactive buttons are introduced.
- Audit data remains immutable and sanitized. Application Logs remain sanitized and Super Admin-only.
- Financial, student lifecycle and user-ability behaviour is unchanged unless separately specified.
- `app/` is explicitly out of scope.

## Delivery and verification

- Implement in ordered local commits: foundation/components, shell, list pages, form/dialog workflows, then special operational pages and documentation.
- Do not push intermediate commits. Push once only after the owner visually confirms the completed Admin workspace.
- Use focused shared-component and key-page tests, Admin lint and Admin TypeScript/production build.
- Perform proportionate desktop/tablet/phone visual checks on representative pages; exhaustive backend, School App and database testing is not required for presentation-only edits.
- Record anything not run as **Not verified** rather than claiming a pass.
