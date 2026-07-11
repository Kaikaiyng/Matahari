# Matahari Admin Finance MVP: iPad-First Responsive Demo Design

Date: 2026-07-11

Status: Approved and implemented

Primary device: iPad

## Goal

Make the existing Admin Finance MVP professional, calm, clear, and practical at desktop, iPad landscape, iPad portrait, and mobile portrait sizes. This is a responsive usability pass. It preserves the current product structure, finance behavior, visual identity, and backend contracts.

## What Already Exists

- A React/Vite frontend concentrated in `frontend/src/App.tsx` and `frontend/src/App.css`.
- A calm neutral palette, red primary action, green/amber/red financial states, 8px radii, panel-based task grouping, and Lucide icons.
- A full desktop sidebar and an 88px compact sidebar below 1180px.
- Existing horizontal table wrappers and print-specific receipt rules.
- Working login, student, agreement, charge, payment, receipt, summary, and monthly-ledger flows backed by seeded Laravel data.
- Inline forms rather than modal or dialog overlays.

There is no project `DESIGN.md`. This pass therefore preserves the observed UI vocabulary rather than introducing a new design system.

## Evidence From the Current Frontend

The live seeded app was inspected at 1440x900, 1180x820, 820x1180, and 390x844.

- Desktop login and the desktop shell are healthy.
- At 1180px the compact sidebar works spatially, but its icon-only items have no visible labels.
- At 820px the navigation becomes a permanent horizontal icon rail and the topbar is about 322px tall.
- At 390px the payment flow expands the page to 518px, causing page-level horizontal scrolling.
- The mobile Fee Record filter grid is about 486px wide inside a 375px body.
- The mobile receipt sheet expands to about 738px and clips receipt content and actions.
- Fee Agreement month controls are about 34px high, below the 44px touch target.
- Mobile finance tables technically scroll, but their containers can exceed the viewport and the wide-ledger affordance is unclear.
- Focus-visible treatment is missing and several table actions are only 32px high.

## Approved Approach

Use a selective hybrid responsive strategy:

- Keep data-dense tables where comparison across financial columns matters.
- Use compact record rows or cards where a narrow table would hide the primary action or become unreadable.
- Preserve desktop density and hierarchy.
- Avoid consumer-style card mosaics, decorative effects, new animation, and new application architecture.

## Breakpoints

| Range | Intended behavior |
|---|---|
| 1181px and above | Full 280px desktop sidebar and existing desktop density |
| 1024px to 1180px | Compact 88px sidebar for iPad landscape and small desktop widths |
| 768px to 1023px | Tablet portrait drawer navigation and single-column task flow |
| Below 768px | Mobile drawer, compact page spacing, stacked forms, and mobile record rows |

The 1024px navigation boundary is based on the observed 820px portrait layout and the working 1180px landscape layout, not a generic framework default.

## Navigation

Desktop retains the full sidebar. The 1024–1180px compact rail retains icons and active state, with accessible names and a visible label mechanism that does not depend on hover.

Below 1024px:

- A menu button appears in a compact top app bar.
- The sidebar becomes a fixed drawer with a backdrop.
- The active page remains visually identified.
- Selecting a page, pressing Escape, or activating the backdrop closes the drawer.
- Opening the drawer locks background scrolling without shifting layout.
- Drawer items and controls are at least 44px high.
- The nonfunctional global search is removed from the narrow topbar to avoid wasting the primary task area.
- User identity is compact; logout remains directly accessible.

## Global Responsive Rules

- The document itself must never scroll horizontally at the four target viewports.
- Only deliberate table or ledger containers may scroll horizontally.
- Main content, panels, forms, and receipt sheets use `min-width: 0` and viewport-safe widths.
- Long names, IDs, references, and receipt numbers wrap with safe overflow rules.
- Default page padding is 24px desktop, 18px tablet, and 12–16px mobile.
- Body copy is at least 16px on mobile where sustained reading is required; supporting labels remain no smaller than 12px with sufficient contrast.
- Buttons, inputs, selects, checkbox rows, and navigation controls use a 44px minimum touch target on tablet/mobile.
- Keyboard focus uses a visible focus ring independent of hover.
- Destructive actions retain red differentiation and are not visually confused with primary create/save actions.

## Login

