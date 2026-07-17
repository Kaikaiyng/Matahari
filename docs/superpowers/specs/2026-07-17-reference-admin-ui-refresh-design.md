# Reference Admin UI Refresh Design

## Purpose

Refresh the Matahari School ERP demo so its visual hierarchy and interaction patterns feel as polished and consistent as the provided Mewah AutoWorks admin panel. The design borrows layout patterns, spacing, card treatment, tables, filters, and modal behavior without copying its brand content or blue palette.

Matahari keeps its existing black, red, white, and light-gray identity. Existing business rules, API contracts, permissions, routes, form fields, and data mutations remain unchanged.

## Scope

The refresh covers every currently available frontend page:

- Dashboard
- Students
- Parents
- Fees
- Fee Record
- Existing supporting invoice, payment, receipt, report, and settings views when they are exposed by the current application state
- Login, session-checking, empty, loading, error, and modal states

The work is a frontend presentation and component-structure change. It does not add new backend endpoints or new business features.

## Reference Findings

The reference admin panel uses a consistent application shell:

- A fixed 240–256px sidebar with grouped navigation and a strong active state
- A separate 64px white utility header
- A light-gray content canvas with 24–32px page padding
- Compact page titles followed by summary cards and working content
- White cards with 10–14px corner radii, subtle borders, and light shadows
- Search and filters grouped inside a dedicated toolbar card
- Tables contained in white cards with muted uppercase headers and status pills
- Centered form modals with a fixed header and footer and a scrollable body

The Matahari demo already has similar primitives, but its 280px sidebar, large dark dashboard banner, inconsistent page compositions, and limited elevation make the screen feel flatter and less space-efficient.

## Chosen Approach

Use a structural refresh with targeted component extraction.

The existing React state and API logic stay in place. Shared visual patterns are extracted only where doing so makes the refreshed UI consistent and easier to test. This avoids a full application rewrite while preventing every page from maintaining a separate version of the same header, card, toolbar, and modal markup.

Alternatives considered:

- A CSS-only reskin would be faster but could not consistently reproduce the reference layout across page-specific markup.
- A complete component-system rewrite would improve long-term architecture but is too broad for the demo goal and would introduce unnecessary regression risk.

## Application Shell

### Sidebar

- Desktop width: 248px.
- Background: existing near-black Matahari tone.
- Brand area remains at the top but becomes more compact.
- Navigation is divided into labeled groups such as Overview, People, and Finance.
- Active items use a red-tinted surface, red icon/accent, and white label.
- Hover, focus-visible, and pressed states remain distinct and keyboard accessible.
- On smaller screens, the sidebar remains an off-canvas drawer with a backdrop and explicit close control.

### Utility Header

- Height: 64px on desktop.
- White background with a subtle bottom border.
- Left side shows the current application or page context.
- Right side holds the session/service indicator when relevant, user identity, and logout action.
- The mobile menu button appears in this header.

### Main Canvas

- Background stays light gray.
- Desktop page padding is 24–32px; mobile padding is 16px.
- Content is allowed to use the available width while retaining readable internal spacing.
- Page headings use a compact title and subtitle, with the primary action aligned to the right when space permits.

## Shared UI Patterns

### Page Header

Each operational page uses one header structure:

- Small contextual label or subtitle
- 24px primary heading
- Optional supporting description
- One primary red action on the right

On mobile, the action moves below the title and may expand to full width.

### Summary Cards

- White surface, 12px radius, light border, and subtle shadow.
- Optional red-tinted icon tile on the left.
- Muted 12–13px label and prominent value.
- Four-column desktop layouts collapse to two and then one column at existing responsive breakpoints.
- Green, amber, and red remain semantic support colors; red is the primary brand action color.

### Toolbars

- Search, status filters, date filters, and refresh actions are grouped in a white toolbar card.
- Controls use consistent 40px heights and 10px radii.
- The most important search field grows to fill available horizontal space.
- Controls stack cleanly on mobile without horizontal overflow.

### Tables

- Tables live in a white rounded container with an optional section title.
- Header rows use a very light-gray background, muted uppercase labels, and compact letter spacing.
- Body rows use clear separators and a subtle hover state.
- Statuses remain pill-shaped and retain their existing semantic meaning.
- Row actions remain explicit buttons with accessible names; destructive actions are visually distinct.
- Wide tables retain safe horizontal scrolling rather than compressing columns into unreadable widths.

### Modals and Forms