- Keep the existing centred card and visual language.
- Use a viewport-safe width with 16px mobile outer padding.
- Inputs and Login button are at least 44px high.
- Errors remain above or beside the relevant field and do not move the submit action off-screen unnecessarily.
- Use dynamic viewport height and safe bottom padding so mobile keyboards and browser controls do not hide the button.

## Student List

At 1024px and above, retain the table.

Below 1024px, render a compact bordered list with one student record per row. Each record shows:

1. Student Name
2. Student ID
3. Class
4. Status
5. Open action

Fee and outstanding totals remain in the page summary and desktop table; they do not compete with the primary mobile identification task. Filters wrap into full-width or two-column controls depending on available space. The mobile list is one continuous operational list, not a decorative card grid.

## Student Detail

At desktop widths, retain the readable multi-column overview. Below 1024px, use one content column in this order:

1. Student overview
2. Fee Record totals
3. Fee Agreement
4. Fee Record charges
5. Payments
6. Receipts

Section headings, status, totals, and actions remain visible. Long student names and IDs wrap without widening the panel. Each major finance section remains visually separated, but nested panels are reduced where they add chrome without hierarchy.

## Fee Agreement

- Tablet uses two columns only where fields remain comfortably readable; mobile uses one column.
- Display `Classification` as `Charge Type` and `Billing Frequency` as `Billing Pattern` without changing payload keys or enum values.
- Keep the `manual` classification available in this pass. Hiding it would introduce an unverified workflow assumption; the separate Manual Charge flow does not by itself prove that existing agreement users never need the enum.
- Month controls wrap, remain at least 44px high, and have clearly distinct selected, unselected, hover, and focus states.
- Validation appears directly below the relevant item or month group.
- Preview totals and Save/Supersede remain readable and tappable; the final action area may become sticky within the viewport only if it does not obscure form content.

## Fee Record Preview and Activation

- Academic year and action buttons wrap without shrinking.
- Activation warnings appear before the preview rows and remain visually prominent.
- Tablet uses a contained scrolling preview table.
- Mobile uses stacked preview records with month, fee code/description, category, amount, and status.
- Activation remains disabled when existing business rules block it.

## Manual Charge

- Tablet uses two columns when space permits.
- Mobile uses one column.
- Academic Year, Billing Month, Category, Description, Amount, and Remark keep explicit labels and nearby validation.
- The primary submit action becomes full-width only on mobile.

## Payment and Outstanding Charge Allocation

This is the highest-priority demo flow.

- Payment details use two columns on tablet and one on mobile.
- Outstanding charges remain grouped by month and category.
- Each charge row is a 44px-or-larger tappable label; amount, category, and outstanding balance remain visible.
- Selected charges continue to create editable partial-allocation rows using existing business logic.
- Payment amount, selected allocation total, balance/mismatch state, and manual-allocation warning are grouped in a high-contrast summary area.
- On mobile, the summary/action area remains reachable after the long month list and may use safe-area-aware sticky positioning only when it does not cover content.
- Payment method and status controls never expand the page width.
- No primary action is placed at the far edge of a horizontally scrolling row.

## Payment and Receipt History

- Desktop retains tables.
- Tablet portrait uses contained horizontal tables with readable minimum widths.
- Mobile uses structured financial record rows containing date, amount, status, reference or receipt number, and actions.
- Verify, Void, Generate Receipt, View, and Print actions appear below the record content and remain at least 44px high.
- Long receipt numbers and references wrap safely.
- Critical status and void information is never hidden.

## Receipt Screen and Print

Screen rules:

- The receipt sheet is fluid and never wider than its containing panel.
- Metadata is four columns on desktop, two on tablet, and one on mobile.
- Student names, IDs, receipt numbers, and values wrap without forcing width.
- The receipt item table scrolls inside the receipt when necessary; the page itself does not scroll horizontally.
- The Print Receipt button remains accessible and is full-width only on mobile.

Print rules:

- Responsive screen overrides are scoped with `@media screen` where needed.
- Existing A4 margins, receipt visibility scope, page-break rules, and no-print behavior remain intact.
- Browser print preview is checked after implementation; PDF generation is not added.

## Fee Record Summary

- Desktop and landscape tablet retain the ledger table.
- Portrait tablet and mobile keep the complete ledger in a contained horizontal scroll region.
- Required information remains present: Student, Student ID, Expected, Paid, Outstanding, and Status.
- A visible “Swipe to see all columns” cue appears on narrow screens.
- Sticky header and the first identity column may be added if the focused CSS remains reliable without layering defects.
- Filters use one column on mobile and two columns on tablet portrait, with the outstanding toggle on its own 44px row when necessary.

## Category Monthly Fee Record

- The Jan–Dec table is never squeezed to viewport width.
- The table remains in a dedicated horizontal scroll container that itself fits the page.
- Month cells keep their readable minimum width and existing paid/partial/unpaid/no-charge distinctions.
- A visible horizontal-scroll cue appears above the ledger.
- A sticky header and Student Name/Student ID columns are allowed only if they remain small, safe, and visually correct during horizontal scrolling.
- This remains a table, not a spreadsheet component.

## Forms and Overlays

The current finance UI uses inline forms and no modal/dialog implementation. This pass does not introduce a new modal system. Any newly required drawer overlay must:

- Fit the viewport.
- Keep its close action visible.
- Prevent background scrolling.
- Respect safe-area and mobile browser insets.
- Restore focus to the menu button on close where practical.

## Interaction States

| Area | Loading | Empty | Error | Success/ready | Partial/warning |
|---|---|---|---|---|---|
| Login | Existing checking state remains centred | Not applicable | Error remains visible above fields | Form is ready and tappable | Submitting button remains stable |
| Student List | Loading row/list message | Clear no-students message | Existing API message | Records and primary actions visible | Filtered results retain context |
| Student Detail | Existing section loading states | Existing no-agreement/no-history text | Error stays within affected section | Sections follow approved order | Financial warnings remain prominent |
| Fee Preview | Preview action shows progress | Clear no-preview state | Warning/error block above results | Rows/cards are readable | Activation-blocking warnings remain prominent |
| Payment | Refresh/submission actions show progress | Clear no-outstanding state | Field errors and mismatch near summary | Balanced state is explicit | Manual allocation and mismatch remain visible |
| Histories | Loading row/card | Clear empty state | Section error remains local | Status and actions visible | Void/partial states remain explicit |
| Ledgers | Loading table state | Clear no-record state | Existing error message | Contained scroll and financial states | Partial/unpaid states retain color and text |

## Accessibility Acceptance Criteria

- All navigation items retain accessible names at every breakpoint.
- Drawer menu and close controls expose state and purpose.
- Keyboard users can open, traverse, and close the drawer.
- Focus rings are visible on buttons, links, form controls, month selectors, charge selectors, and table actions.
- Touch targets are at least 44px where used on iPad/mobile.
- Body text contrast meets 4.5:1; status meaning is communicated by text as well as color.
- Labels remain visible after fields contain values.
- Hover is enhancement only, never the sole indication of clickability.

## Technical Boundaries

Expected production edits are focused on:

- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/index.css` only if a global overflow or focus rule belongs there
- Small new frontend components only when they reduce risk, such as a navigation drawer or responsive financial record row

No routing, state-management, backend, framework, or design-system rewrite is planned. Existing payloads and finance business logic remain unchanged.

## Verification

Run:

- `npm.cmd run build`
- `npm.cmd run lint`
- `git diff --check -- frontend/src/App.tsx frontend/src/App.css frontend/src/index.css` plus any new frontend files

Browser QA viewports:

- Desktop: 1440x900
- iPad landscape: 1180x820
- iPad portrait: 820x1180
- Mobile portrait: 390x844

Exercise login, navigation, Student List, Student Detail, Fee Agreement, charge preview, Manual Charge, Payment allocation, Payment History, Receipt History, receipt screen, Fee Record Summary, Category Monthly, and Jan–Dec horizontal scrolling. Return to desktop after narrow-screen testing. Check print preview where the browser surface supports it.

## Not in Scope

- Tunnel, deployment, hosting, or domain configuration
- Statement, Reminder, Reports, Export, PDF, Parent Portal, or dashboard finance logic
- New backend business logic or major modules
- Large architecture, routing, state-management, framework, or design-system refactors
- Full rebranding or decorative animation
- A spreadsheet component for Category Monthly

## Success Criteria

The pass is `RESPONSIVE_DEMO_READY` only when:

- No page-level horizontal overflow remains at the four target sizes.
- All named demo flows are usable without clipped controls.
- The iPad drawer and compact landscape navigation work correctly.
- Financial statuses and primary actions remain readable and accessible.
- Desktop behavior is not regressed.
- Build, lint, diff check, and browser QA pass.

Real-device iPad testing may remain a documented warning if no device is available.