- Modal overlay uses a dark translucent backdrop.
- Modal width follows the form complexity, with a practical desktop maximum and mobile edge spacing.
- Header and footer remain visible; the form body scrolls independently when content is tall.
- Field labels, required markers, inputs, selects, text areas, help text, and validation errors share one spacing system.
- Primary submit actions remain red. Cancel uses a neutral secondary treatment.
- Existing submit, loading, success, and error behavior is unchanged.

## Page-Specific Composition

### Dashboard

- Remove the large dark hero strip.
- Use a compact page header with a primary shortcut action.
- Present the four existing metrics as the first content row.
- Place recent operational content below in one- or two-column white panels when data is available.
- Empty dashboard sections should show a purposeful empty state rather than blank canvas.

### Students and Parents

- Page header with add action.
- Summary row showing visible records and current filter state.
- Dedicated search/filter toolbar.
- Operational table below.
- Existing detail and edit flows use the refreshed modal pattern.

### Fees and Fee Record

- Preserve current workflows and calculations.
- Use the same page header, summary cards, toolbar, and table hierarchy.
- Financial amounts remain visually prominent and right-aligned where appropriate.
- Dense fee-agreement and payment forms use grouped sections within the scrollable modal body.

## Session and Feedback States

The initial `Checking session...` screen continues to protect authenticated content while the app validates the saved session. It becomes a lightweight branded loader with a progress indicator and short explanatory copy so it does not appear frozen.

Loading states should reserve layout space where practical. API failures keep the current recovery behavior but use a consistent inline alert or panel treatment. Buttons expose disabled/loading states during mutations, and existing success or failure messages remain visible and accessible.

## Component Boundaries

Targeted shared components will be introduced for:

- `AppShell`: sidebar, utility header, mobile drawer, and content slot
- `PageHeader`: title, description, context, and primary action
- `StatCard`: icon, label, value, tone, and optional metadata
- `FilterToolbar`: layout container for page-specific controls
- `DataPanel`: titled card and scroll-safe table container
- `Modal`: overlay, fixed header/footer, scrollable content, and focus-safe controls
- `StatusBadge`: semantic status presentation

These components receive content and callbacks through props. They do not own API calls or business rules. Existing page state remains the source of truth.

## Data Flow and Behavior Preservation

- Authentication and session bootstrap continue to use the existing API client and state transitions.
- Navigation continues to use the existing page-key state unless a separate routing change is explicitly requested later.
- Page data fetching, form submission, validation, and refresh behavior remain unchanged.
- The refreshed components only render state and invoke the callbacks already provided by the application.
- No new persistence, analytics, third-party assets, or remote fonts are introduced.

## Accessibility and Responsive Requirements

- Preserve keyboard access and visible focus states.
- Keep all icon-only actions labeled for assistive technology.
- Maintain sufficient text and control contrast against red, black, white, and gray surfaces.
- Support desktop at 1280px and above, tablet layouts, and mobile layouts down to 320px.
- Avoid viewport-level horizontal overflow; only intentionally wide table containers may scroll horizontally.
- Do not rely on color alone to communicate status or validation.

## Testing and Verification

Implementation is complete only after:

- Existing frontend tests pass.
- Tests cover session-checking, primary navigation, the refreshed shared shell, and representative page/modal behavior.
- Type checking and the production build pass.
- Lint passes.
- Desktop visual checks cover Dashboard, Students, Fees, and Fee Record.
- Mobile checks cover navigation drawer, stacked page headers/toolbars, table overflow, and modal sizing.
- Browser console inspection shows no new errors or warnings during representative flows.
- Existing backend tests continue to pass because the refresh must not alter API behavior.

## Non-Goals

- Copying Mewah AutoWorks branding, text, icons, data, or blue color palette
- Adding charts or dashboard metrics that the Matahari API does not already provide
- Replacing the current authentication model
- Introducing a new router or state-management library
- Redesigning backend workflows or changing financial calculations
- Performing an unrelated full rewrite of the current `App.tsx`

## Acceptance Criteria

- All existing pages visibly share the new application shell and common UI hierarchy.
- Matahari's current red, black, white, and light-gray palette remains recognizable.
- Dashboard no longer uses the large dark hero strip.
- Operational pages consistently use page headers, summary cards, filter toolbars, data panels, and refreshed modals as applicable.
- The session-checking state clearly communicates that authentication is being verified.
- Existing user-facing workflows and API behavior still work.
- Desktop and mobile layouts meet the responsive and overflow requirements above.
- Automated checks and representative browser verification pass.
